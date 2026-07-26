import {
  ChaldStudioService as IChaldStudioService,
  ChaldStudioServiceKey,
  ChaldStudioUpdateInfo,
  CommonProgress,
} from '@xmcl/runtime-api'
import { Inject, LauncherAppKey, kGameDataPath, kTempDataPath } from '~/app'
import { AbstractService, ExposeServiceKey } from '~/service'
import { LauncherApp } from '../app/LauncherApp'
import { InstanceService } from '~/instance'
import { JavaService } from '~/java'
import { copyPassively } from '~/util/fs'
import { open as openZip, walkEntries, openEntryReadStream } from '@xmcl/unzip'
import { createWriteStream, promises as fsPromises } from 'fs'
import { dirname, join } from 'path'
import { kTasks, type Tasks } from '~/infra'

const PAGE_URL = 'https://chaldforum.dynmap.xyz/download'
const VERSION_FILE = 'chaldstudio-version.json'

/**
 * Magic bytes детектор архива
 */
function detectArchiveType(bytes: Uint8Array): 'zip' | 'rar' | 'html' | null {
  if (bytes.length < 4) return null
  // ZIP: PK\x03\x04
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return 'zip'
  // RAR: Rar!\x1a\x07
  if (bytes[0] === 0x52 && bytes[1] === 0x61 && bytes[2] === 0x72 && bytes[3] === 0x21) return 'rar'
  // HTML: <!DOCTYPE или <html
  if ((bytes[0] === 0x3c && bytes[1] === 0x21) || (bytes[0] === 0x3c && bytes[1] === 0x68)) return 'html'
  return null
}

/**
 * Парсим Google Drive confirm-токен из HTML страницы предупреждения
 */
function parseGDConfirmToken(html: string): string | null {
  // Ищем в форме: name="confirm" value="xxx"
  const match = html.match(/name="confirm"\s+value="([^"]+)"/i)
    // Или в URL: confirm=xxx
    || html.match(/confirm=([a-zA-Z0-9_-]+)/)
  return match?.[1] || null
}

