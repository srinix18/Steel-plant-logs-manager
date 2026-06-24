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

function Test-PostgresPortOpen([int]$Port = 5433) {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $async = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
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

function Get-PostgresPort {
    $dbUrl = $env:DATABASE_URL
    if (-not $dbUrl) {
        $rootEnv = Join-Path $ProjectRoot ".env"
        if (Test-Path $rootEnv) {
            $line = Get-Content $rootEnv | Where-Object { $_ -match '^\s*DATABASE_URL=' } | Select-Object -First 1
            if ($line -match 'DATABASE_URL=(.+)') { $dbUrl = $Matches[1].Trim() }
        }
    }
    $port = 5433
    if ($dbUrl -match ':(\d+)/') { $port = [int]$Matches[1] }
    return $port
}

function Test-WslAvailable {
    if (-not (Test-CommandExists "wsl")) {
        return $false
    }
    wsl -e true 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
}

function Get-WslProjectPath {
    if ($ProjectRoot -match '^([A-Za-z]):\\(.*)$') {
        $drive = $Matches[1].ToLower()
        $rest = ($Matches[2] -replace '\\', '/')
        return "/mnt/$drive/$rest"
    }
    return ($ProjectRoot -replace '\\', '/')
}

function Invoke-WslBash {
    param([string]$Command)
    if ($env:LOGBOOK_WSL_DISTRO) {
        wsl -d $env:LOGBOOK_WSL_DISTRO -e bash -lc $Command
    } else {
        wsl -e bash -lc $Command
    }
}

function Test-DockerEngineInWsl {
    if (-not (Test-WslAvailable)) {
        return $false
    }
    Invoke-WslBash 'docker info >/dev/null 2>&1'
    return $LASTEXITCODE -eq 0
}

function Start-DockerEngineInWsl {
    if (-not (Test-WslAvailable)) {
        return $false
    }

    if (Test-DockerEngineInWsl) {
        return $true
    }

    Write-Step "Docker engine not reachable in WSL - attempting to start..."

    # Native Docker daemon inside WSL (apt install docker.io)
    Invoke-WslBash 'command -v service >/dev/null && sudo service docker start >/dev/null 2>&1'
    Start-Sleep -Seconds 2
    if (Test-DockerEngineInWsl) {
        Write-Ok "Docker engine started in WSL"
        return $true
    }

    # Docker Desktop WSL integration - engine comes from Desktop
    Invoke-WslBash 'command -v docker >/dev/null && docker context ls >/dev/null 2>&1'
    Start-Sleep -Seconds 2
    if (Test-DockerEngineInWsl) {
        Write-Ok "Docker engine reachable in WSL"
        return $true
    }

    Write-Warn "Could not start Docker in WSL. Open Docker Desktop or run: wsl sudo service docker start"
    return $false
}

function Start-DockerPostgres {
    param([int]$Port = 5433)

    if (-not (Test-WslAvailable)) {
        Write-Warn "WSL is not available - falling back to Windows docker compose"
        return Start-DockerPostgresWindows -Port $Port
    }

    if (-not (Start-DockerEngineInWsl)) {
        return $false
    }

    $wslPath = Get-WslProjectPath
    $composeFile = Join-Path $ProjectRoot "docker-compose.yml"
    if (-not (Test-Path $composeFile)) {
        return $false
    }

    Write-Step "Starting PostgreSQL via WSL Docker (localhost:$Port)..."
    $cmd = 'cd ''' + $wslPath + ''' && docker compose up postgres -d'
    Invoke-WslBash $cmd
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "docker compose failed in WSL (exit $LASTEXITCODE)"
        return $false
    }

    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        if (Test-PostgresPortOpen -Port $Port) {
            Write-Ok "PostgreSQL is reachable on localhost:$Port"
            return $true
        }
    }

    return $false
}

function Start-DockerPostgresWindows {
    param([int]$Port = 5433)

    if (-not (Test-CommandExists "docker")) {
        return $false
    }

    $composeFile = Join-Path $ProjectRoot "docker-compose.yml"
    if (-not (Test-Path $composeFile)) {
        return $false
    }

    Write-Step "Starting PostgreSQL via Windows Docker (localhost:$Port)..."
    Push-Location $ProjectRoot
    try {
        & docker compose up postgres -d 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            return $false
        }
    } finally {
        Pop-Location
    }

    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        if (Test-PostgresPortOpen -Port $Port) {
            Write-Ok "PostgreSQL is reachable on localhost:$Port"
            return $true
        }
    }

    return $false
}

function Test-BackendHealthy {
    param([int]$Port = $BackendPort)
    try {
        $resp = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/health" -UseBasicParsing -TimeoutSec 2
        return $resp.StatusCode -eq 200
    } catch {
        return $false
    }
}

function Test-FrontendHealthy {
    param([int]$Port = $FrontendPort)
    try {
        $resp = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 2
        return $resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500
    } catch {
        return $false
    }
}

function Ensure-PostgresRunning {
    $port = Get-PostgresPort

    if (Test-PostgresPortOpen -Port $port) {
        Write-Ok "PostgreSQL already running on localhost:$port (skipping container start)"
        return
    }

    if (Start-DockerPostgres -Port $port) {
        return
    }

    $wslPath = Get-WslProjectPath
    Write-Err "PostgreSQL is not reachable on localhost:$port"
    Write-Host ""
    Write-Host "This project expects Postgres via WSL Docker (port $port in .env)." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  postgres.bat" -ForegroundColor White
    Write-Host "  or in WSL:" -ForegroundColor White
    Write-Host ('    wsl -e bash -lc ''cd ' + $wslPath + ' && docker compose up postgres -d''') -ForegroundColor Gray
    Write-Host ""
    Write-Host "Ensure Docker is running in WSL (Docker Desktop or: wsl sudo service docker start)." -ForegroundColor Yellow
    Write-Host ""
    throw "PostgreSQL is required. Start it using the steps above, then run this script again."
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

function Stop-ProcessTree {
    param([int]$ProcessId)

    if ($ProcessId -le 4) { return }

    Get-CimInstance Win32_Process -Filter "ParentProcessId=$ProcessId" -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-ProcessTree -ProcessId $_.ProcessId }

    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

function Stop-BackendForRestart {
    param([int]$Port = $BackendPort)

    $listeners = @(Get-PortProcessIds -Port $Port)
    foreach ($procId in $listeners) {
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Warn "Stopping backend on port $Port (PID $procId, $($proc.ProcessName))"
        }
        Stop-ProcessTree -ProcessId $procId
    }

    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $_.CommandLine -and (
                $_.CommandLine -match 'uvicorn' -and $_.CommandLine -match 'app\.main:app'
            )
        } |
        ForEach-Object {
            Write-Warn "Stopping uvicorn process (PID $($_.ProcessId))"
            Stop-ProcessTree -ProcessId $_.ProcessId
        }

    for ($i = 0; $i -lt 15; $i++) {
        if ((Get-PortProcessIds -Port $Port).Count -eq 0) {
            if ($listeners.Count -gt 0) {
                Write-Ok "Restarting backend on port $Port"
            }
            return
        }
        Start-Sleep -Milliseconds 400
    }

    throw "Port $Port is still in use. Run .\scripts\stop.ps1 or close the backend window manually."
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

# Returns $true if a new process should be started; $false if the service is already healthy on the port.
function Prepare-ServiceStart {
    param(
        [int]$Port,
        [string]$Label,
        [scriptblock]$HealthCheck
    )

    $pids = Get-PortProcessIds -Port $Port
    if ($pids.Count -eq 0) {
        return $true
    }

    if (& $HealthCheck) {
        Write-Ok "$Label already running on port $Port (skipping new window)"
        return $false
    }

    Stop-PortProcess -Port $Port -Label $Label
    if ((Get-PortProcessIds -Port $Port).Count -eq 0) {
        Write-Ok "Freed port $Port for $Label"
        return $true
    }

    if (& $HealthCheck) {
        Write-Ok "$Label already running on port $Port (skipping new window)"
        return $false
    }

    throw "Port $Port is still in use by another application. Run .\scripts\stop.ps1 or close the process using that port."
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
