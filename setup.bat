@echo off
setlocal
cd /d "%~dp0"
title Logbook - Setup

echo.
echo Logbook System - Setup
echo ======================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup.ps1"
if errorlevel 1 (
    echo.
    echo Setup failed. See messages above.
    pause
    exit /b 1
)

echo.
pause
exit /b 0
