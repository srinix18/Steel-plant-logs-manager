$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$VenvPython = Join-Path $BackendDir "venv\Scripts\python.exe"
$VenvUvicorn = Join-Path $BackendDir "venv\Scripts\uvicorn.exe"
$BackendPort = 8000
$FrontendPort = 5173

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
    Write-Host "    OK  $Message" -ForegroundColor Green
}

function Write-Warn([string]$Message) {
    Write-Host "    !!  $Message" -ForegroundColor Yellow
}

function Write-Err([string]$Message) {
    Write-Host "    XX  $Message" -ForegroundColor Red
}

function Test-CommandExists([string]$Name) {
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Test-MongoPortOpen {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $async = $client.BeginConnect("127.0.0.1", 27017, $null, $null)
        $ok = $async.AsyncWaitHandle.WaitOne(2000, $false)
        if ($ok -and $client.Connected) {
            $client.Close()
            return $true
        }
        $client.Close()
        return $false
    } catch {
        return $false
    }
}

function Get-PortProcessIds([int]$Port) {
    $pids = @()
    $lines = netstat -ano | Select-String ":$Port\s"
    foreach ($line in $lines) {
        if ($line -match "LISTENING\s+(\d+)\s*$") {
            $pids += [int]$Matches[1]
        }
    }
    return $pids | Select-Object -Unique
}

function Stop-PortProcess([int]$Port, [string]$Label) {
    $pids = Get-PortProcessIds -Port $Port
    if ($pids.Count -eq 0) {
        return
    }

    foreach ($procId in $pids) {
        if ($procId -le 4) { continue }
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if (-not $proc) { continue }
        Write-Warn "Stopping $Label on port $Port (PID $procId, $($proc.ProcessName))"
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }

    Start-Sleep -Seconds 1
}

function Ensure-PortFree([int]$Port, [string]$Label) {
    $pids = Get-PortProcessIds -Port $Port
    if ($pids.Count -eq 0) {
        return
    }
    Stop-PortProcess -Port $Port -Label $Label
    if ((Get-PortProcessIds -Port $Port).Count -gt 0) {
        throw "Port $Port is still in use. Run .\scripts\stop.ps1 or close the app using that port."
    }
    Write-Ok "Freed port $Port for $Label"
}

function Ensure-EnvFiles {
    $rootEnv = Join-Path $ProjectRoot ".env"
    $rootExample = Join-Path $ProjectRoot ".env.example"
    $backendEnv = Join-Path $BackendDir ".env"
    $backendExample = Join-Path $BackendDir ".env.example"
    $frontendEnv = Join-Path $FrontendDir ".env"

    if (-not (Test-Path $rootEnv) -and (Test-Path $rootExample)) {
        Copy-Item $rootExample $rootEnv
        Write-Ok "Created .env from .env.example"
    }

    if (-not (Test-Path $backendEnv)) {
        if (Test-Path $backendExample) {
            Copy-Item $backendExample $backendEnv
        } elseif (Test-Path $rootEnv) {
            Copy-Item $rootEnv $backendEnv
        }
        Write-Ok "Created backend/.env"
    }

    $apiUrl = "http://localhost:$BackendPort/api/v1"
    if (-not (Test-Path $frontendEnv)) {
        "VITE_API_URL=$apiUrl" | Set-Content -Path $frontendEnv -Encoding UTF8
        Write-Ok "Created frontend/.env"
    }
}

function Start-MongoServiceIfInstalled {
    $service = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
    if (-not $service) {
        return $false
    }

    if ($service.Status -ne "Running") {
        Write-Step "Starting MongoDB Windows service..."
        Start-Service MongoDB
        Start-Sleep -Seconds 3
    }

    return $true
}

function Ensure-MongoRunning {
    if (Test-MongoPortOpen) {
        Write-Ok "MongoDB is reachable on localhost:27017"
        return
    }

    if (Start-MongoServiceIfInstalled) {
        Start-Sleep -Seconds 2
        if (Test-MongoPortOpen) {
            Write-Ok "MongoDB service started"
            return
        }
    }

    Write-Err "MongoDB is not running on localhost:27017"
    Write-Host ""
    Write-Host "Install MongoDB (one-time, no Docker required):" -ForegroundColor Yellow
    Write-Host "  .\scripts\install-mongodb.ps1" -ForegroundColor White
    Write-Host ""
    Write-Host "Or manually:" -ForegroundColor Yellow
    Write-Host "  winget install MongoDB.Server" -ForegroundColor White
    Write-Host "  net start MongoDB" -ForegroundColor White
    Write-Host ""
    throw "MongoDB is required. Install it using the command above, then run this script again."
}
