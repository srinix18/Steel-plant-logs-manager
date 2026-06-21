. "$PSScriptRoot\common.ps1"

Write-Host ""
Write-Host "Logbook System - Stop" -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Cyan

Write-Step "Stopping app processes"
Stop-PortProcess -Port $BackendPort -Label "backend"
Stop-PortProcess -Port $FrontendPort -Label "frontend"

Write-Ok "Stopped backend and frontend (if they were running)"
Write-Host ""
$wslPath = Get-WslProjectPath
Write-Host "PostgreSQL was left running (WSL Docker container or local service)." -ForegroundColor Gray
Write-Host "To stop WSL Docker Postgres:" -ForegroundColor Gray
Write-Host ('  wsl -e bash -lc ''cd ' + $wslPath + ' && docker compose stop postgres''') -ForegroundColor Gray
Write-Host ""
