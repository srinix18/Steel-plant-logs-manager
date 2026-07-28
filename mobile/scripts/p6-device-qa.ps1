# P6-DEVICE-QA preflight — checklist doc + route inventory + LOGINS API matrix.
$ErrorActionPreference = 'Stop'
$nvmHome = Join-Path $env:LOCALAPPDATA 'nvm'
$nvmLink = 'C:\nvm4w\nodejs'
$env:NVM_HOME = $nvmHome
$env:NVM_SYMLINK = $nvmLink
$env:Path = "$nvmHome;$nvmLink;" + $env:Path

Set-Location $PSScriptRoot\..

$script:SmokeApiUrl = $null
$candidates = @('http://127.0.0.1:8000/api/v1')
if (Test-Path .env) {
  Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*EXPO_PUBLIC_API_URL\s*=\s*(.+)\s*$') {
      $candidates += $Matches[1].Trim().Trim('"').Trim("'")
    }
  }
}
foreach ($u in ($candidates | Select-Object -Unique)) {
  $base = ($u -replace '/api/v1/?$', '')
  try {
    $null = Invoke-WebRequest -Uri "$base/docs" -TimeoutSec 2 -UseBasicParsing
    $script:SmokeApiUrl = $u.TrimEnd('/')
    break
  } catch {}
}
if (-not $script:SmokeApiUrl) { $script:SmokeApiUrl = $candidates[0] }
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl

Write-Host "=== P6-DEVICE-QA PREFLIGHT ===" -ForegroundColor Cyan
Write-Host "Doc: docs/MOBILE_P6_DEVICE_QA.md"
Write-Host "API URL: $($script:SmokeApiUrl)" -ForegroundColor DarkGray
Write-Host ""

Write-Host "== unit: device QA inventory ==" -ForegroundColor Cyan
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-device-qa.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== unit: role homes ==" -ForegroundColor Cyan
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-role-homes.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== API: all LOGINS.md accounts ==" -ForegroundColor Cyan
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-demo-logins.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "=== P6-DEVICE-QA CHECKLIST ===" -ForegroundColor Green
Write-Host "[x] docs/MOBILE_P6_DEVICE_QA.md created (login + Plan 2-5 happy paths)"
Write-Host "[x] Automated route inventory (test-device-qa.ts)"
Write-Host "[x] Automated API login matrix (test-demo-logins.ts) when API up"
Write-Host "[ ] Physical Expo Go: tick Phone columns in MOBILE_P6_DEVICE_QA.md sections A-C"
Write-Host "[ ] Physical sign-off row in section E"
Write-Host ""
Write-Host "Next chunk: P6-SEC" -ForegroundColor Green
Write-Host "On device: cd mobile; .\start.ps1 - use LAN IP from print-lan-ip.ps1" -ForegroundColor DarkGray
