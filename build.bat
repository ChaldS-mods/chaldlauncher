@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

rem ============================================================
rem  Chald Launcher - build script
rem
rem  Usage:
rem    build.bat            собрать инсталлятор под текущую ОС
rem    build.bat all         собрать под все платформы (win/mac/linux)
rem    build.bat --skip-install   не переустанавливать зависимости
rem
rem  Требования: Node.js >= 22.16, pnpm (npm i -g pnpm), Git.
rem ============================================================

cd /d "%~dp0"

set BUILD_TARGET=default
set SKIP_INSTALL=0

for %%a in (%*) do (
    if /i "%%a"=="all" set BUILD_TARGET=all
    if /i "%%a"=="--skip-install" set SKIP_INSTALL=1
)

echo.
echo === Chald Launcher build ===
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js не найден в PATH. Установи Node.js ^>= 22.16 и повтори.
    exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] pnpm не найден в PATH. Установи его: npm install -g pnpm
    exit /b 1
)

if "%SKIP_INSTALL%"=="0" (
    echo [1/3] Установка зависимостей ^(pnpm install^)...
    call pnpm install
    if errorlevel 1 goto :fail
) else (
    echo [1/3] Пропускаем pnpm install ^(--skip-install^)
)

echo.
echo [2/3] Сборка интерфейса ^(build:renderer^)...
call pnpm run build:renderer
if errorlevel 1 goto :fail

echo.
if "%BUILD_TARGET%"=="all" (
    echo [3/3] Сборка приложения под все платформы ^(build:all^)...
    call pnpm run build:all
) else (
    echo [3/3] Сборка приложения под Windows ^(zip + appx^)...
    set BUILD_TARGET=win
    call pnpm run build
)
if errorlevel 1 goto :fail

echo.
echo === Готово! Файлы установщика лежат в xmcl-electron-app\build\output ===
explorer "xmcl-electron-app\build\output" 2>nul
goto :eof

:fail
echo.
echo [ERROR] Сборка упала, смотри лог выше.
exit /b 1
