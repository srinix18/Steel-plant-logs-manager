@echo off
title MOI Expo — QR + login (normal flow)
cd /d "%~dp0"

set "NVM_HOME=%LOCALAPPDATA%\nvm"
set "NVM_SYMLINK=C:\nvm4w\nodejs"
set "PATH=%NVM_HOME%;%NVM_SYMLINK%;%PATH%"
set "CI="
set "REACT_NATIVE_PACKAGER_HOSTNAME=10.119.123.130"

echo.
echo  .env API URL:
findstr EXPO_PUBLIC_API_URL .env
echo.
echo  Must be http://10.119.123.130:8000/api/v1  (NOT localhost)
echo  Starting with --clear so phone picks up that URL...
echo.

"%NVM_SYMLINK%\npx.cmd" expo start --lan --clear
pause
