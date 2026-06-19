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
        & "$PSScriptRoot\setup.ps1" -SkipMongoCheck
    }
}

Ensure-EnvFiles
Ensure-MongoRunning

Write-Step "Preparing ports"
Ensure-PortFree -Port $BackendPort -Label "backend"
Ensure-PortFree -Port $FrontendPort -Label "frontend"

Write-Step "Starting backend (http://localhost:$BackendPort)"
$backendCmd = "Set-Location '$BackendDir'; & '$VenvUvicorn' app.main:app --reload --host 127.0.0.1 --port $BackendPort"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd | Out-Null
Write-Ok "Backend starting in new window"

Start-Sleep -Seconds 2

Write-Step "Starting frontend (http://localhost:$FrontendPort)"
$frontendCmd = "Set-Location '$FrontendDir'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd | Out-Null
Write-Ok "Frontend starting in new window"

Write-Host ""
Write-Host "App is starting!" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend:  http://localhost:$FrontendPort" -ForegroundColor White
Write-Host "  Backend:   http://localhost:$BackendPort" -ForegroundColor White
Write-Host "  API Docs:  http://localhost:$BackendPort/docs" -ForegroundColor White
Write-Host ""
Write-Host "  Login:     admin@logbook.app / admin123" -ForegroundColor White
Write-Host ""
Write-Host "Two terminal windows were opened for backend and frontend." -ForegroundColor Gray
Write-Host "Close those windows to stop the app." -ForegroundColor Gray
Write-Host ""
