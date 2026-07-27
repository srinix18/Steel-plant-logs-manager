# Smoke checks for mobile (run after code changes).
$ErrorActionPreference = 'Stop'
$nvmHome = Join-Path $env:LOCALAPPDATA 'nvm'
$nvmLink = 'C:\nvm4w\nodejs'
$env:NVM_HOME = $nvmHome
$env:NVM_SYMLINK = $nvmLink
$env:Path = "$nvmHome;$nvmLink;" + $env:Path

Set-Location $PSScriptRoot\..

# Prefer reachable API (localhost first, then .env LAN URL).
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
  $base = ($u -replace '/api/v1/?$','')
  try {
    $null = Invoke-WebRequest -Uri "$base/docs" -TimeoutSec 2 -UseBasicParsing
    $script:SmokeApiUrl = $u.TrimEnd('/')
    break
  } catch {}
}
if (-not $script:SmokeApiUrl) { $script:SmokeApiUrl = $candidates[0] }
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
Write-Host "API URL: $($script:SmokeApiUrl)" -ForegroundColor DarkGray

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

Write-Host "== unit: RMILL card steps ==" -ForegroundColor Cyan
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-rmill-card-steps.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== unit: WFURN coils ==" -ForegroundColor Cyan
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-wfurn-coils.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== unit: WDRAW drawing ==" -ForegroundColor Cyan
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-wdraw-drawing.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== unit: BBAR register ==" -ForegroundColor Cyan
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-bbar-register.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== unit: PEEL blocked ==" -ForegroundColor Cyan
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-peel-blocked.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== unit: GRIND register ==" -ForegroundColor Cyan
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-grind-register.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== unit: DEPT shells ==" -ForegroundColor Cyan
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-dept-shells.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== reports (unit + API if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-reports-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== profile API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-profile-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== demo logins (API if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-demo-logins.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== run host API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-run-host-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== shift launcher API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-shift-launcher-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== my runs API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-my-runs-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== supervisor issue API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-supervisor-issue-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== hod overview (unit) ==" -ForegroundColor Cyan
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-hod-overview.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== safety scan API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-safety-scan-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== safety dashboard API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-safety-dashboard-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== safety lists API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-safety-lists-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== maint queue API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-maint-queue-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== maint dashboard API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-maint-dashboard-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== maint WO list API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-maint-wo-list-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== WO exec API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-wo-exec-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== maint PM list API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-maint-pm-list-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== PM wizard API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-pm-wizard-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== messages inbox API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-messages-inbox-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== messages alerts API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-messages-alerts-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== messages compose API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-messages-compose-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== workforce dashboard API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-wf-dash-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== workforce employees API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-wf-emp-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== workforce contractors API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-wf-con-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== workforce shift assignments API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-wf-assign-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== workforce roster publish API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-roster-publish-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== workforce attendance API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-wf-att-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== workforce handover API (if up) ==" -ForegroundColor Cyan
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-wf-hand-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== workforce leave API (if up) ==" -ForegroundColor Cyan
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-wf-leave-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== workforce skills API ==" -ForegroundColor Cyan
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-wf-skill-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== workforce training API ==" -ForegroundColor Cyan
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-wf-train-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== workforce payroll API ==" -ForegroundColor Cyan
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-wf-pay-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== workforce salary API ==" -ForegroundColor Cyan
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-wf-sal-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== workforce my-attendance API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-wf-my-att-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== workforce my-leave API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-wf-my-leave-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== workforce my-pay API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-wf-my-pay-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== pulse plant API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-pulse-plant-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== pulse department API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-pulse-dept-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== pulse asset API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-pulse-asset-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== asset workspace API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-asset-workspace-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== energy API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-energy-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== inventory pulse API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-inventory-pulse-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== foundation assets API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-foundation-assets-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== foundation masters API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-foundation-masters-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== foundation observations API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-foundation-obs-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== foundation corrective-actions API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-foundation-ca-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== foundation documents API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-foundation-docs-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== foundation KPI API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-foundation-kpi-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== finance dashboard API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-finance-dash-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== finance cost-sheet API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-finance-sheet-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== finance masters API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-finance-masters-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== finance mapping API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-finance-map-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== finance calculations API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-finance-calc-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== finance analytics API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-finance-an-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== admin home API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-admin-home-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== admin organisations API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-admin-org-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== admin departments API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-admin-dept-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== admin sheets API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-admin-sheets-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== admin activity API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-admin-act-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== admin users API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-admin-users-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== executive home API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-exe-home-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== executive employees API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-exe-emp-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== EAS config (P6-EAS) ==" -ForegroundColor Cyan
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-eas.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== offline draft queue (P6-OFFLINE) ==" -ForegroundColor Cyan
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-offline.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== IAF lifecycle API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-iaf-lifecycle-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== AOD lifecycle API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-aod-lifecycle-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== CCM lifecycle API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-ccm-lifecycle-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== RMILL lifecycle API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-rmill-lifecycle-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== WFURN lifecycle API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-wfurn-lifecycle-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== WDRAW lifecycle API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-wdraw-lifecycle-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== BBAR lifecycle API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-bbar-lifecycle-api.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== GRIND lifecycle API (if up) ==" -ForegroundColor Cyan
$env:EXPO_PUBLIC_API_URL = $script:SmokeApiUrl
& "$nvmLink\node.exe" --experimental-strip-types .\scripts\test-grind-lifecycle-api.ts
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
