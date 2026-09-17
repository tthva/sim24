. .\tests\qa-scripts\shared\utils.ps1

$uri = "http://localhost:3000/api/forms/sell"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  SELL FORM - 3 SCENARIO TEST SUITE" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ============================================
# SCENARIO 1 - Happy Path (no idempotency key)
# ============================================
Write-Host "--- [1] HAPPY PATH (no idempotency key) ---" -ForegroundColor Yellow

$phone1 = New-PhoneNumber -Prefix "091203"
$body1 = @{
  formType = "sell_direct"
  formData = @{
    dNm    = "test"
    dFm    = "test"
    dPh    = $phone1
    dProv  = 8
    dCity  = 101
    dBD    = "01"
    dBM    = "01"
    dBY    = "1370"
    dOwn   = "self"
    dCond  = "used"
    dSimPh = "0912111$(Get-Random -Minimum 1000 -Maximum 9999)"
    dHk    = "0"
  }
}
Write-Host "Phone: $phone1"
Write-Host ""

$result1 = Invoke-PostJson -Uri $uri -Headers @{ "Content-Type" = "application/json" } -BodyObject $body1 -ExpectedStatus 201

# ============================================
# SCENARIO 2 - Strict Idempotency (with key)
# ============================================
Write-Host "--- [2] STRICT IDEMPOTENCY (with key) ---" -ForegroundColor Yellow

$phone2 = New-PhoneNumber -Prefix "091204"
$idemKey = New-IdempotencyKey -Prefix "qa-sell-strict"
$body2 = @{
  formType = "sell_direct"
  formData = @{
    dNm    = "test"
    dFm    = "test"
    dPh    = $phone2
    dProv  = 8
    dCity  = 101
    dBD    = "01"
    dBM    = "01"
    dBY    = "1370"
    dOwn   = "self"
    dCond  = "used"
    dSimPh = "0912111$(Get-Random -Minimum 1000 -Maximum 9999)"
    dHk    = "0"
  }
}
Write-Host "Key: $idemKey"
Write-Host "Phone: $phone2"
Write-Host ""

# 2a - First call
Write-Host "2a. First call (expect 201):" -ForegroundColor Gray
$result2a = Invoke-PostJson -Uri $uri -Headers @{ "x-idempotency-key" = $idemKey } -BodyObject $body2 -ExpectedStatus 201

# 2b - Second call with same key
Write-Host "2b. Duplicate call (expect 200 + duplicate:true):" -ForegroundColor Gray
$result2b = Invoke-PostJson -Uri $uri -Headers @{ "x-idempotency-key" = $idemKey } -BodyObject $body2 -ExpectedStatus 200

# ============================================
# SCENARIO 3 - Soft Duplicate (no header, same data)
# ============================================
Write-Host "--- [3] SOFT DUPLICATE (no header, same data within 10s) ---" -ForegroundColor Yellow

$phone3 = New-PhoneNumber -Prefix "091205"
$body3 = @{
  formType = "sell_direct"
  formData = @{
    dNm    = "soft"
    dFm    = "dup"
    dPh    = $phone3
    dProv  = 8
    dCity  = 101
    dBD    = "01"
    dBM    = "01"
    dBY    = "1370"
    dOwn   = "self"
    dCond  = "used"
    dSimPh = "0912112$(Get-Random -Minimum 1000 -Maximum 9999)"
    dHk    = "0"
  }
}
Write-Host "Phone: $phone3"
Write-Host ""

$softResult = Test-SoftDuplicate -Uri $uri -BodyObject $body3 -FirstExpected 201 -SecondExpected 409

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  TESTS COMPLETE" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan