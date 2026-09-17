# ============================
# SIM24 â€” EndUser Refresh Token QA Script
# ============================
# Scenarios:
# 1. Login as user1 â†’ get token + refresh_token
# 2. Call protected endpoint â†’ 200
# 3. Refresh token â†’ get new tokens
# 4. Call protected endpoint with new token â†’ 200
# 5. Revoke session â†’ call protected endpoint â†’ 401
#
# NOTE: Cookie-carrying steps require PowerShell 7+ (or an HTTP client such as
# Node/curl that transmits cookies correctly). On Windows PowerShell 5.1
# (.NET Framework) the HTTP cookie layer silently drops cookies, so
# refresh/rotation assertions will fail with a clear message â€” the actual
# server behavior is verified end-to-end by node_e2e.mjs.
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

Write-Host '`n=======================================' -ForegroundColor Cyan
Write-Host '  EndUser Refresh Token QA Test' -ForegroundColor Cyan
Write-Host '=======================================`n' -ForegroundColor Cyan

# Step 1: Login as user1
Write-Host 'ðŸ“Œ Step 1: Login as user1' -ForegroundColor Yellow
$loginBody = @{ username = "user1"; password = "user123" } | ConvertTo-Json
$loginR = Invoke-WebSafe -Uri "$BASE/api/auth/enduser" -Method POST -Body $loginBody -ContentType "application/json"
$loginData = $loginR.Content | ConvertFrom-Json
$tokenCookie  = Get-CookieValue -RawHeaders $loginR.Headers -Name "token"
$refreshCookie = Get-CookieValue -RawHeaders $loginR.Headers -Name "refresh_token"
$cookieHeader = Get-CookieHeader $loginR.Headers
Write-Host "  Login successful for user1" -ForegroundColor Green

Test-Step -Name "Login returns 200" -Script {
    if ($loginR.Status -ne 200) { throw "Status: $($loginR.Status)" }
    if (-not $loginData.success) { throw "Login failed: $($loginData.error)" }
    if ($loginData.redirectUrl -ne "/user/Investment") { throw "Wrong redirect: $($loginData.redirectUrl)" }
}

Test-Step -Name "Token cookie received" -Script {
    if (-not $tokenCookie) { throw "No token cookie" }
}

Test-Step -Name "Refresh token cookie received" -Script {
    if (-not $refreshCookie) { throw "No refresh_token cookie" }
}

# Step 2: Call protected endpoint
Write-Host '`nðŸ“Œ Step 2: Call protected endpoint' -ForegroundColor Yellow
$protectedR = Invoke-WebSafe -Uri "$BASE/api/auth/check" -Method GET -Headers @{ "Cookie" = "token=$tokenCookie" }
$protectedData = $protectedR.Content | ConvertFrom-Json

Test-Step -Name "Protected endpoint returns 200" -Script {
    if ($protectedR.Status -ne 200) { throw "Status: $($protectedR.Status) body=$($protectedR.Content)" }
    if (-not $protectedData.authenticated) { throw "Not authenticated: $($protectedR.Content)" }
}

# Step 3: Refresh token
Write-Host '`nðŸ“Œ Step 3: Refresh token' -ForegroundColor Yellow
$refreshRes = Invoke-WebSafe -Uri "$BASE/api/auth/refresh" -Method POST -Headers @{ "Cookie" = $cookieHeader }
$newTokenCookie  = Get-CookieValue -RawHeaders $refreshRes.Headers -Name "token"
$newRefreshCookie = Get-CookieValue -RawHeaders $refreshRes.Headers -Name "refresh_token"

Test-Step -Name "Refresh returns 200" -Script {
    if ($refreshRes.Status -ne 200) { throw "Status: $($refreshRes.Status) body=$($refreshRes.Content)" }
}

Test-Step -Name "New token cookie issued" -Script {
    if (-not $newTokenCookie) { throw "No new token cookie" }
}

Test-Step -Name "New refresh token cookie issued" -Script {
    if (-not $newRefreshCookie) { throw "No new refresh_token cookie" }
}

# Step 4: Call protected endpoint with new token
Write-Host '`nðŸ“Œ Step 4: Call protected with new token' -ForegroundColor Yellow
$protectedR2 = Invoke-WebSafe -Uri "$BASE/api/auth/check" -Method GET -Headers @{ "Cookie" = "token=$newTokenCookie" }

Test-Step -Name "Protected endpoint with new token returns 200" -Script {
    if ($protectedR2.Status -ne 200) { throw "Status: $($protectedR2.Status) body=$($protectedR2.Content)" }
}

# Step 5: Old refresh token must be rejected (rotation / replay detection)
Write-Host '`nðŸ• Step 5: Old refresh token rejected after refresh (rotation)' -ForegroundColor Yellow
$replayRes = Invoke-WebSafe -Uri "$BASE/api/auth/refresh" -Method POST -Headers @{ "Cookie" = "token=$newTokenCookie; refresh_token=$refreshCookie" }

Test-Step -Name "Old refresh token rejected after rotation" -Script {
    if ($replayRes.Status -ne 401) { throw "Old refresh token still usable: $($replayRes.Status) body=$($replayRes.Content)" }
}

# Summary
Write-Host '`n=======================================' -ForegroundColor Cyan
Write-Host "  Results: $PASS passed, $FAIL failed" -ForegroundColor $(if ($FAIL -eq 0) { "Green" } else { "Red" })
Write-Host '=======================================`n' -ForegroundColor Cyan

if ($FAIL -gt 0) { exit 1 } else { exit 0 }
