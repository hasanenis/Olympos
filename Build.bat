@echo off
title 🔨 Quartz Build Bot
echo.
echo ⚙️ Quartz build baslatiliyor...
echo.

REM Script'in calistigi dizine gec
cd /d "%~dp0"

REM Quartz sync calistir
npx quartz sync

IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ Build basarisiz oldu!
    pause
    exit /b 1
)

echo.
echo ✅ Build tamamlandi!
pause
