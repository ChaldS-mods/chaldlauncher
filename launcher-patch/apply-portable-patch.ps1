$target = Join-Path $env:USERPROFILE "Desktop\chald-launcher\xmcl-electron-app\main\ElectronLauncherApp.ts"
if (-not (Test-Path $target)) { Write-Error "Not found: $target"; exit 1 }
$code = Get-Content $target -Raw -Encoding UTF8
if ($code -match 'install-dir as game root|portable\)') { Write-Host "Already patched"; exit 0 }
$snippet = @'

    // Portable: install-dir as game root (marker file next to exe)
    if (!process.env.XMCL_E2E_APP_DATA && !IS_DEV) {
      try {
        const { existsSync, mkdirSync, writeFileSync } = require('fs') as typeof import('fs')
        const { dirname } = require('path') as typeof import('path')
        const exeDir = dirname(app.getPath('exe'))
        if (existsSync(join(exeDir, 'portable'))) {
          app.setPath('appData', exeDir)
          app.setPath('userData', join(exeDir, 'userData'))
          const cfgDir = join(exeDir, LAUNCHER_NAME)
          mkdirSync(cfgDir, { recursive: true })
          const rootFile = join(cfgDir, 'root')
          if (!existsSync(rootFile)) writeFileSync(rootFile, exeDir, 'utf8')
        }
      } catch { /* ignore */ }
    }

'@
$code2 = [regex]::Replace($code, '(constructor\(\) \{\r?\n)', "`$1$snippet`n", 1)
if ($code2 -eq $code) { Write-Error "Insert failed"; exit 1 }
Set-Content $target $code2 -Encoding UTF8
Write-Host "Patched $target — rebuild electron-app"