@ExposeServiceKey(ChaldStudioServiceKey)
export class ChaldStudioService extends AbstractService implements IChaldStudioService {
  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(kTempDataPath) private tempDataPath: (...args: string[]) => string,
    @Inject(kGameDataPath) private gameDataPath: (...args: string[]) => string,
    @Inject(kTasks) private tasks: Tasks,
    @Inject(JavaService) private javaService: JavaService,
  ) {
    super(app, async () => {
      this.log('ChaldStudioService initialized')
    })
  }

  async fetchModpackInfo(): Promise<ChaldStudioUpdateInfo | null> {
    try {
      this.log(`Fetching modpack page: ${PAGE_URL}`)
      const resp = await fetch(PAGE_URL, {
        headers: {
          'User-Agent': 'ChaldLauncher/1.0',
          'Accept': 'text/html,application/xhtml+xml',
        },
      })

      if (!resp.ok) {
        this.warn(`HTTP ${resp.status} fetching page`)
        return null
      }

      const html = await resp.text()

      // Парсим версию
      const versionMatch = html.match(/v(\d+\.\d+)/i)
        || html.match(/sborka\.(\d+\.\d+)\.(zip|rar)/i)
      const version = versionMatch?.[1] || null
      if (!version) {
        this.warn('Cannot parse version from page')
        return null
      }

      // Парсим имя файла
      const fileNameMatch = html.match(/(sborka\.\d+\.\d+\.(?:zip|rar))/i)
      const fileName = fileNameMatch?.[1] || `sborka.${version}.zip`

      // Парсим размер
      const sizeMatch = html.match(/(\d+\.\d+)\s*(MB|GB|MiB|GiB)/i)
      let fileSize = 0
      if (sizeMatch) {
        const num = parseFloat(sizeMatch[1])
        const unit = sizeMatch[2].toUpperCase()
        fileSize = unit.startsWith('G') ? num * 1024 * 1024 * 1024 : num * 1024 * 1024
      }

      // Парсим Google Drive ссылку — ищем ID файла
      let googleDriveUrl: string | undefined
      let googleDriveFileId: string | undefined

      // Формат: drive.usercontent.google.com/download?id=XXX
      const gdMatch = html.match(/https:\/\/drive\.usercontent\.google\.com\/download\?id=([a-zA-Z0-9_-]+)/)
      if (gdMatch) {
        googleDriveFileId = gdMatch[1]
        // Сохраняем ID для построения URL при скачивании
        googleDriveUrl = `https://drive.usercontent.google.com/download?id=${googleDriveFileId}&export=download`
      }

      // Формат: drive.google.com/file/d/XXX/view
      if (!googleDriveUrl) {
        const gdFileMatch = html.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/)
        if (gdFileMatch) {
          googleDriveFileId = gdFileMatch[1]
          googleDriveUrl = `https://drive.usercontent.google.com/download?id=${googleDriveFileId}&export=download`
        }
      }

      // Старый формат: drive.google.com ссылка
      if (!googleDriveUrl) {
        const gdOldMatch = html.match(/https:\/\/drive\.google\.com[^"'\s<>]*id=([a-zA-Z0-9_-]+)/)
        if (gdOldMatch) {
          googleDriveFileId = gdOldMatch[1]
          googleDriveUrl = `https://drive.usercontent.google.com/download?id=${googleDriveFileId}&export=download`
        }
      }

      // Парсим чейнджлог
      const changelog: string[] = []
      const changelogSection = html.match(/Что нового[^]*?<ol[^>]*>([\s\S]*?)<\/ol>/i)
      if (changelogSection) {
        const items = changelogSection[1].matchAll(/<li>([\s\S]*?)<\/li>/gi)
        for (const item of items) {
          changelog.push(item[1].trim())
        }
      }
      if (changelog.length === 0) {
        const items = html.matchAll(/<li>([^<]+(?:обновл|добавл|исправл|измен)[^<]*)<\/li>/gi)
        for (const item of items) {
          changelog.push(item[1].trim())
        }
      }

      return {
        version,
        fileName,
        fileSize,
        directUrl: `${new URL('/download/file', PAGE_URL).href}`,
        googleDriveUrl,
        changelog,
        pageUrl: PAGE_URL,
      }
    } catch (e) {
      this.warn(`Failed to fetch modpack info: ${e}`)
      return null
    }
  }

  async getInstalledModpackVersion(): Promise<string | null> {
    const filePath = join(this.gameDataPath(), VERSION_FILE)
    try {
      const data = JSON.parse(await fsPromises.readFile(filePath, 'utf-8'))
      return data.version || null
    } catch {
      return null
    }
  }

  async setInstalledModpackVersion(version: string): Promise<void> {
    const filePath = join(this.gameDataPath(), VERSION_FILE)
    await fsPromises.writeFile(filePath, JSON.stringify({
      version,
      installedAt: new Date().toISOString(),
    }, null, 2), 'utf-8')
  }

  /**
   * Скачать файл с одного URL в destPath.
   * Возвращает true если файл — валидный архив, false если HTML (GD warning).
   */
  private async downloadFile(url: string, label: string, destPath: string, onProgress?: (ratio: number) => void): Promise<boolean> {
    this.log(`Downloading from ${label}: ${url}`)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ChaldLauncher/1.0',
      },
      redirect: 'follow',
    })

    if (!response.ok || !response.body) {
      throw new Error(`HTTP ${response.status}`)
    }

    const writer = createWriteStream(destPath)
    const reader = response.body.getReader()
    const contentLength = Number(response.headers.get('content-length') || 0)
    let downloadedBytes = 0
    let firstChunk: Uint8Array | null = null
    // Вся HTML страница (если GD вернула HTML)
    let fullHtml = ''

    // Читаем все чанки, чтобы иметь полный HTML для парсинга confirm токена
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      if (!firstChunk) {
        firstChunk = value
      }

      // Если хотя бы первые 512 байт — HTML, то собираем весь буфер
      if (firstChunk) {
        const checkBytes = firstChunk.slice(0, Math.min(firstChunk.length, 512))
        if (detectArchiveType(new Uint8Array(checkBytes)) === 'html') {
          fullHtml += new TextDecoder().decode(value, { stream: true })
        }
      }

      downloadedBytes += value.length
      if (onProgress && contentLength > 0) {
        onProgress(Math.min(1, downloadedBytes / contentLength))
      } else if (onProgress) {
        // неизвестный размер — мягкий рост до 0.9
        onProgress(Math.min(0.9, downloadedBytes / (200 * 1024 * 1024)))
      }
      await new Promise<void>((resolve, reject) => {
        writer.write(value, (err) => (err ? reject(err) : resolve()))
      })
    }
    await new Promise<void>((resolve, reject) => {
      writer.end((err) => (err ? reject(err) : resolve()))
    })

    // Если это HTML — GD virus scan warning
    if (firstChunk) {
      const checkBytes = firstChunk.slice(0, Math.min(firstChunk.length, 512))
      const type = detectArchiveType(new Uint8Array(checkBytes))

      if (type === 'html') {
        this.log(`GD returned HTML page (${downloadedBytes} bytes)`)

        // Закрываем и удаляем файл
        await fsPromises.unlink(destPath).catch(() => {})

        const confirmToken = parseGDConfirmToken(fullHtml)
        if (confirmToken) {
          this.log(`Found confirm token: ${confirmToken}, retrying...`)
          const confirmUrl = url.includes('?')
            ? `${url}&confirm=${confirmToken}`
            : `${url}?confirm=${confirmToken}`
          return this.downloadFile(confirmUrl, `${label} (confirm)`, destPath, onProgress)
        }

        this.warn('No confirm token found in GD HTML page')
        return false
      }

      this.log(`Downloaded ${downloadedBytes} bytes from ${label}`)
      return type === 'zip' || type === 'rar'
    }

    this.log(`Downloaded ${downloadedBytes} bytes from ${label} (empty)`)
    return false
  }

  /**
   * Extracts every entry of a zip archive straight into destDir, preserving
   * the folder structure inside the zip. Unlike modpackService.importModpack,
   * this does NOT require a recognized modpack manifest (CurseForge/Modrinth/
   * MMC/ATLauncher) -- our own "сборка" is just a plain instance folder dump
   * (mods/, config/, resourcepacks/, ...), so importModpack always rejected it
   * with `invalidModpack`.
   */
  private async extractZipToDir(zipPath: string, destDir: string): Promise<void> {
    const zip = await openZip(zipPath, { lazyEntries: true, autoClose: false })
    try {
      await walkEntries(zip, async (entry) => {
        if (entry.fileName.endsWith('/')) return
        const target = join(destDir, entry.fileName)
        await fsPromises.mkdir(dirname(target), { recursive: true })
        const readStream = await openEntryReadStream(zip, entry)
        const writeStream = createWriteStream(target)
        await new Promise<void>((resolve, reject) => {
          readStream.on('error', reject)
          writeStream.on('error', reject)
          writeStream.on('finish', resolve)
          readStream.pipe(writeStream)
        })
      })
    } finally {
      zip.close()
    }
  }

  /**
   * Resolves the ChaldStudio instance path, creating the instance if it
   * doesn't exist yet.
   */
  private async ensureChaldStudioInstancePath(): Promise<string> {
    const chaldStudioPath = this.gameDataPath('instances', 'ChaldStudio')
    const runtime = {
      minecraft: '1.21.1',
      neoForged: '21.1.233',
    }
    try {
      await fsPromises.access(chaldStudioPath)
      this.log(`Found existing ChaldStudio instance at ${chaldStudioPath}`)
      // Гарантируем правильную версию MC/NeoForge у уже существующего инстанса
      try {
        await this.instanceService.editInstance({
          instancePath: chaldStudioPath,
          runtime,
        })
      } catch (e) {
        this.warn(`Failed to update ChaldStudio instance runtime: ${e}`)
      }
      return chaldStudioPath
    } catch {
      this.log('No existing ChaldStudio instance, creating a new one (1.21.1 + NeoForge 21.1.233)')
      return await this.instanceService.createInstance({
        name: 'ChaldStudio',
        runtime,
      })
    }
  }


  /**
   * Ставит Java 21 (java-runtime-delta), если её ещё нет, и возвращает путь
   * до java-исполняемого файла, чтобы его можно было закрепить за инстансом.
   * Для 1.21.1 NeoForge системная Java 26 ломает Mixin.
   */
  private async ensureJava21(task: { progress: CommonProgress }): Promise<string | undefined> {
    const findJava21 = async () => {
      try {
        await this.javaService.refreshLocalJava(false)
      } catch (e) {
        this.warn(`refreshLocalJava failed: ${e}`)
      }
      const state = await this.javaService.getJavaState()
      return (state.all || []).find((j) => j.valid && j.majorVersion === 21)
    }

    let java21 = await findJava21()
    if (java21) {
      this.log(`Java 21 already available at ${java21.path}`)
      task.progress = { total: 100, progress: 18 } as CommonProgress
      return java21.path
    }

    this.log('Installing Java 21 (java-runtime-delta) for ChaldStudio...')
    task.progress = { total: 100, progress: 8 } as CommonProgress
    await this.javaService.installJava({
      component: 'java-runtime-delta',
      majorVersion: 21,
    })
    task.progress = { total: 100, progress: 16 } as CommonProgress

    // Устанавливаемая java не всегда сразу видна в getJavaState — перечитываем.
    java21 = await findJava21()
    task.progress = { total: 100, progress: 18 } as CommonProgress

    if (!java21) {
      this.warn('Java 21 installed but could not be located afterwards — instance java will not be pinned')
      return undefined
    }

    this.log(`Java 21 installed at ${java21.path}`)
    return java21.path
  }

  /**
   * Закрепляет конкретный путь до Java 21 за инстансом ChaldStudio,
   * чтобы при запуске игры лаунчер не выбирал системную Java (например 26),
   * даже если та стоит по умолчанию для всего лаунчера.
   */
  private async pinInstanceJava(instancePath: string, javaPath?: string): Promise<void> {
    if (!javaPath) return
    try {
      await this.instanceService.editInstance({
        instancePath,
        java: javaPath,
      })
      this.log(`Pinned instance java -> ${javaPath}`)
    } catch (e) {
      this.warn(`Failed to pin instance java: ${e}`)
    }
  }

  async downloadAndInstallModpack(): Promise<{ instancePath: string }> {
    const info = await this.fetchModpackInfo()
    if (!info) {
      throw new Error('Не удалось получить информацию о сборке с сайта')
    }

    const tempDir = this.tempDataPath('chaldstudio')
    await fsPromises.mkdir(tempDir, { recursive: true })
    const destPath = join(tempDir, info.fileName)

    const task = this.tasks.create({
      id: 'chaldstudio-download',
      type: 'operation',
      key: `chaldstudio-${info.version}`,
    })

    // 0) Инстанс ChaldStudio должен существовать до установки java,
    // чтобы можно было сразу закрепить java 21 именно за ним.
    const instancePath = await this.ensureChaldStudioInstancePath()

    // 1) Java 21 перед скачиванием сборки — ставится автоматически,
    // если её ещё нет, и сразу прописывается в настройках этого инстанса.
    task.progress = { total: 100, progress: 2 } as CommonProgress
    const java21Path = await this.ensureJava21(task)
    await this.pinInstanceJava(instancePath, java21Path)

    // Список URL для попыток
    const urlsToTry: Array<{ url: string; label: string }> = []
    if (info.googleDriveUrl) {
      urlsToTry.push({ url: info.googleDriveUrl, label: 'Google Drive' })
    }
    urlsToTry.push({ url: info.directUrl, label: 'прямая ссылка' })

    try {
      let downloaded = false
      let lastError: Error | null = null

      for (const { url, label } of urlsToTry) {
        try {
          task.progress = { total: 100, progress: 20 } as CommonProgress
          const success = await this.downloadFile(url, label, destPath, (ratio) => {
            task.progress = { total: 100, progress: 20 + ratio * 50 } as CommonProgress
          })
          if (!success) {
            throw new Error(`Скачана HTML страница вместо файла (${label})`)
          }
          downloaded = true
          task.progress = { total: 100, progress: 70 } as CommonProgress
          break
        } catch (e) {
          lastError = e instanceof Error ? e : new Error(String(e))
          this.warn(`Failed to download from ${label}: ${lastError.message}`)
        }
      }

      if (!downloaded) {
        throw lastError || new Error('Не удалось скачать файл')
      }

      // Определяем тип архива
      const fileBuffer = new Uint8Array(await fsPromises.readFile(destPath))
      const archiveType = detectArchiveType(fileBuffer)

      // Инстанс ChaldStudio (1.21.1 + NeoForge 21.1.233) уже создан/обновлён
      // и java 21 уже закреплена за ним (см. шаг 0 выше).
      // Это не CurseForge/Modrinth-модпак, поэтому importModpack не используем.
      // Сборка кладётся в mods/ созданного инстанса
      const modsDir = join(instancePath, 'mods')
      await fsPromises.mkdir(modsDir, { recursive: true })

      if (archiveType === 'zip') {
        task.progress = { total: 100, progress: 72 } as CommonProgress
        this.log(`Extracting ZIP build into mods at ${modsDir}...`)
        await this.extractArchiveContentsToMods(destPath, 'zip', modsDir, tempDir, info.version)
      } else if (archiveType === 'rar') {
        this.log('Detected RAR archive, extracting into mods...')
        task.progress = { total: 100, progress: 72 } as CommonProgress
        await this.extractArchiveContentsToMods(destPath, 'rar', modsDir, tempDir, info.version)
      } else {
        throw new Error('Неизвестный формат архива сборки (не zip и не rar)')
      }

      const result = { instancePath }

      // Чистим temp
      await fsPromises.unlink(destPath).catch(() => {})

      // Сохраняем версию
      await this.setInstalledModpackVersion(info.version)

      task.progress = { total: 100, progress: 100 } as CommonProgress
      task.complete()

      this.log(`Modpack installed at ${result.instancePath}`)
      return { instancePath: result.instancePath }
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e))
      task.fail(error)
      throw error
    }
  }


  /**
   * Распаковывает архив сборки в папку mods инстанса.
   * - Если внутри одна папка-обёртка (например "сборка/") — берём её содержимое.
   * - Если внутри уже есть mods/ — копируем содержимое этой mods/.
   * - Иначе копируем все файлы/папки прямо в mods/.
   */
  private async extractArchiveContentsToMods(
    archivePath: string,
    archiveType: 'zip' | 'rar',
    modsDir: string,
    tempDir: string,
    version: string,
  ): Promise<void> {
    const extractDir = join(tempDir, `extracted-${version}`)
    await fsPromises.rm(extractDir, { recursive: true, force: true }).catch(() => {})
    await fsPromises.mkdir(extractDir, { recursive: true })

    if (archiveType === 'zip') {
      await this.extractZipToDir(archivePath, extractDir)
    } else {
      await this.extractRarToDir(archivePath, extractDir)
    }

    // Nested zip inside RAR
    const topEntries = await fsPromises.readdir(extractDir, { withFileTypes: true })
    const nestedZip = topEntries.find(e => e.isFile() && e.name.toLowerCase().endsWith('.zip'))
    if (nestedZip) {
      this.log(`Found nested .zip ${nestedZip.name}, extracting it first...`)
      const nestedDir = join(tempDir, `nested-${version}`)
      await fsPromises.rm(nestedDir, { recursive: true, force: true }).catch(() => {})
      await fsPromises.mkdir(nestedDir, { recursive: true })
      await this.extractZipToDir(join(extractDir, nestedZip.name), nestedDir)
      await fsPromises.rm(extractDir, { recursive: true, force: true }).catch(() => {})
      // Replace extractDir content with nested
      await fsPromises.rename(nestedDir, extractDir).catch(async () => {
        await copyPassively(nestedDir, extractDir)
        await fsPromises.rm(nestedDir, { recursive: true, force: true }).catch(() => {})
      })
    }

    let source = extractDir
    const entries = await fsPromises.readdir(extractDir, { withFileTypes: true })
    const files = entries.filter(e => e.isFile())
    const subFolders = entries.filter(e => e.isDirectory())

    // Одна папка-обёртка сверху (типичный "сборка/")
    if (subFolders.length === 1 && files.length === 0) {
      source = join(extractDir, subFolders[0].name)
    }

    // Если внутри уже есть mods/ — копируем только её содержимое в modsDir
    const maybeMods = join(source, 'mods')
    try {
      const st = await fsPromises.stat(maybeMods)
      if (st.isDirectory()) {
        this.log(`Archive contains mods/ folder, copying its contents -> ${modsDir}`)
        await copyPassively(maybeMods, modsDir)
        await fsPromises.rm(extractDir, { recursive: true, force: true }).catch(() => {})
        return
      }
    } catch {
      // no mods/ folder inside
    }

    this.log(`Copying archive contents into mods: ${source} -> ${modsDir}`)
    await copyPassively(source, modsDir)
    await fsPromises.rm(extractDir, { recursive: true, force: true }).catch(() => {})
  }

  /**
   * Извлечение .rar архива
   */
  private async extractRarToDir(filePath: string, outputDir: string): Promise<void> {
    try {
      const { createExtractorFromFile } = await import('node-unrar-js')
      const extractor = await createExtractorFromFile({
        filepath: filePath,
        targetPath: outputDir,
        filenameTransform: (name) => name,
      })
      const result = extractor.extract()
      const files = [...result.files]
      this.log(`Extracted ${files.length} files from RAR archive`)
    } catch (e) {
      this.warn(`Failed to extract RAR: ${e}`)
      throw new Error(`Ошибка распаковки RAR: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
}
