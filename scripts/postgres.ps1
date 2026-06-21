. "$PSScriptRoot\common.ps1"

Write-Host ""
Write-Host "Logbook System - PostgreSQL (WSL)" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

$port = Get-PostgresPort

if (Test-PostgresPortOpen -Port $port) {
    Write-Ok "PostgreSQL is already reachable on localhost:$port"
    exit 0
}

if (-not (Test-WslAvailable)) {
    Write-Err "WSL is not installed or not running."
    Write-Host "Install WSL: wsl --install" -ForegroundColor Yellow
    exit 1
}

if (-not (Start-DockerEngineInWsl)) {
    Write-Err "Docker engine is not running in WSL."
    Write-Host ""
    Write-Host "Try one of:" -ForegroundColor Yellow
    Write-Host "  - Start Docker Desktop" -ForegroundColor White
    Write-Host "  - wsl sudo service docker start" -ForegroundColor White
    exit 1
}

if (Start-DockerPostgres -Port $port) {
    exit 0
}

Write-Err "Could not start PostgreSQL container in WSL."
exit 1
