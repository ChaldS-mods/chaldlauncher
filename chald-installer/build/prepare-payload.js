const fs = require("fs")
const path = require("path")
const AdmZip = require("adm-zip")

const installerRoot = path.join(__dirname, "..")
const projectRoot = path.join(installerRoot, "..")

const candidates = [
  path.join(projectRoot, "xmcl-electron-app", "build", "output", "win-unpacked"),
  path.join(projectRoot, "xmcl-electron-app", "build", "output", "win-ia32-unpacked"),
  path.join(projectRoot, "xmcl-electron-app", "build", "output", "win-arm64-unpacked"),
]

const sourceDir = candidates.find((c) => fs.existsSync(c))
if (!sourceDir) {
  console.error("Не найдена собранная сборка лаунчера. Ожидались папки:")
  candidates.forEach((c) => console.error("  - " + c))
  console.error("Сначала выполните: pnpm --prefix=xmcl-electron-app run build:all")
  process.exit(1)
}

const outDir = path.join(installerRoot, "resources")
fs.mkdirSync(outDir, { recursive: true })
const outZip = path.join(outDir, "app-payload.zip")

console.log("Упаковываю: " + sourceDir)
console.log("       ->   " + outZip)

const zip = new AdmZip()
zip.addLocalFolder(sourceDir)
zip.writeZip(outZip)

console.log("Готово: " + fs.statSync(outZip).size + " байт")
