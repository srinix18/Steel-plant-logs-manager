param(
    [switch]$SkipPostgresCheck
)

. "$PSScriptRoot\common.ps1"

Write-Host ""
Write-Host "Logbook System - Setup" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan

Write-Step "Checking prerequisites"

if (-not (Test-CommandExists "python")) {
    throw "Python not found. Install Python 3.12+ from https://www.python.org/downloads/"
}
Write-Ok "Python: $(python --version)"

if (-not (Test-CommandExists "node")) {
    throw "Node.js not found. Install Node.js 20+ from https://nodejs.org/"
}
Write-Ok "Node.js: $(node --version)"

Write-Step "Creating environment files"
Ensure-EnvFiles

Write-Step "Setting up Python backend"
Push-Location $BackendDir
try {
    if (-not (Test-Path $VenvPython)) {
        python -m venv venv
        Write-Ok "Created Python virtual environment"
    } else {
        Write-Ok "Python virtual environment already exists"
    }

    & $VenvPython -m pip install --upgrade pip | Out-Null
    & $VenvPython -m pip install -r requirements.txt
    Write-Ok "Backend dependencies installed"
} finally {
    Pop-Location
}

Write-Step "Setting up React frontend"
Push-Location $FrontendDir
try {
    if (-not (Test-Path "node_modules")) {
        npm install
        Write-Ok "Frontend dependencies installed"
    } else {
        Write-Ok "Frontend dependencies already installed"
    }
} finally {
    Pop-Location
}

if (-not $SkipPostgresCheck) {
    Write-Step "Checking PostgreSQL"
    try {
        Ensure-PostgresRunning
    } catch {
        Write-Warn $_.Exception.Message
        Write-Host ""
        Write-Host "Setup completed except PostgreSQL. Start Postgres, then run:" -ForegroundColor Yellow
        Write-Host "  docker compose up postgres -d" -ForegroundColor White
        Write-Host "  .\scripts\start.ps1" -ForegroundColor White
        exit 1
    }
}

Write-Host ""
Write-Host "Setup complete! Start the app with:" -ForegroundColor Green
Write-Host "  .\scripts\start.ps1" -ForegroundColor White
Write-Host "  or double-click start.bat" -ForegroundColor White
Write-Host ""
