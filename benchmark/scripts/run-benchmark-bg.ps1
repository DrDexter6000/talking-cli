<#
.SYNOPSIS
    Run benchmark in background with completion tracking.
    
.DESCRIPTION
    Wraps the benchmark CLI to run as a fire-and-forget background process.
    Writes progress to a log file and creates a done.flag file on completion.
    Agent can poll the flag file to detect completion without blocking.
    
.USAGE
    .\run-benchmark-bg.ps1 -Provider minimax -OutputDir "results/full-run-minimax"
    .\run-benchmark-bg.ps1 -Provider deepseek -Parallel -MaxConcurrency 3 -Resume
    
.EXAMPLE
    # Start in background, then poll:
    $job = .\run-benchmark-bg.ps1 -Provider minimax -Parallel
    while (!(Test-Path $job.FlagFile)) { Start-Sleep 30 }
    Get-Content $job.LogFile | Select-Object -Last 5
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$Provider,
    
    [string]$OutputDir = "",
    [int]$MaxConcurrency = 3,
    [switch]$Parallel,
    [switch]$Resume,
    [int]$TaskLimit = 0,
    [string]$Variants = "",
    
    # Internal: set by the script itself when launching in background
    [switch]$InnerRun
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot

# ── Compute output directory ──────────────────────────────────────────────
if ($OutputDir -eq "") {
    $today = Get-Date -Format "yyyy-MM-dd"
    $OutputDir = Join-Path $PSScriptRoot "results\full-run-$Provider-$today"
}
if (![System.IO.Path]::IsPathRooted($OutputDir)) {
    $OutputDir = Join-Path $PSScriptRoot $OutputDir
}

# ── Compute flag/log paths ────────────────────────────────────────────────
$flagFile = Join-Path $OutputDir "done.flag"
$logFile = Join-Path $OutputDir "benchmark.log"
$pidFile = Join-Path $OutputDir "benchmark.pid"
$errorLogFile = Join-Path $OutputDir "benchmark-err.log"

# ── If this is the outer call, launch self in background ──────────────────
if (!$InnerRun) {
    # Clean stale flags from previous runs
    if (!$Resume -and (Test-Path $flagFile)) {
        Remove-Item $flagFile -Force
    }
    
    # Build the argument list for inner invocation
    $innerArgs = @(
        "-Provider", $Provider,
        "-OutputDir", $OutputDir,
        "-MaxConcurrency", $MaxConcurrency,
        "-InnerRun"
    )
    if ($Parallel) { $innerArgs += "-Parallel" }
    if ($Resume)   { $innerArgs += "-Resume" }
    if ($TaskLimit -gt 0) { $innerArgs += "-TaskLimit", $TaskLimit }
    if ($Variants -ne "") { $innerArgs += "-Variants", $Variants }
    
    # Launch background process
    $proc = Start-Process -FilePath "pwsh.exe" `
        -ArgumentList (@("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $PSCommandPath) + $innerArgs) `
        -WindowStyle Hidden `
        -PassThru
    
    # Return info object for caller
    [PSCustomObject]@{
        ProcessId  = $proc.Id
        FlagFile   = $flagFile
        LogFile    = $logFile
        ErrorLog   = $errorLogFile
        OutputDir  = $OutputDir
        Command    = "provider=$Provider parallel=$Parallel concurrency=$MaxConcurrency resume=$Resume"
    }
    
    # Write PID for external monitoring
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    Set-Content -Path $pidFile -Value $proc.Id
    return
}

# ══════════════════════════════════════════════════════════════════════════
# INNER RUN - actual benchmark execution
# ══════════════════════════════════════════════════════════════════════════

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
Set-Content -Path $pidFile -Value $PID

# Write start marker
$startTime = Get-Date -Format "o"
Set-Content -Path $flagFile -Value "RUNNING`nstart=$startTime`nprovider=$Provider`npid=$PID"

# Build CLI arguments
$cliArgs = @("--provider", $Provider, "--output-dir", $OutputDir, "--max-concurrency", $MaxConcurrency)
if ($Parallel) { $cliArgs += "--parallel" }
if ($Resume)   { $cliArgs += "--resume" }
if ($TaskLimit -gt 0) { $cliArgs += "--limit", $TaskLimit }
if ($Variants -ne "") { $cliArgs += "--variants", $Variants }

try {
    # Run the benchmark
    $env:CI = "true"
    & npx tsx (Join-Path $PSScriptRoot "cli.ts") @cliArgs `
        2>&1 | Tee-Object -FilePath $logFile | Out-Null
    
    # Write completion flag
    $endTime = Get-Date -Format "o"
    $exitCode = $LASTEXITCODE
    Set-Content -Path $flagFile -Value @"
DONE
exitcode=$exitCode
start=$startTime
end=$endTime
provider=$Provider
output=$OutputDir
"@
}
catch {
    $endTime = Get-Date -Format "o"
    $errorMsg = $_.Exception.Message
    Set-Content -Path $flagFile -Value @"
FAILED
start=$startTime
end=$endTime
provider=$Provider
error=$errorMsg
"@
    # Also write to error log
    Add-Content -Path $errorLogFile -Value "[$endTime] FATAL: $errorMsg"
}
finally {
    # Clean up PID file
    if (Test-Path $pidFile) { Remove-Item $pidFile -Force }
}
