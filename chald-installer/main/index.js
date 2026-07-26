const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
// В Electron обычный `fs` патчится под asar. Запись/чтение *.asar через него
// даёт "Invalid package". Для распаковки payload нужен настоящий fs.
const fs = require('fs')
const originalFs = require('original-fs')
const os = require('os')
const { execFile } = require('child_process')
const AdmZip = require('adm-zip')

const PRODUCT_NAME = 'ChaldLauncher'
const APP_ID = 'ChaldLauncher'
const UNINSTALL_KEY = `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APP_ID}`

const isUninstall = process.argv.includes('--uninstall')

function payloadZipPath() {
  const packaged = path.join(process.resourcesPath, 'app-payload.zip')
  if (originalFs.existsSync(packaged)) return packaged
  return path.join(__dirname, '..', 'resources', 'app-payload.zip')
}

function defaultInstallDir() {
  return path.join(os.homedir(), 'AppData', 'Local', 'Programs', PRODUCT_NAME)
}

function readInstalledDir() {
  return new Promise((resolve) => {
    execFile('reg', ['query', UNINSTALL_KEY, '/v', 'InstallLocation'], (err, stdout) => {
      if (err) return resolve(null)
      const match = stdout.match(/InstallLocation\s+REG_SZ\s+(.+)/)
      resolve(match ? match[1].trim() : null)
    })
  })
}

let win

