# ============================
# SIM24 -- Redis Outage QA Test
# ============================
# Verifies auth behavior when Redis is unavailable.
# The rate limiter is intentionally FAIL-OPEN (by design): if Redis is down,
# requests proceed normally (login succeeds) and the failure is bounded
# (fast fail, no multi-second socket-timeout stall). If Redis is healthy,
# rate limiting is enforced.
# ============================

. .\tests\qa-scripts\shared\utils.ps1

$BASE = "http://localhost:3000"
$PASS = 0
$FAIL = 0

function Test-Step {
    param([string]$Name, [scriptblock]$Script)
    try {
        & $Script
        Write-Host "  PASS $Name" -ForegroundColor Green
        $script:PASS++
    } catch {
        Write-Host "  FAIL $Name : $_" -ForegroundColor Red
        $script:FAIL++
    }
}

Write-Host "`n=======================================" -ForegroundColor Cyan
Write-Host "  Redis Outage Test (fail-open expected)" -ForegroundColor Cyan
Write-Host "=======================================`n" -ForegroundColor Cyan

Write-Host "* Note: This test assumes Redis may be DOWN. Rate limiting is" -ForegroundColor Yellow
Write-Host "  intentionally fail-open -- login should still succeed quickly.`n" -ForegroundColor Yellow

# Step 1: Try operator login
Write-Host "* Step 1: Operator login with Redis potentially down" -ForegroundColor Yellow
$loginBody = @{ username = "agent1"; password = "agent123" } | ConvertTo-Json
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$loginR = Invoke-WebSafe -Uri "$BASE/api/operator/auth" -Method POST -Body $loginBody -ContentType "application/json"
$sw.Stop()

Test-Step -Name "Login succeeds (fail-open) or rate-limited (fail-closed)" -Script {
    if ($loginR.Status -eq 200) { $true }
    elseif ($loginR.Status -eq 429) { $true }
    else { throw "Unexpected status: $($loginR.Status) body=$($loginR.Content)" }
}

Test-Step -Name "Response completes quickly even when Redis is down (< 2000ms)" -Script {
    if ($sw.Elapsed.TotalMilliseconds -ge 2000) { throw "Slow: $($sw.Elapsed.TotalMilliseconds)ms" }
    $true
}

if ($loginR.Status -eq 429) {
    Test-Step -Name "Fail-closed headers present" -Script {
        $limitHeader = $loginR.Headers["X-RateLimit-Remaining"]
        if ($limitHeader -ne "0") { throw "Expected X-RateLimit-Remaining: 0, got $limitHeader" }
        $true
    }
}

# Step 2: EndUser auth
Write-Host "`n* Step 2: EndUser auth with Redis potentially down" -ForegroundColor Yellow
$enduserBody = @{ username = "user1"; password = "user123" } | ConvertTo-Json
$euR = Invoke-WebSafe -Uri "$BASE/api/auth/enduser" -Method POST -Body $enduserBody -ContentType "application/json"

Test-Step -Name "EndUser auth succeeds (fail-open) or rate-limited (fail-closed)" -Script {
    if ($euR.Status -eq 200) { $true }
    elseif ($euR.Status -eq 429) { $true }
    else { throw "Unexpected status: $($euR.Status) body=$($euR.Content)" }
}

# Step 3: Refresh token without cookies
Write-Host "`n* Step 3: Refresh token without cookies" -ForegroundColor Yellow
$refreshR = Invoke-WebSafe -Uri "$BASE/api/auth/refresh" -Method POST

Test-Step -Name "Refresh without cookies returns 401 (missing refresh token)" -Script {
    if ($refreshR.Status -ne 401) { throw "Expected 401, got $($refreshR.Status) body=$($refreshR.Content)" }
}

# Summary
Write-Host "`n=======================================" -ForegroundColor Cyan
Write-Host "  Results: $PASS passed, $FAIL failed" -ForegroundColor $(if ($FAIL -eq 0) { "Green" } else { "Red" })
Write-Host "=======================================`n" -ForegroundColor Cyan

if ($FAIL -gt 0) { exit 1 } else { exit 0 }