FIX: ENOENT chmod app.asar при установке (Windows + adm-zip)

Замени файлы в chald-installer:
  main/index.js
  renderer/app.js

Потом:
  1) Удали частично установленное:
     Remove-Item "$env:LOCALAPPDATA\Programs\ChaldLauncher" -Recurse -Force -ErrorAction SilentlyContinue
  2) Убедись что есть payload:
     cd chald-installer
     node .\build\prepare-payload.js
  3) Тест:
     npm run dev
  4) Релиз:
     npm run pack

Что изменено:
- Больше НЕ используется extractEntryTo / chmod (ломало app.asar на Windows)
- Распаковка через getData() + writeFileSync + mkdir recursive
- Нормализация путей zip (\/)
- Понятная ошибка если нет ChaldLauncher.exe после распаковки
- UI ловит ошибку и не зависает на 50%
