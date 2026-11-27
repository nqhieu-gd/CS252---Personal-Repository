<#
.SYNOPSIS
    Single-command launcher for WanderLingo (CS252 Lab 07).
    Builds the React frontend (if dist/index.html is missing or -Rebuild is passed),
    starts the FastAPI + py-googletrans server on http://127.0.0.1:8000,
    and automatically opens the default web browser once the server is ready.
#>
param(
    [switch]$Rebuild,
    [switch]$NoBrowser,
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $RootDir "backend"
$FrontendDir = Join-Path $RootDir "frontend"
$DistIndex = Join-Path $FrontendDir "dist\index.html"
$VenvPython = Join-Path $BackendDir ".venv\Scripts\python.exe"
$AppUrl = "http://127.0.0.1:$Port"

if (-not (Test-Path $VenvPython)) {
    Write-Host "[WanderLingo] Creating isolated Python virtual environment..." -ForegroundColor Cyan
    python -m venv (Join-Path $BackendDir ".venv")
    & (Join-Path $BackendDir ".venv\Scripts\pip.exe") install -r (Join-Path $BackendDir "requirements.txt")
}

$NeedsBuild = $Rebuild -or -not (Test-Path $DistIndex)
if (-not $NeedsBuild) {
    $DistTime = (Get-Item $DistIndex).LastWriteTimeUtc
    $NewerSrc = Get-ChildItem -Path (Join-Path $FrontendDir "src"), (Join-Path $FrontendDir "index.html") -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTimeUtc -gt $DistTime } |
        Select-Object -First 1
    if ($null -ne $NewerSrc) {
        Write-Host "[WanderLingo] Detected newer frontend source files; rebuilding dist/..." -ForegroundColor Yellow
        $NeedsBuild = $true
    }
}

if ($NeedsBuild) {
    Write-Host "[WanderLingo] Building React + TypeScript frontend..." -ForegroundColor Cyan
    Push-Location $FrontendDir
    if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
        npm.cmd install
    }
    if (Test-Path "node_modules\esbuild\install.js") {
        node "node_modules\esbuild\install.js"
    }
    npm.cmd run build
    Pop-Location
}

Write-Host "[WanderLingo] Starting FastAPI + py-googletrans server at $AppUrl" -ForegroundColor Green
Write-Host "[WanderLingo] OpenAPI / Swagger Docs: $AppUrl/docs" -ForegroundColor Yellow

$BrowserJob = $null
if (-not $NoBrowser) {
    Write-Host "[WanderLingo] Your default browser will open $AppUrl automatically once ready..." -ForegroundColor Cyan
    $BrowserJob = Start-Job -ScriptBlock {
        param($TargetUrl)
        $HealthUrl = "$TargetUrl/api/health"
        for ($i = 0; $i -lt 40; $i++) {
            Start-Sleep -Milliseconds 300
            try {
                $resp = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop
                if ($resp.StatusCode -eq 200) {
                    Start-Process $TargetUrl
                    break
                }
            } catch {
                # Server still starting up
            }
        }
    } -ArgumentList $AppUrl
}

$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONPATH = $BackendDir
Set-Location $BackendDir
try {
    & $VenvPython -m uvicorn app.main:app --host 127.0.0.1 --port $Port
} finally {
    if ($null -ne $BrowserJob) {
        Remove-Job -Job $BrowserJob -Force -ErrorAction SilentlyContinue
    }
}