function createWindow() {
  win = new BrowserWindow({
    width: 720,
    height: 460,
    resizable: false,
    frame: false,
    transparent: false,
    backgroundColor: '#0b0d0c',
    webPreferences: {
      preload: path.join(__dirname, '..', 'renderer', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())

ipcMain.handle('window:minimize', () => win.minimize())
ipcMain.handle('window:close', () => win.close())

ipcMain.handle('installer:bootstrap', async () => {
  const installedDir = await readInstalledDir()
  return {
    mode: isUninstall ? 'uninstall' : 'install',
    productName: PRODUCT_NAME,
    defaultDir: installedDir || defaultInstallDir(),
    alreadyInstalled: !!installedDir,
  }
})

ipcMain.handle('installer:choose-folder', async () => {
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory', 'createDirectory'],
  })
  if (result.canceled || !result.filePaths[0]) return null
  return path.join(result.filePaths[0], PRODUCT_NAME)
})

function createShortcut(shortcutPath, targetPath, iconPath) {
  return new Promise((resolve, reject) => {
    const vbs = `
Set oWS = WScript.CreateObject("WScript.Shell")
Set oLink = oWS.CreateShortcut("${shortcutPath.replace(/\\/g, '\\\\')}")
oLink.TargetPath = "${targetPath.replace(/\\/g, '\\\\')}"
oLink.WorkingDirectory = "${path.dirname(targetPath).replace(/\\/g, '\\\\')}"
oLink.IconLocation = "${iconPath.replace(/\\/g, '\\\\')}"
oLink.Save
`.trim()
    const tmp = path.join(os.tmpdir(), `chald-shortcut-${Date.now()}.vbs`)
    fs.writeFileSync(tmp, vbs)
    execFile('wscript', [tmp], (err) => {
      fs.unlink(tmp, () => {})
      if (err) reject(err)
      else resolve()
    })
  })
}

function writeUninstallRegistry(installDir, exePath, iconPath, version) {
  const uninstallerPath = `"${exePath}" --uninstall`
  const entries = [
    ['DisplayName', PRODUCT_NAME],
    ['DisplayIcon', iconPath],
    ['DisplayVersion', version],
    ['Publisher', 'ChaldStudio'],
    ['InstallLocation', installDir],
    ['UninstallString', uninstallerPath],
    ['NoModify', '1', 'REG_DWORD'],
    ['NoRepair', '1', 'REG_DWORD'],
  ]
  return Promise.all(entries.map(([name, value, type = 'REG_SZ']) => new Promise((resolve, reject) => {
    execFile('reg', ['add', UNINSTALL_KEY, '/v', name, '/t', type, '/d', String(value), '/f'], (err) => {
      if (err) reject(err)
      else resolve()
    })
  })))
}

function removeUninstallRegistry() {
  return new Promise((resolve) => {
    execFile('reg', ['delete', UNINSTALL_KEY, '/f'], () => resolve())
  })
}


/**
 * Игра (instances/assets/libraries) отдельно от exe:
 *   Windows: %APPDATA%\chaldlauncher
 *   Linux/mac: ~/chaldlauncher
 * Путь пишется в %APPDATA%\chald-launcher\root (читает LauncherApp.setup).
 */
function linkGameDataToInstallDir(_installDir) {
  const home = os.homedir()
  const gameDataDir = process.platform === 'win32'
    ? path.join(home, 'AppData', 'Roaming', 'chaldlauncher')
    : path.join(home, 'chaldlauncher')

  const cfgDir = process.platform === 'win32'
    ? path.join(home, 'AppData', 'Roaming', 'chald-launcher')
    : path.join(home, '.config', 'chald-launcher')

  originalFs.mkdirSync(gameDataDir, { recursive: true })
  originalFs.mkdirSync(cfgDir, { recursive: true })
  originalFs.writeFileSync(path.join(cfgDir, 'root'), gameDataDir, 'utf8')
}

function rmrf(target) {
  // recursive rm через original-fs API недоступен в promises так же — используем fs.promises
  // (папка установки не является asar-путём целиком)
  return fs.promises.rm(target, { recursive: true, force: true })
}

/**
 * Распаковка payload:
 * - без extractEntryTo/chmod (ломалось на Windows)
 * - через original-fs, иначе Electron перехватывает *.asar → "Invalid package"
 */
function extractPayload(zipPath, destDir, onProgress) {
  if (!originalFs.existsSync(zipPath)) {
    throw new Error(`Payload не найден: ${zipPath}\nСначала: node build/prepare-payload.js`)
  }

  // На время распаковки полностью отключаем asar-перехват
  const prevNoAsar = process.noAsar
  process.noAsar = true

  try {
    const zip = new AdmZip(zipPath)
    const entries = zip.getEntries().filter((e) => {
      const n = e.entryName.replace(/\\/g, '/')
      if (!n || n.endsWith('/')) return false
      if (n.startsWith('__MACOSX/') || n.includes('.DS_Store')) return false
      return true
    })

    const total = entries.length || 1
    let done = 0

    for (const entry of entries) {
      const rel = entry.entryName.replace(/\\/g, '/')
      const target = path.join(destDir, ...rel.split('/').filter(Boolean))

      originalFs.mkdirSync(path.dirname(target), { recursive: true })

      const data = entry.getData()
      if (!data) {
        throw new Error(`Пустые данные в zip: ${rel}`)
      }
      originalFs.writeFileSync(target, data)

      done += 1
      if (typeof onProgress === 'function') {
        onProgress(done, total, path.basename(target))
      }
    }

    return done
  } finally {
    process.noAsar = prevNoAsar
  }
}

ipcMain.handle('installer:start', async (_evt, opts) => {
  const {
    installDir,
    createDesktopShortcut,
    createStartMenuShortcut,
    launchAfter,
  } = opts || {}

  const send = (progress, label) => {
    try {
      win.webContents.send('installer:progress', { progress, label })
    } catch (_) {}
  }

  try {
    if (!installDir || typeof installDir !== 'string') {
      throw new Error('Не указана папка установки')
    }

    send(2, 'Подготовка…')
    // чистим прошлую битую установку
    if (originalFs.existsSync(installDir)) {
      send(4, 'Очистка старой установки…')
      await rmrf(installDir).catch(() => {})
    }
    originalFs.mkdirSync(installDir, { recursive: true })

    const zipPath = payloadZipPath()
    send(8, 'Распаковка файлов…')

    let lastUi = 0
    extractPayload(zipPath, installDir, (done, total, name) => {
      const pct = 10 + Math.round((done / total) * 60)
      if (pct !== lastUi || name.endsWith('.asar') || name.endsWith('.exe')) {
        lastUi = pct
        send(pct, `Распаковка: ${name}`)
      }
    })

    send(72, 'Проверка файлов…')
    linkGameDataToInstallDir(installDir)
    send(75, 'Настройка каталога игры…')

    const exePath = path.join(installDir, `${PRODUCT_NAME}.exe`)
    if (!originalFs.existsSync(exePath)) {
      throw new Error(
        `После распаковки не найден ${PRODUCT_NAME}.exe в:\n${installDir}`,
      )
    }
    const asarPath = path.join(installDir, 'resources', 'app.asar')
    if (!originalFs.existsSync(asarPath)) {
      throw new Error(`После распаковки не найден resources\\app.asar`)
    }
    // размер asar > 0
    if (originalFs.statSync(asarPath).size < 1000) {
      throw new Error('app.asar повреждён или пуст — пересоберите payload')
    }

    const iconPath = originalFs.existsSync(path.join(installDir, 'icon.ico'))
      ? path.join(installDir, 'icon.ico')
      : exePath

    if (createDesktopShortcut) {
      send(80, 'Создание ярлыка на рабочем столе…')
      const desktop = path.join(os.homedir(), 'Desktop', `${PRODUCT_NAME}.lnk`)
      await createShortcut(desktop, exePath, iconPath).catch(() => {})
    }

    if (createStartMenuShortcut) {
      send(87, 'Добавление в меню Пуск…')
      const startMenuDir = path.join(
        os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs',
      )
      originalFs.mkdirSync(startMenuDir, { recursive: true })
      await createShortcut(path.join(startMenuDir, `${PRODUCT_NAME}.lnk`), exePath, iconPath).catch(() => {})
    }

    send(93, 'Регистрация в системе…')
    const pkgVersion = require('../package.json').version
    // UninstallString = этот setup (process.execPath), чтобы --uninstall работал
    await writeUninstallRegistry(installDir, process.execPath, iconPath, pkgVersion).catch(() => {})

    send(100, 'Готово')

    if (launchAfter) {
      execFile(exePath, [], { detached: true, stdio: 'ignore' }).unref()
    }

    return { installDir, ok: true }
  } catch (err) {
    const message = err && err.message ? err.message : String(err)
    send(0, `Ошибка: ${message}`)
    throw new Error(message)
  }
})

ipcMain.handle('installer:uninstall', async () => {
  const send = (progress, label) => {
    try {
      win.webContents.send('installer:progress', { progress, label })
    } catch (_) {}
  }
  const installDir = await readInstalledDir()
  if (!installDir) return { ok: false }

  send(20, 'Удаление ярлыков…')
  const desktop = path.join(os.homedir(), 'Desktop', `${PRODUCT_NAME}.lnk`)
  const startMenu = path.join(
    os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', `${PRODUCT_NAME}.lnk`,
  )
  await rmrf(desktop).catch(() => {})
  await rmrf(startMenu).catch(() => {})

  send(50, 'Удаление файлов…')
  process.noAsar = true
  try {
    await rmrf(installDir).catch(() => {})
  } finally {
    process.noAsar = false
  }

  send(85, 'Очистка реестра…')
  await removeUninstallRegistry()

  send(100, 'Готово')
  return { ok: true }
})

ipcMain.handle('installer:open-folder', (_evt, dir) => shell.openPath(dir))
