# Interactive Expo start with LAN QR (for Expo Go on phone).
$ErrorActionPreference = 'Stop'
$nvmHome = Join-Path $env:LOCALAPPDATA 'nvm'
$nvmLink = 'C:\nvm4w\nodejs'
$env:NVM_HOME = $nvmHome
$env:NVM_SYMLINK = $nvmLink
$env:Path = "$nvmHome;$nvmLink;" + $env:Path

# Wi-Fi LAN IP so the QR points at this PC, not localhost
$env:REACT_NATIVE_PACKAGER_HOSTNAME = '10.119.123.130'

Set-Location $PSScriptRoot

Write-Host "Using $(node -v)" -ForegroundColor Cyan
Write-Host "Packager host: $env:REACT_NATIVE_PACKAGER_HOSTNAME" -ForegroundColor Yellow
Write-Host "API: check .env EXPO_PUBLIC_API_URL" -ForegroundColor Yellow
Write-Host "If Expo asks to log in -> Proceed anonymously" -ForegroundColor Green
Write-Host ""

& "$nvmLink\npx.cmd" expo start --lan
