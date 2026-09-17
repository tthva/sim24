. .\tests\qa-scripts\shared\utils.ps1

$uri = "http://localhost:3000/api/forms/sell"

Write-Host "============================================" -ForegroundColor Yellow
Write-Host "  SELL MARKET - CRITICAL PATH (UTILS-COMPAT)" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow

# Payload derived from app/(api)/forms/sell/route.ts
# sell_market formData:
# mNm, mFm, mPh, mProv, mCity, mBD, mBM, mBY, mPrice, mDuration, mOwn, mCond, mHk, mSimPh, (optional nt)

$phone = "09120171583"

$body = @{
  formType = "sell_market"
  formData = @{
    mNm = "market"
    mFm = "happy"
    mPh = $phone
    mProv = 13
    mCity = 1
    mBD = "01"
    mBM = "01"
    mBY = "1990"
    mPrice = "150,000,000"
    mDuration = "12"
    mOwn = "self"
    mCond = "new"
    mHk = "1"
    mSimPh = "09120171584"
    nt = "توضیحات تست"
  }
}

$headersJson = @{ "Content-Type" = "application/json" }
$headersStrict = @{
  "Content-Type" = "application/json"
  "x-idempotency-key" = "smarket-1"
}

# ---- HAPPY PATH (expected 201) ----
Write-Host ""
Write-Host "--- HAPPY PATH (expected 201) ---" -ForegroundColor Cyan
$resultHappy = Invoke-PostJson -Uri $uri -Headers $headersJson -BodyObject $body -ExpectedStatus 201

# ---- STRICT DUPLICATE (expected 200, duplicate=true envelope) ----
# به دلیل منطق idempotency.ts:
# - strict فقط اگر رکوردی با same idempotencyKey در 10 دقیقه اخیر وجود داشته باشد رخ می‌دهد
# - بنابراین برای اینکه تست پایدار باشد، اول با همان x-idempotency-key یکبار "ثبت" می‌کنیم
#   (expected 201)، بعد همان را دوباره می‌زنیم (expected 200 duplicate)

Write-Host ""
Write-Host "--- STRICT SETUP CALL (expected 201) ---" -ForegroundColor Cyan
$resultSetup = Invoke-PostJson -Uri $uri -Headers $headersStrict -BodyObject $body -ExpectedStatus 201

Write-Host ""
Write-Host "--- STRICT DUPLICATE (expected 200 with { meta: {duplicate:true} }) ---" -ForegroundColor Cyan
$resultStrict = Invoke-PostJson -Uri $uri -Headers $headersStrict -BodyObject $body -ExpectedStatus 200

$strictSuccess = $false
$strictDuplicate = $false

try { $strictSuccess = ($resultStrict.Body.success -eq $true) } catch { $strictSuccess = $false }
try { $strictDuplicate = ($resultStrict.Body.meta.duplicate -eq $true) } catch { $strictDuplicate = $false }

if (-not $strictSuccess) { throw "SELL market strict duplicate: expected success=true (response: $($resultStrict.Body | ConvertTo-Json -Depth 20))" }
if (-not $strictDuplicate) { throw "SELL market strict duplicate: expected meta.duplicate=true (response: $($resultStrict.Body | ConvertTo-Json -Depth 20))" }

# ---- SOFT DUPLICATE (expected 409 DUPLICATE_REQUEST) ----
Write-Host ""
Write-Host "--- SOFT DUPLICATE (expected 409 DUPLICATE_REQUEST) ---" -ForegroundColor Cyan
$resultSoft = Invoke-PostJson -Uri $uri -Headers $headersJson -BodyObject $body -ExpectedStatus 409

try {
  if ($resultSoft.Body.success -ne $false) {
    throw "SELL market soft duplicate: expected success=false"
  }
  if ($resultSoft.Body.error.code -ne "DUPLICATE_REQUEST") {
    throw "SELL market soft duplicate: expected error.code=DUPLICATE_REQUEST"
  }
} catch {
  throw "SELL market soft duplicate: envelope mismatch. $_ (response: $($resultSoft.Body))"
}

Write-Host ""
Write-Host "DONE: SELL market critical path PASSED." -ForegroundColor Green
