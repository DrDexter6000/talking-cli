# Builds both MCP server variants (mute + talking)
$ErrorActionPreference = "Stop"
$serversRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "=== Building benchmark MCP servers ===" -ForegroundColor Cyan

Write-Host "`n[1/3] Installing dependencies..." -ForegroundColor Yellow
Set-Location $serversRoot
npm install --ignore-scripts
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

Write-Host "`n[2/3] Building mute variant..." -ForegroundColor Yellow
Set-Location "$serversRoot\variants\mute"
npx tsc --project tsconfig.json
if ($LASTEXITCODE -ne 0) { throw "Mute build failed" }

Write-Host "`n[3/3] Building talking variant..." -ForegroundColor Yellow
Set-Location "$serversRoot\variants\talking"
npx tsc --project tsconfig.json
if ($LASTEXITCODE -ne 0) { throw "Talking build failed" }

Write-Host "`n=== Both variants built successfully ===" -ForegroundColor Green
Write-Host "  mute:    benchmark/servers/variants/mute/dist/index.js"
Write-Host "  talking: benchmark/servers/variants/talking/dist/index.js"
Set-Location $serversRoot
