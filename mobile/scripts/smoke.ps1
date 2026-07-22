# Smoke checks for mobile (run after code changes).
$ErrorActionPreference = 'Stop'
$nvmHome = Join-Path $env:LOCALAPPDATA 'nvm'
$nvmLink = 'C:\nvm4w\nodejs'
$env:NVM_HOME = $nvmHome
$env:NVM_SYMLINK = $nvmLink
$env:Path = "$nvmHome;$nvmLink;" + $env:Path

Set-Location $PSScriptRoot\..

Write-Host "== node ==" -ForegroundColor Cyan
& "$nvmLink\node.exe" -v

Write-Host "== unit: api errors ==" -ForegroundColor Cyan
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-api-errors.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== unit: role homes ==" -ForegroundColor Cyan
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-role-homes.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== unit: drawer nav ==" -ForegroundColor Cyan
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-drawer-nav.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== unit: ui primitives ==" -ForegroundColor Cyan
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-ui-primitives.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== demo logins (API if up) ==" -ForegroundColor Cyan
if (Test-Path .env) {
  Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*EXPO_PUBLIC_API_URL\s*=\s*(.+)\s*$') {
      $env:EXPO_PUBLIC_API_URL = $Matches[1].Trim().Trim('"').Trim("'")
    }
  }
}
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-demo-logins.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== tsc ==" -ForegroundColor Cyan
& "$nvmLink\npx.cmd" tsc --noEmit
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== metro export (web) ==" -ForegroundColor Cyan
if (Test-Path dist-smoke) { Remove-Item -Recurse -Force dist-smoke }
& "$nvmLink\npx.cmd" expo export --platform web --output-dir dist-smoke
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Remove-Item -Recurse -Force dist-smoke -ErrorAction SilentlyContinue

Write-Host "SMOKE OK" -ForegroundColor Green
