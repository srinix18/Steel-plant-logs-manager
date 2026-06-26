param(
    [switch]$SkipSetup
)

. "$PSScriptRoot\common.ps1"

Write-Host ""
Write-Host "Logbook System - Start" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan

if (-not $SkipSetup) {
    if (-not (Test-Path $VenvPython) -or -not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
        Write-Step "First run detected - running setup..."
        & "$PSScriptRoot\setup.ps1" -SkipPostgresCheck
    }
}

Ensure-EnvFiles
Ensure-PostgresRunning

if (Test-Path $VenvPython) {
    Write-Step "Syncing backend dependencies"
    & $VenvPython -m pip install -r (Join-Path $BackendDir "requirements.txt") -q
    Write-Ok "Backend dependencies up to date"
}

Write-Step "Preparing ports"
Stop-BackendForRestart -Port $BackendPort
$startFrontend = Prepare-ServiceStart -Port $FrontendPort -Label "frontend" -HealthCheck { Test-FrontendHealthy -Port $FrontendPort }

Write-Step "Starting backend (http://localhost:$BackendPort)"
$backendCmd = "Set-Location '$BackendDir'; & '$VenvUvicorn' app.main:app --reload --host 127.0.0.1 --port $BackendPort"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd | Out-Null
Write-Ok "Backend starting in new window"
Start-Sleep -Seconds 2

if ($startFrontend) {
    Write-Step "Starting frontend (http://localhost:$FrontendPort)"
    $frontendCmd = "Set-Location '$FrontendDir'; npm run dev"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd | Out-Null
    Write-Ok "Frontend starting in new window"
} else {
    Write-Ok "Using existing frontend at http://localhost:$FrontendPort"
}

Write-Host ""
Write-Host "App is starting!" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend:  http://localhost:$FrontendPort" -ForegroundColor White
Write-Host "  Backend:   http://localhost:$BackendPort" -ForegroundColor White
Write-Host "  API Docs:  http://localhost:$BackendPort/docs" -ForegroundColor White
Write-Host ""
Write-Host "  Admin:     admin@logbook.app / admin123" -ForegroundColor White
Write-Host "  Worker:    melter@chandansteel.com / worker123" -ForegroundColor White
Write-Host ""
if ($startFrontend) {
    Write-Host "A new frontend window was opened." -ForegroundColor Gray
} else {
    Write-Host "Frontend was already running and was left as-is." -ForegroundColor Gray
}
Write-Host "Close backend/frontend windows to stop the app, or run stop.bat." -ForegroundColor Gray
Write-Host ""
