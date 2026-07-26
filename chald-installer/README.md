# chald-installer

Полностью свой инсталлятор ChaldLauncher — не Inno Setup, не NSIS.
Это отдельное маленькое Electron-приложение со своим wizard-интерфейсом
(Welcome → License → Путь установки → Прогресс → Финиш), которое само:

- распаковывает файлы лаунчера в выбранную папку,
- создаёт ярлык на рабочем столе и в меню «Пуск»,
- регистрирует запись в «Установка и удаление программ» Windows,
- умеет чисто удалить лаунчер (`--uninstall`), тем самым являясь и
  установщиком, и деинсталлятором в одном exe.

Дизайн — Fluent 2 / Windows 11 (Mica-полупрозрачность, Segoe UI, бирюзовый
акцент), в одном стиле с самим лаунчером.

## Как это собирается

```
1. pnpm build                     # в xmcl-electron-app: собирает лаунчер
                                   #   в dir-режиме -> build/output/win-unpacked
2. cd chald-installer
   pnpm install
   pnpm pack                      # 1) зовёт prepare-payload.js — зипует
                                   #    win-unpacked в resources/app-payload.zip
                                   # 2) electron-builder пакует сам инсталлятор
                                   #    в один portable exe с payload внутри
```

Результат: `chald-installer/dist/ChaldLauncher-Setup-<version>.exe` —
это и есть готовый установщик, который можно раздавать пользователям.
Никакого интернета во время установки не требуется — весь лаунчер уже
зашит внутрь exe.

## Локальный запуск без сборки (для правки UI мастера)

```
cd chald-installer
pnpm install
node build/prepare-payload.js   # один раз, чтобы был payload для теста
pnpm dev
```

## Структура

```
main/index.js         — Electron main: IPC, распаковка, ярлыки, реестр
renderer/              — сам wizard (HTML/CSS/JS, без фреймворков)
build/electron-builder.config.js — упаковка инсталлятора в portable exe
build/prepare-payload.js         — зипует win-unpacked сборку лаунчера
resources/app-payload.zip        — сюда кладётся зип лаунчера (generated)
```

## Известные ограничения / что доделать под себя

- Ярлыки создаются через VBScript (`wscript`), это штатный Windows-подход
  без лишних npm-зависимостей — работает "из коробки" на любой Windows.
- Регистрация в реестре — через `reg.exe`, пишется в `HKCU`, поэтому
  админ-права не нужны (установка на пользователя, не на всю машину).
  Если нужна установка в `Program Files` для всех пользователей — путь
  по умолчанию и ключ реестра надо переключить на `HKLM` и добавить
  запрос повышения прав (UAC) в `main/index.js`.
- Подпись exe (code signing) сюда не входит — добавьте `signtool`/сертификат
  в `electron-builder.config.js` (`win.certificateFile`) при релизе.
