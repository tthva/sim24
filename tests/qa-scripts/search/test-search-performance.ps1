# ============================
# SIM24 — Search Performance Test
# ============================
# Measures cold vs warm cache search performance.
# Reports p50/p95 latency for both scenarios.
# ============================

$BASE = "http://localhost:3000"
$PASS = 0
$FAIL = 0
$coldTimes = @()
$warmTimes = @()

function Test-Step {
    param($Name, $Script)
    try {
        & $Script
        Write-Host "  ✅ $Name" -ForegroundColor Green
        $script:PASS++
    } catch {
        Write-Host "  ❌ $Name : $_" -ForegroundColor Red
        $script:FAIL++
    }
}

function Measure-Request {
    param($Url, $Times)
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $res = Invoke-WebRequest -Uri $Url -SkipHttpErrorCheck -UseBasicParsing
    $sw.Stop()
    $times += $sw.Elapsed.TotalMilliseconds
    return @{ Response = $res; Time = $sw.Elapsed.TotalMilliseconds; Times = $times }
}

function Get-Percentile {
    param($Times, $Percentile)
    $sorted = $Times | Sort-Object
    $index = [math]::Max(0, [math]::Ceiling(($Percentile / 100) * $sorted.Count) - 1)
    return $sorted[$index]
}

Write-Host "`n═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Search Performance Test" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════`n" -ForegroundColor Cyan

# Step 1: Cold cache (first request after server start)
Write-Host "📌 Step 1: Cold Cache (no-cache header)" -ForegroundColor Yellow
$searchUrl = "$BASE/api/search?limit=10&sortBy=newest"

for ($i = 0; $i -lt 3; $i++) {
    $result = Measure-Request -Url "$searchUrl&_t=$([DateTime]::Now.Ticks)" -Times $coldTimes
    $coldTimes = $result.Times
    $cacheHeader = $result.Response.Headers["X-Cache"]
    Write-Host "  Request $($i+1): $([math]::Round($result.Time, 1))ms (X-Cache: $cacheHeader)" -ForegroundColor Gray
}

# Step 2: Warm cache (same params)
Write-Host "`n📌 Step 2: Warm Cache (same request, expect X-Cache: HIT)" -ForegroundColor Yellow
$warmUrl = "$BASE/api/search?limit=10&sortBy=newest"

for ($i = 0; $i -lt 5; $i++) {
    Start-Sleep -Milliseconds 100
    $result = Measure-Request -Url $warmUrl -Times $warmTimes
    $warmTimes = $result.Times
    $cacheHeader = $result.Response.Headers["X-Cache"]
    Write-Host "  Request $($i+1): $([math]::Round($result.Time, 1))ms (X-Cache: $cacheHeader)" -ForegroundColor Gray
}

# Step 3: Filtered search
Write-Host "`n📌 Step 3: Filtered search" -ForegroundColor Yellow
$filterUrl = "$BASE/api/search?formType=buy_direct&status=active&limit=5"
$filterResult = Measure-Request -Url $filterUrl -Times @()
Write-Host "  Filtered search: $([math]::Round($filterResult.Time, 1))ms" -ForegroundColor Gray

# Step 4: Pattern search
Write-Host "`n📌 Step 4: Pattern search" -ForegroundColor Yellow
$patternUrl = "$BASE/api/search?pattern=test&limit=5"
$patternResult = Measure-Request -Url $patternUrl -Times @()
Write-Host "  Pattern search: $([math]::Round($patternResult.Time, 1))ms" -ForegroundColor Gray

# Calculate percentiles
Write-Host "`n═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Performance Summary" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════`n" -ForegroundColor Cyan

if ($coldTimes.Count -gt 0) {
    $coldP50 = Get-Percentile -Times $coldTimes -Percentile 50
    $coldP95 = Get-Percentile -Times $coldTimes -Percentile 95
    $coldAvg = ($coldTimes | Measure-Object -Average).Average
    Write-Host "Cold Cache:" -ForegroundColor Yellow
    Write-Host "  Count: $($coldTimes.Count), Avg: $([math]::Round($coldAvg, 1))ms, P50: $([math]::Round($coldP50, 1))ms, P95: $([math]::Round($coldP95, 1))ms"
}

if ($warmTimes.Count -gt 0) {
    $warmP50 = Get-Percentile -Times $warmTimes -Percentile 50
    $warmP95 = Get-Percentile -Times $warmTimes -Percentile 95
    $warmAvg = ($warmTimes | Measure-Object -Average).Average
    Write-Host "`nWarm Cache:" -ForegroundColor Yellow
    Write-Host "  Count: $($warmTimes.Count), Avg: $([math]::Round($warmAvg, 1))ms, P50: $([math]::Round($warmP50, 1))ms, P95: $([math]::Round($warmP95, 1))ms"
}

# Summary
Write-Host "`n═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Results: $PASS passed, $FAIL failed" -ForegroundColor $(if ($FAIL -eq 0) { "Green" } else { "Red" })
Write-Host "═══════════════════════════════════════`n" -ForegroundColor Cyan

if ($FAIL -gt 0) { exit 1 } else { exit 0 }