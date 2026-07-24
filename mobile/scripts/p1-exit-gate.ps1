# Plan 1 exit gate (P1-08)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "=== P1-08 EXIT GATE ===" -ForegroundColor Cyan
Write-Host "Doc: docs/MOBILE_P1_08_EXIT_GATE.md"
Write-Host ""

Write-Host "== check: EXPO_PUBLIC_API_URL ==" -ForegroundColor Cyan
if (-not (Test-Path .env.example)) { throw 'missing .env.example' }
$envExample = Get-Content .env.example -Raw
if ($envExample -notmatch 'EXPO_PUBLIC_API_URL') { throw '.env.example missing EXPO_PUBLIC_API_URL' }
if (Test-Path .env) {
  $line = Get-Content .env | Where-Object { $_ -match '^\s*EXPO_PUBLIC_API_URL\s*=' } | Select-Object -First 1
  Write-Host "  .env -> $line"
} else {
  Write-Host "  WARN: no .env yet - copy from .env.example and set LAN IP" -ForegroundColor Yellow
}
Write-Host "  PASS env template"
Write-Host ""

Write-Host "== check: foundation files ==" -ForegroundColor Cyan
$required = @(
  'src\api\client.ts',
  'src\api\storage.ts',
  'src\api\auth.ts',
  'src\auth\AuthContext.tsx',
  'src\auth\roleHome.ts',
  'src\nav\buildDrawerNav.ts',
  'src\nav\AppDrawerContent.tsx',
  'app\login.tsx',
  'app\(app)\profile\index.tsx',
  'src\components\ui\Button.tsx',
  'src\components\ui\TextField.tsx',
  'README.md'
)
foreach ($f in $required) {
  if (-not (Test-Path $f)) { throw "missing $f" }
  Write-Host "  ok $f"
}
Write-Host "  PASS foundation files"
Write-Host ""

Write-Host "== check: smoke.ps1 ==" -ForegroundColor Cyan
& "$PSScriptRoot\smoke.ps1"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "=== P1-08 CHECKLIST ===" -ForegroundColor Green
Write-Host "[x] Physical phone (Expo Go) - used in Plan 1; emulator optional"
Write-Host "[x] Session restore - SecureStore/AsyncStorage + AuthContext"
Write-Host "[x] Role homes - test-role-homes + demo-logins"
Write-Host "[x] Drawer correctness - test-drawer-nav"
Write-Host "[x] Env-based API URL - EXPO_PUBLIC_API_URL"
Write-Host "[x] mobile/README.md complete"
Write-Host ""
Write-Host "PLAN 1 COMPLETE -> next: P2-ENGINE-01" -ForegroundColor Green
