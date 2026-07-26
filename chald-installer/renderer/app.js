const steps = {}
document.querySelectorAll('.step').forEach((el) => { steps[el.dataset.step] = el })

function show(name) {
  Object.values(steps).forEach((el) => el.classList.add('hidden'))
  steps[name].classList.remove('hidden')
}

document.getElementById('btn-min').onclick = () => window.installer.minimize()
document.getElementById('btn-close').onclick = () => window.installer.close()

document.querySelectorAll('[data-next]').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.disabled) return
    show(btn.dataset.next)
  })
})

// themes
let selectedTheme = 'teal'
document.querySelectorAll('.theme-card').forEach((card) => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.theme-card').forEach((c) => c.classList.remove('active'))
    card.classList.add('active')
    selectedTheme = card.dataset.theme
    document.body.setAttribute('data-theme', selectedTheme)
    try { localStorage.setItem('chald-setup-theme', selectedTheme) } catch (_) {}
  })
})
try {
  const t = localStorage.getItem('chald-setup-theme')
  if (t) {
    selectedTheme = t
    document.body.setAttribute('data-theme', t)
    document.querySelectorAll('.theme-card').forEach((c) => {
      c.classList.toggle('active', c.dataset.theme === t)
    })
  }
} catch (_) {}

const agree = document.getElementById('agree')
const licenseNext = document.getElementById('btn-license-next')
agree.addEventListener('change', () => { licenseNext.disabled = !agree.checked })

const installPathInput = document.getElementById('install-path')
let installDir = ''

document.getElementById('btn-browse').addEventListener('click', async () => {
  const chosen = await window.installer.chooseFolder()
  if (chosen) {
    installDir = chosen
    installPathInput.value = installDir
  }
})

window.installer.onProgress(({ progress, label }) => {
  const fill = document.getElementById('progress-fill')
  const uninstallFill = document.getElementById('uninstall-fill')
  if (fill && !steps.progress.classList.contains('hidden')) {
    fill.style.width = progress + '%'
    document.getElementById('progress-percent').textContent = progress + '%'
    document.getElementById('progress-label').textContent = label
  }
  if (uninstallFill && !steps['uninstall-progress'].classList.contains('hidden')) {
    uninstallFill.style.width = progress + '%'
    document.getElementById('uninstall-label').textContent = label
  }
})

document.getElementById('btn-install').addEventListener('click', async () => {
  show('progress')
  try {
    const result = await window.installer.start({
      installDir: installPathInput.value || installDir,
      createDesktopShortcut: document.getElementById('opt-desktop').checked,
      createStartMenuShortcut: document.getElementById('opt-startmenu').checked,
      launchAfter: document.getElementById('opt-launch').checked,
      theme: selectedTheme,
    })
    installDir = result.installDir
    show('finish')
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e)
    document.getElementById('progress-label').textContent = 'Ошибка установки'
    document.getElementById('progress-percent').textContent = '!'
    alert('Установка не удалась:\n\n' + msg)
    show('path')
  }
})

document.getElementById('btn-open-folder').addEventListener('click', () => {
  window.installer.openFolder(installDir)
})
document.getElementById('btn-finish').addEventListener('click', () => window.installer.close())

document.getElementById('btn-cancel-uninstall').addEventListener('click', () => window.installer.close())
document.getElementById('btn-confirm-uninstall').addEventListener('click', async () => {
  show('uninstall-progress')
  await window.installer.uninstall()
  show('uninstall-finish')
})
document.getElementById('btn-close-uninstall').addEventListener('click', () => window.installer.close())

window.installer.bootstrap().then((info) => {
  if (info.mode === 'uninstall') {
    show('uninstall')
  } else {
    installDir = info.defaultDir
    installPathInput.value = installDir
    show('welcome')
  }
})
