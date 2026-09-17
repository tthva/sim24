. .\tests\qa-scripts\shared\utils.ps1

$uri = "http://localhost:3000/api/forms/sell"

Write-Host "============================================" -ForegroundColor Yellow
Write-Host "  SELL CONSIGNMENT - CRITICAL PATH (UTILS-COMPAT)" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow

$phone = "09120171585"
$spH = "09120171586"

$baseBody = @{
  formType = "sell_cons"
  formData = @{
    nm = "cons"
    fm = "happy"
    ph = $phone
    prov = 13
    city = 1
    birthDay = "01"
    birthMonth = "01"
    birthYear = "1990"
    sph = $spH
    price = "150,000,000"
    duration = "12"
    own = "self"
    cond = "new"
    hk = "1"
  }
}

function Parse-BodyJson {
  param([string]$raw)
  if ($null -eq $raw -or $raw -eq "") { return $null }
  try { return ($raw | ConvertFrom-Json) } catch { return $null }
}

# ---- Happy path (no idempotency header) ----
Write-Host ""
Write-Host "--- HAPPY PATH (expected 201) ---" -ForegroundColor Cyan
$headersHappy = @{
  "Content-Type" = "application/json"
}

$resp1 = Invoke-PostJson -Uri $uri -Headers $headersHappy -BodyObject $baseBody -ExpectedStatus 201
if ($resp1.StatusCode -ne 201) {
  throw "SELL cons happy path: expected status 201, got $($resp1.StatusCode). Body: $($resp1.Body)"
}

# ---- Strict duplicate (with x-idempotency-key) ----
Write-Host ""
Write-Host "--- STRICT SETUP CALL (expected 201) ---" -ForegroundColor Cyan
$headersStrict = @{
  "Content-Type" = "application/json"
  "x-idempotency-key" = "scons-1"
}
$respSetup = Invoke-PostJson -Uri $uri -Headers $headersStrict -BodyObject $baseBody -ExpectedStatus 201
if ($respSetup.StatusCode -ne 201) {
  throw "SELL cons strict setup: expected status 201, got $($respSetup.StatusCode). Body: $($respSetup.Body)"
}

Write-Host ""
Write-Host "--- STRICT DUPLICATE (expected 200 + meta.duplicate=true) ---" -ForegroundColor Cyan
$resp2 = Invoke-PostJson -Uri $uri -Headers $headersStrict -BodyObject $baseBody -ExpectedStatus 200

if ($resp2.StatusCode -ne 200) {
  throw "SELL cons strict duplicate (2nd call): expected status 200, got $($resp2.StatusCode). Body: $($resp2.Body)"
}

$body2 = Parse-BodyJson -raw $resp2.Body
if ($null -eq $body2) {
  throw "SELL cons strict duplicate: could not parse response JSON. Raw: $($resp2.Body)"
}
if ($body2.success -ne $true) {
  throw "SELL cons strict duplicate: expected success=true, got $($body2.success). Body: $($resp2.Body)"
}

if ($null -eq $body2.meta -or $body2.meta.duplicate -ne $true) {
  throw "SELL cons strict duplicate: expected meta.duplicate=true. Body: $($resp2.Body)"
}

# ---- Soft duplicate (no x-idempotency-key, repeat within 10s) ----
Write-Host ""
Write-Host "--- SOFT DUPLICATE (expected 409 DUPLICATE_REQUEST) ---" -ForegroundColor Cyan
$resp3 = Invoke-PostJson -Uri $uri -Headers $headersHappy -BodyObject $baseBody -ExpectedStatus 409

if ($resp3.StatusCode -ne 409) {
  throw "SELL cons soft duplicate: expected status 409, got $($resp3.StatusCode). Body: $($resp3.Body)"
}

$body3 = Parse-BodyJson -raw $resp3.Body
if ($null -eq $body3) {
  throw "SELL cons soft duplicate: could not parse response JSON. Raw: $($resp3.Body)"
}

if ($null -eq $body3.error -or $body3.error.code -ne "DUPLICATE_REQUEST") {
  throw "SELL cons soft duplicate: expected error.code=DUPLICATE_REQUEST, got '$($body3.error.code)'. Body: $($resp3.Body)"
}

Write-Host ""
Write-Host "DONE: SELL cons critical path PASSED." -ForegroundColor Green
