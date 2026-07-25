# Ensures nvm Node is on PATH, then starts Expo.
$ErrorActionPreference = 'Stop'
$nvmHome = Join-Path $env:LOCALAPPDATA 'nvm'
$nvmLink = 'C:\nvm4w\nodejs'

if (-not (Test-Path (Join-Path $nvmLink 'node.exe'))) {
  Write-Host "Node not found at $nvmLink. Run: nvm use 22.14.0" -ForegroundColor Red
  exit 1
}

$env:NVM_HOME = $nvmHome
$env:NVM_SYMLINK = $nvmLink
$env:Path = "$nvmHome;$nvmLink;" + $env:Path

Write-Host "Using $(node -v) from $nvmLink"
Write-Host "API from .env will be baked into the bundle (EXPO_PUBLIC_API_URL)." -ForegroundColor Cyan
if (Test-Path (Join-Path $PSScriptRoot '.env')) {
  Get-Content (Join-Path $PSScriptRoot '.env') | Where-Object { $_ -match 'EXPO_PUBLIC_API_URL' } | ForEach-Object {
    Write-Host "  $_" -ForegroundColor Yellow
  }
}
Set-Location $PSScriptRoot
# Use npx.cmd so PowerShell does not pick a stale AppData\Roaming\npm\npx.ps1
& "$nvmLink\npx.cmd" expo start @args
