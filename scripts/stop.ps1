. "$PSScriptRoot\common.ps1"

Write-Host ""
Write-Host "Logbook System - Stop" -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Cyan

Write-Step "Stopping app processes"
Stop-PortProcess -Port $BackendPort -Label "backend"
Stop-PortProcess -Port $FrontendPort -Label "frontend"

Write-Ok "Stopped backend and frontend (if they were running)"
Write-Host ""
Write-Host "MongoDB was left running (shared system service)." -ForegroundColor Gray
Write-Host ""
