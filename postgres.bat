@echo off
setlocal
cd /d "%~dp0"
title Logbook - PostgreSQL (WSL)

echo.
echo Logbook System - Start PostgreSQL via WSL Docker
echo =================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\postgres.ps1"
if errorlevel 1 (
    echo.
    echo Failed to start PostgreSQL.
    pause
    exit /b 1
)

echo.
pause
exit /b 0
