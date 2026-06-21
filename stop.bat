@echo off
setlocal
cd /d "%~dp0"
title Logbook - Stop

echo.
echo Logbook System - Stop
echo =====================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop.ps1"
if errorlevel 1 (
    echo.
    echo Stop script reported an error.
    pause
    exit /b 1
)

echo.
pause
exit /b 0
