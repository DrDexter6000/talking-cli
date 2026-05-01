# Real-world benchmark runner for server-memory
#
# Usage:
#   .\benchmark\real-world\scripts\run-memory-benchmark.ps1
#   .\benchmark\real-world\scripts\run-memory-benchmark.ps1 -Provider glm-5.1
#   .\benchmark\real-world\scripts\run-memory-benchmark.ps1 -Provider glm-5.1 -Limit 3
#   .\benchmark\real-world\scripts\run-memory-benchmark.ps1 -Provider stub -Variants mute

param(
    [string]$Provider = "glm-5.1",
    [int]$Limit = 0,
    [string]$Variants = "full-skill+mute,lean-skill+talking",
    [int]$MaxTurns = 20,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot ".." ".." "..")

# Ensure benchmark is built
$BenchmarkDist = Join-Path $ProjectRoot "benchmark" "dist"
if (-not (Test-Path $BenchmarkDist)) {
    Write-Host "Building benchmark infrastructure..." -ForegroundColor Yellow
    Push-Location $ProjectRoot
    npm run benchmark:build
    Pop-Location
    if (-not (Test-Path $BenchmarkDist)) {
        Write-Error "Failed to build benchmark. Run 'npm run benchmark:build' manually."
        exit 1
    }
}

# Build CLI arguments
$cliArgs = @(
    "benchmark/real-world/cli.mjs",
    "--provider", $Provider,
    "--variants", $Variants,
    "--max-turns", $MaxTurns
)

if ($Limit -gt 0) {
    $cliArgs += @("--limit", $Limit)
}

if ($Verbose) {
    $cliArgs += "--verbose"
}

# Check API key for non-stub providers
if ($Provider -ne "stub") {
    $envMap = @{
        "glm-5.1"    = "ZHIPU_API_KEY"
        "deepseek"   = "DEEPSEEK_API_KEY"
        "openai"     = "OPENAI_API_KEY"
        "minimax"    = "MINIMAX_API_KEY"
        "gemini"     = "GEMINI_API_KEY"
    }
    $requiredKey = $envMap[$Provider]
    if ($requiredKey -and -not (Get-ChildItem Env:$requiredKey -ErrorAction SilentlyContinue)) {
        Write-Error "Provider '$Provider' requires environment variable $requiredKey"
        exit 1
    }
}

Write-Host ""
Write-Host "Running server-memory benchmark with provider: $Provider" -ForegroundColor Cyan
Write-Host "Variants: $Variants | Max turns: $MaxTurns" -ForegroundColor Cyan
if ($Limit -gt 0) { Write-Host "Task limit: $Limit" -ForegroundColor Cyan }
Write-Host ""

# Run the CLI
Push-Location $ProjectRoot
node @cliArgs
$exitCode = $LASTEXITCODE
Pop-Location

if ($exitCode -ne 0) {
    Write-Error "Benchmark failed with exit code $exitCode"
    exit $exitCode
}

Write-Host ""
Write-Host "Benchmark complete!" -ForegroundColor Green
