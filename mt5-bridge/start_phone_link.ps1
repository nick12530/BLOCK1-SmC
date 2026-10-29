$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $projectRoot

foreach ($command in @('npm', 'py', 'tailscale')) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        throw "Required command '$command' was not found. Install Node.js, Python, and Tailscale, then run this script again."
    }
}

if ((Test-NetConnection 127.0.0.1 -Port 8000 -WarningAction SilentlyContinue).TcpTestSucceeded) {
    throw 'Port 8000 is already in use. Close the existing MT5 bridge window before starting another one.'
}
if ((Test-NetConnection 127.0.0.1 -Port 4173 -WarningAction SilentlyContinue).TcpTestSucceeded) {
    throw 'Port 4173 is already in use. Close the existing dashboard preview window before starting another one.'
}

if (-not (Test-Path (Join-Path $projectRoot 'node_modules'))) {
    Write-Host 'Installing dashboard dependencies...'
    & npm install --legacy-peer-deps
    if ($LASTEXITCODE -ne 0) { throw 'Dashboard dependency installation failed.' }
}

& py -c 'import fastapi, uvicorn, MetaTrader5' *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Installing MT5 bridge dependencies...'
    & py -m pip install -r (Join-Path $PSScriptRoot 'requirements.txt')
    if ($LASTEXITCODE -ne 0) { throw 'MT5 bridge dependency installation failed.' }
}

Write-Host 'Building the dashboard...'
& npm run build
if ($LASTEXITCODE -ne 0) { throw 'Dashboard build failed.' }

$env:SMC_BRIDGE_TOKEN = (& py -c 'import secrets; print(secrets.token_urlsafe(32))').Trim()
if (-not $env:SMC_BRIDGE_TOKEN) { throw 'Could not create a private bridge token.' }

Start-Process powershell.exe `
    -WorkingDirectory $projectRoot `
    -ArgumentList @('-NoExit', '-Command', 'py .\mt5-bridge\server.py') | Out-Null

$bridgeReady = $false
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    try {
        $headers = @{ Authorization = "Bearer $env:SMC_BRIDGE_TOKEN" }
        $null = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/ping' -Headers $headers -TimeoutSec 2
        $bridgeReady = $true
        break
    } catch {
        Start-Sleep -Seconds 1
    }
}
if (-not $bridgeReady) {
    throw 'The MT5 bridge did not become ready. Confirm MT5 Desktop is open and logged in; inspect the bridge PowerShell window for details.'
}

Start-Process powershell.exe `
    -WorkingDirectory $projectRoot `
    -ArgumentList @('-NoExit', '-Command', 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort') | Out-Null

$dashboardReady = $false
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    try {
        $null = Invoke-WebRequest -Uri 'http://127.0.0.1:4173/' -TimeoutSec 2
        $dashboardReady = $true
        break
    } catch {
        Start-Sleep -Seconds 1
    }
}
if (-not $dashboardReady) { throw 'The dashboard preview did not start. Inspect its PowerShell window for details.' }

& tailscale serve --bg 4173
if ($LASTEXITCODE -ne 0) { throw 'Tailscale Serve could not publish the dashboard. Confirm Tailscale is signed in on this PC.' }

Write-Host ''
Write-Host 'MT5 bridge and dashboard are running. Keep their PowerShell windows open.'
Write-Host 'Open the private HTTPS address below on your phone while Tailscale is connected:'
& tailscale serve status
