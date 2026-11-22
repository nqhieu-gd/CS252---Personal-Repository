<#
.SYNOPSIS
    Single-command launcher for WanderLingo (CS252 Lab 07).
    Builds the React frontend (if dist/index.html is missing or -Rebuild is passed)
    and starts the FastAPI + py-googletrans server on http://127.0.0.1:8000.
#>
param(
    [switch]$Rebuild,
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $RootDir "backend"
$FrontendDir = Join-Path $RootDir "frontend"
$DistIndex = Join-Path $FrontendDir "dist\index.html"
$VenvPython = Join-Path $BackendDir ".venv\Scripts\python.exe"

if (-not (Test-Path $VenvPython)) {
    Write-Host "[WanderLingo] Creating isolated Python virtual environment..." -ForegroundColor Cyan
    python -m venv (Join-Path $BackendDir ".venv")
    & (Join-Path $BackendDir ".venv\Scripts\pip.exe") install -r (Join-Path $BackendDir "requirements.txt")
}

if ($Rebuild -or -not (Test-Path $DistIndex)) {
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

Write-Host "[WanderLingo] Starting FastAPI + py-googletrans server at http://127.0.0.1:$Port" -ForegroundColor Green
Write-Host "[WanderLingo] OpenAPI / Swagger Docs: http://127.0.0.1:$Port/docs" -ForegroundColor Yellow
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONPATH = $BackendDir
Set-Location $BackendDir
& $VenvPython -m uvicorn app.main:app --host 127.0.0.1 --port $Port
