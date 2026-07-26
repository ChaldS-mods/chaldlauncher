# Java 21 auto + real progress bar (ChaldStudio)

## Файлы
- `xmcl-runtime/chaldstudio/ChaldStudioService.ts`
  - перед скачиванием сборки вызывает `installJava({ majorVersion: 21 })`
  - прогресс task: 0–20 Java, 20–70 скачивание (по байтам), 70–100 распаковка
- `xmcl-keystone-ui/src/views/AppChaldStudioUpdateDialog.vue`
  - полоска % и текст этапа
  - `openDialog()` — открыть то же меню вручную
  - диалог при старте только если версии нет или есть новее (`> 0`)

## Сборка
```powershell
cd $env:USERPROFILE\Desktop\chald-launcher
# скопируй файлы в проект
pnpm build:renderer
pnpm --prefix=xmcl-electron-app run build
```

## Важно
Дополнительно лучше поправить `xmcl-runtime-api/src/util/java.ts`
(exact major = 21), иначе лаунчер может снова выбрать системную Java 26 при запуске игры.
