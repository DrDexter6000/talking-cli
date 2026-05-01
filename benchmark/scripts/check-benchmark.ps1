<#
.SYNOPSIS
    Check benchmark run status and return summary.
    
.USAGE
    .\check-benchmark.ps1 -OutputDir "results/full-run-minimax-2026-04-22"
    .\check-benchmark.ps1 -FlagFile "results/full-run-minimax/done.flag"
#>

param(
    [string]$OutputDir = "",
    [string]$FlagFile = "",
    [switch]$Watch     # Continuously poll until done
)

$ErrorActionPreference = "SilentlyContinue"

# ── Resolve paths ─────────────────────────────────────────────────────────
if ($FlagFile -ne "" -and ![System.IO.Path]::IsPathRooted($FlagFile)) {
    $FlagFile = Join-Path $PSScriptRoot $FlagFile
}
if ($OutputDir -ne "" -and ![System.IO.Path]::IsPathRooted($OutputDir)) {
    $OutputDir = Join-Path $PSScriptRoot $OutputDir
}

if ($FlagFile -eq "" -and $OutputDir -ne "") {
    $FlagFile = Join-Path $OutputDir "done.flag"
}

# ── Status function ───────────────────────────────────────────────────────
function Get-BenchmarkStatus {
    param($Dir, $Flag)
    
    $status = [PSCustomObject]@{
        State = "UNKNOWN"
        Progress = ""
        Results = 0
        Total = 50
        PassRate = ""
        LogTail = @()
        Elapsed = ""
    }
    
    # Check flag file
    if (Test-Path $Flag) {
        $flagContent = Get-Content $Flag -Raw
        if ($flagContent -match "^DONE") {
            $status.State = "DONE"
        } elseif ($flagContent -match "^FAILED") {
            $status.State = "FAILED"
        } elseif ($flagContent -match "^RUNNING") {
            $status.State = "RUNNING"
        }
        
        # Extract elapsed time
        if ($flagContent -match "start=([^\n]+)" -and $flagContent -match "end=([^\n]+)") {
            $start = [DateTime]::Parse($Matches[1])
            $end = [DateTime]::Parse($Matches[2])
            $elapsed = $end - $start
            $status.Elapsed = "{0:0}m {1:0}s" -f $elapsed.TotalMinutes, $elapsed.Seconds
        } elseif ($flagContent -match "start=([^\n]+)") {
            $start = [DateTime]::Parse($Matches[1])
            $elapsed = (Get-Date) - $start
            $status.Elapsed = "{0:0}m {1:0}s (still running)" -f $elapsed.TotalMinutes, $elapsed.Seconds
        }
    }
    
    # Count results
    $resultsFile = Join-Path $Dir "results.jsonl"
    if (Test-Path $resultsFile) {
        $lines = (Get-Content $resultsFile | Measure-Object).Count
        $status.Results = $lines
        $status.Progress = "$lines/50 ({0:P0})" -f ($lines / 50)
        
        # Compute pass rate
        if ($lines -gt 0) {
            $results = Get-Content $resultsFile | ConvertFrom-Json
            $passed = ($results | Where-Object { $_.pass -eq $true }).Count
            $status.PassRate = "{0}/{1} ({2:P0})" -f $passed, $lines, ($passed / $lines)
        }
    }
    
    # Get log tail
    $logFile = Join-Path $Dir "benchmark.log"
    if (Test-Path $logFile) {
        $status.LogTail = Get-Content $logFile | Select-Object -Last 5
    }
    
    return $status
}

# ── Main ──────────────────────────────────────────────────────────────────
if ($Watch) {
    while ($true) {
        $s = Get-BenchmarkStatus -Dir $OutputDir -Flag $FlagFile
        Clear-Host
        Write-Host "Benchmark Monitor"
        Write-Host "=================="
        Write-Host "State:     $($s.State)"
        Write-Host "Progress:  $($s.Progress)"
        Write-Host "Pass Rate: $($s.PassRate)"
        Write-Host "Elapsed:   $($s.Elapsed)"
        Write-Host ""
        Write-Host "Recent Log:"
        $s.LogTail | ForEach-Object { Write-Host "  $_" }
        
        if ($s.State -eq "DONE" -or $s.State -eq "FAILED") { break }
        Start-Sleep 30
    }
} else {
    $s = Get-BenchmarkStatus -Dir $OutputDir -Flag $FlagFile
    
    Write-Host "State:     $($s.State)"
    Write-Host "Progress:  $($s.Progress)"
    Write-Host "Pass Rate: $($s.PassRate)"
    Write-Host "Elapsed:   $($s.Elapsed)"
    Write-Host "Results:   $($s.Results) files"
    
    if ($s.LogTail.Count -gt 0) {
        Write-Host ""
        Write-Host "Recent Log:"
        $s.LogTail | ForEach-Object { Write-Host "  $_" }
    }
}
