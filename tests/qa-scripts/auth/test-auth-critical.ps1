. .\tests\qa-scripts\shared\utils.ps1

$base = "http://localhost:3000"
$script:results = @()

function Test-Step {
  param([string]$Name, [scriptblock]$Block)
  Write-Host "`n--- $Name ---" -ForegroundColor Yellow
  try {
    $res = & $Block
    $script:results += [PSCustomObject]@{ Name = $Name; Passed = $res }
    Write-Host "[RESULT] $Name : $(if ($res) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($res) { "Green" } else { "Red" })
  } catch {
    $script:results += [PSCustomObject]@{ Name = $Name; Passed = $false }
    Write-Host "[RESULT] $Name : FAILED (exception)" -ForegroundColor Red
    Write-Host $_.Exception.Message
  }
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  SIM24 AUTH CRITICAL TESTS" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# 1) Login success returns envelope + cookies
Test-Step "Login success" {
  $body = @{ username = "agent1"; password = "agent123" } | ConvertTo-Json
  $resp = Invoke-WebSafe -Uri "$base/api/operator/auth" -Method POST -ContentType "application/json" -Body $body
  $status = [int]$resp.Status
  $json = $resp.Content | ConvertFrom-Json
  $ok = ($status -eq 200) -and $json.success -and $json.user
  if (-not $ok) { return $false }
  # Save cookies for later steps
  $script:cookieHeader = Get-CookieHeader $resp.Headers
  return $true
}

# 2) Login with bad password returns 401 with envelope
Test-Step "Login invalid password" {
  $body = @{ username = "agent1"; password = "wrong" } | ConvertTo-Json
  $resp = Invoke-WebSafe -Uri "$base/api/operator/auth" -Method POST -ContentType "application/json" -Body $body
  $status = [int]$resp.Status
  $json = $resp.Content | ConvertFrom-Json
  return ($status -eq 401) -and ($json.success -eq $false)
}

# 3) Protected route without token returns 401
Test-Step "Protected route missing token" {
  $resp = Invoke-WebSafe -Uri "$base/api/workflow/tasks" -Method GET
  $status = [int]$resp.Status
  $json = $resp.Content | ConvertFrom-Json
  return ($status -eq 401) -and ($json.success -eq $false)
}

# 4) Protected route with invalid token returns 401
Test-Step "Protected route invalid token" {
  $h = @{ Cookie = "token=invalid.jwt.token" }
  $resp = Invoke-WebSafe -Uri "$base/api/workflow/tasks" -Method GET -Headers $h
  $status = [int]$resp.Status
  $json = $resp.Content | ConvertFrom-Json
  return ($status -eq 401) -and ($json.success -eq $false)
}

# 5) Logout revokes session + clears cookies and succeeds
# (uses the canonical /api/auth/logout which revokes the server-side session;
#  /api/operator/auth DELETE only clears the client cookie)
Test-Step "Logout clears access cookie" {
  if (-not $script:cookieHeader) { return $false }
  $h = @{ Cookie = $script:cookieHeader }
  $resp = Invoke-WebSafe -Uri "$base/api/auth/logout" -Method POST -Headers $h
  $status = [int]$resp.Status
  $json = $resp.Content | ConvertFrom-Json
  return ($status -eq 200) -and ($json.success -eq $true)
}

# 6) After logout, same cookie rejected
Test-Step "Post-logout access rejected" {
  if (-not $script:cookieHeader) { return $false }
  $h = @{ Cookie = $script:cookieHeader }
  $resp = Invoke-WebSafe -Uri "$base/api/workflow/tasks" -Method GET -Headers $h
  $status = [int]$resp.Status
  return ($status -eq 401)
}

# Summary
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  TEST SUMMARY" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
$total = $script:results.Count
$passed = ($script:results | Where-Object { $_.Passed -eq $true }).Count
foreach ($r in $script:results) {
  Write-Host "$($r.Name): $(if ($r.Passed) { 'PASS' } else { 'FAIL' })"
}
Write-Host "`nTotal: $total, Passed: $passed, Failed: $($total - $passed)" -ForegroundColor $(if ($passed -eq $total) { "Green" } else { "Red" })

if ($passed -ne $total) { exit 1 }