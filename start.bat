@echo off
setlocal
cd /d "%~dp0"
title Logbook - Start

echo.
echo Logbook System - Start
echo ======================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start.ps1"
if errorlevel 1 (
    echo.
    echo Start failed. See messages above.
    echo.
    echo If backend/frontend ports are busy, run stop.bat first.
    echo If PostgreSQL is not running, run postgres.bat.
    pause
    exit /b 1
)

exit /b 0
