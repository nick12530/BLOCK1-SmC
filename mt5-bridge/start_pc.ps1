param(
    [switch]$RestartBridge = $false
)

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $projectRoot

# Preload bridge security token from AppData if present
$basePath = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { $env:USERPROFILE }
$tokenFile = Join-Path $basePath "SMCBridge\bridge_token.txt"
if (Test-Path $tokenFile) {
    try {
        $loadedToken = (Get-Content $tokenFile -Raw).Trim()
        if ($loadedToken) {
            $env:SMC_BRIDGE_TOKEN = $loadedToken
            Write-Host "Loaded bridge security token from $tokenFile"
        }
    } catch {}
}

foreach ($command in @('npm', 'py')) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        throw "Required command '$command' was not found. Install Node.js and Python, then run this script again."
    }
}

if (-not (Test-Path (Join-Path $projectRoot 'node_modules'))) {
    throw 'Dashboard dependencies are missing. Run npm install from the project folder, then retry.'
}

& py -c 'import fastapi, uvicorn, MetaTrader5' *> $null
if ($LASTEXITCODE -ne 0) {
    throw 'MT5 bridge dependencies are missing. Run py -m pip install -r .\mt5-bridge\requirements.txt, then retry.'
}

if (-not $env:FINNHUB_API_KEY) {
    Write-Host 'Using the public Forex Factory calendar feed; Finnhub fallback is not configured.'
}

function Get-AvailableLoopbackPort {
    param(
        [int]$PreferredPort,
        [int]$RangeSize = 100
    )

    for ($port = $PreferredPort; $port -lt ($PreferredPort + $RangeSize); $port++) {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
        try {
            $listener.Start()
            return $port
        } catch [System.Net.Sockets.SocketException] {
        } finally {
            $listener.Stop()
        }
    }

    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    try {
        $listener.Start()
        return ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
    } finally {
        $listener.Stop()
    }
}

$bridgeStartPort = 8000
if ($env:SMC_BRIDGE_PORT -match '^\d+$' -and [int]$env:SMC_BRIDGE_PORT -ge 1024 -and [int]$env:SMC_BRIDGE_PORT -le 65435) {
    $bridgeStartPort = [int]$env:SMC_BRIDGE_PORT
}
$dashboardStartPort = 4173
if ($env:SMC_DASHBOARD_PORT -match '^\d+$' -and [int]$env:SMC_DASHBOARD_PORT -ge 1024 -and [int]$env:SMC_DASHBOARD_PORT -le 65435) {
    $dashboardStartPort = [int]$env:SMC_DASHBOARD_PORT
}
$reuseBridge = $false
if (-not $RestartBridge) {
    try {
        $existingBridge = Invoke-RestMethod -Uri "http://127.0.0.1:$bridgeStartPort/ping" -TimeoutSec 1
        if ($existingBridge.status -eq 'ok' -and $null -ne $existingBridge.connected) {
            $env:SMC_BRIDGE_PORT = [string]$bridgeStartPort
            $reuseBridge = $true
            Write-Host "Reusing the active MT5 bridge on port $bridgeStartPort."
        }
    } catch {
    }
}
if (-not $reuseBridge) {
    $env:SMC_BRIDGE_PORT = [string](Get-AvailableLoopbackPort -PreferredPort $bridgeStartPort)
}
$env:SMC_DASHBOARD_PORT = [string](Get-AvailableLoopbackPort -PreferredPort $dashboardStartPort)

Write-Host 'Building the optimized dashboard...'
& npm run build
if ($LASTEXITCODE -ne 0) { throw 'Dashboard build failed.' }

if (-not $reuseBridge) {
    $bridgeEnvCmd = "`$env:SMC_BRIDGE_PORT='$($env:SMC_BRIDGE_PORT)'; "
    if ($env:SMC_BRIDGE_TOKEN) {
        $bridgeEnvCmd += "`$env:SMC_BRIDGE_TOKEN='$($env:SMC_BRIDGE_TOKEN)'; "
    }
    Start-Process powershell.exe `
        -WorkingDirectory $projectRoot `
        -ArgumentList @('-NoExit', '-Command', "$bridgeEnvCmd py .\mt5-bridge\server.py") | Out-Null
}

$bridgeReady = $false
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    try {
        $null = Invoke-RestMethod -Uri "http://127.0.0.1:$($env:SMC_BRIDGE_PORT)/ping" -TimeoutSec 2
        $bridgeReady = $true
        break
    } catch {
        Start-Sleep -Seconds 1
    }
}
if (-not $bridgeReady) {
    throw 'The local MT5 bridge did not become ready. Inspect its PowerShell window and confirm MT5 Desktop is running.'
}

$previewEnvCmd = "`$env:SMC_BRIDGE_PORT='$($env:SMC_BRIDGE_PORT)'; "
if ($env:SMC_BRIDGE_TOKEN) {
    $previewEnvCmd += "`$env:SMC_BRIDGE_TOKEN='$($env:SMC_BRIDGE_TOKEN)'; "
}
Start-Process powershell.exe `
    -WorkingDirectory $projectRoot `
    -ArgumentList @('-NoExit', '-Command', "$previewEnvCmd npm run preview -- --host 127.0.0.1 --port $($env:SMC_DASHBOARD_PORT) --strictPort") | Out-Null

$dashboardUrl = "http://127.0.0.1:$($env:SMC_DASHBOARD_PORT)/"
$dashboardReady = $false
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    try {
        $null = Invoke-WebRequest -Uri $dashboardUrl -TimeoutSec 2 -UseBasicParsing
        $dashboardReady = $true
        break
    } catch {
        Start-Sleep -Seconds 1
    }
}
if (-not $dashboardReady) { throw 'The dashboard did not start. Inspect its PowerShell window for details.' }

Write-Host ''
Write-Host 'The PC-local MT5 bridge and optimized dashboard are running.'
Write-Host 'Keep both PowerShell windows open while using the terminal.'
Write-Host "MT5 bridge: http://127.0.0.1:$($env:SMC_BRIDGE_PORT)"
Write-Host "Dashboard: $dashboardUrl"
Start-Process $dashboardUrl
