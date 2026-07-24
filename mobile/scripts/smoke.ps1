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

Write-Host "== unit: buildCardSteps ==" -ForegroundColor Cyan
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-build-card-steps.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== unit: section adapters ==" -ForegroundColor Cyan
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-section-adapters.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== unit: process options ==" -ForegroundColor Cyan
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-process-options.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== unit: formula engine ==" -ForegroundColor Cyan
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-formula-engine.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== unit: heat workflow UI ==" -ForegroundColor Cyan
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-heat-workflow-ui.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== unit: AOD gas from blow ==" -ForegroundColor Cyan
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-aod-gas-blow.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== unit: CCM casting cells ==" -ForegroundColor Cyan
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-ccm-casting-cells.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== profile API (if up) ==" -ForegroundColor Cyan
if (Test-Path .env) {
  Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*EXPO_PUBLIC_API_URL\s*=\s*(.+)\s*$') {
      $env:EXPO_PUBLIC_API_URL = $Matches[1].Trim().Trim('"').Trim("'")
    }
  }
}
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-profile-api.ts
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

Write-Host "== run host API (if up) ==" -ForegroundColor Cyan
if (Test-Path .env) {
  Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*EXPO_PUBLIC_API_URL\s*=\s*(.+)\s*$') {
      $env:EXPO_PUBLIC_API_URL = $Matches[1].Trim().Trim('"').Trim("'")
    }
  }
}
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-run-host-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== shift launcher API (if up) ==" -ForegroundColor Cyan
if (Test-Path .env) {
  Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*EXPO_PUBLIC_API_URL\s*=\s*(.+)\s*$') {
      $env:EXPO_PUBLIC_API_URL = $Matches[1].Trim().Trim('"').Trim("'")
    }
  }
}
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-shift-launcher-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== IAF lifecycle API (if up) ==" -ForegroundColor Cyan
if (Test-Path .env) {
  Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*EXPO_PUBLIC_API_URL\s*=\s*(.+)\s*$') {
      $env:EXPO_PUBLIC_API_URL = $Matches[1].Trim().Trim('"').Trim("'")
    }
  }
}
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-iaf-lifecycle-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== AOD lifecycle API (if up) ==" -ForegroundColor Cyan
if (Test-Path .env) {
  Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*EXPO_PUBLIC_API_URL\s*=\s*(.+)\s*$') {
      $env:EXPO_PUBLIC_API_URL = $Matches[1].Trim().Trim('"').Trim("'")
    }
  }
}
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-aod-lifecycle-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== CCM lifecycle API (if up) ==" -ForegroundColor Cyan
if (Test-Path .env) {
  Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*EXPO_PUBLIC_API_URL\s*=\s*(.+)\s*$') {
      $env:EXPO_PUBLIC_API_URL = $Matches[1].Trim().Trim('"').Trim("'")
    }
  }
}
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-ccm-lifecycle-api.ts
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
