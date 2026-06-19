. "$PSScriptRoot\common.ps1"

Write-Host ""
Write-Host "Logbook System - MongoDB Installer" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

if (Test-MongoPortOpen) {
    Write-Ok "MongoDB is already running on localhost:27017"
    exit 0
}

if (Start-MongoServiceIfInstalled) {
    Start-Sleep -Seconds 2
    if (Test-MongoPortOpen) {
        Write-Ok "MongoDB service is running"
        exit 0
    }
}

if (-not (Test-CommandExists "winget")) {
    Write-Err "winget is not available."
    Write-Host ""
    Write-Host "Install MongoDB manually:" -ForegroundColor Yellow
    Write-Host "  1. Download: https://www.mongodb.com/try/download/community" -ForegroundColor White
    Write-Host "  2. Run the installer (choose 'Install as a Service')" -ForegroundColor White
    Write-Host "  3. Run: net start MongoDB" -ForegroundColor White
    exit 1
}

Write-Step "Installing MongoDB Community Server via winget..."
Write-Host "    This may open an admin prompt. Approve if asked." -ForegroundColor Gray
Write-Host ""

winget install MongoDB.Server --accept-package-agreements --accept-source-agreements

Write-Step "Starting MongoDB service..."
try {
    Start-Service MongoDB -ErrorAction Stop
} catch {
    Write-Warn "Could not start MongoDB service automatically."
    Write-Host "Try running as Administrator: net start MongoDB" -ForegroundColor Yellow
}

Start-Sleep -Seconds 3

if (Test-MongoPortOpen) {
    Write-Ok "MongoDB installed and running on localhost:27017"
    Write-Host ""
    Write-Host "Next step:" -ForegroundColor Green
    Write-Host "  .\scripts\start.ps1" -ForegroundColor White
} else {
    Write-Err "MongoDB installed but not reachable yet."
    Write-Host "Try: net start MongoDB" -ForegroundColor Yellow
    Write-Host "Then: .\scripts\start.ps1" -ForegroundColor Yellow
    exit 1
}
