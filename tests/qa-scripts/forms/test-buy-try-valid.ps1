. .\tests\qa-scripts\shared\utils.ps1

$uri = "http://localhost:3000/api/forms/buy"
$phone = New-PhoneNumber -Prefix "091202"
$idemKey = New-IdempotencyKey -Prefix "qa-buy-valid"

$body = @{
  formType = "buy_direct"
  formData = @{
    nm        = "test"
    fm        = "test"
    ph        = $phone
    prov      = "tehran"
    city      = "tehran"
    birthDay  = "1"
    birthMonth= "1"
    birthYear = "1990"
    pref      = "0"
    hk        = "0"
    cond      = "new"
  }
}

Write-Host "==============================" -ForegroundColor Cyan
Write-Host "  BUY — Try Valid (strict)" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host "Phone: $phone"
Write-Host "Key: $idemKey"
Write-Host ""

$result = Invoke-PostJson -Uri $uri -Headers @{ "x-idempotency-key" = $idemKey } -BodyObject $body -ExpectedStatus 201

if ($result.Success) {
  Write-Host "[DONE] Buy try-valid test PASSED." -ForegroundColor Green
} else {
  Write-Host "[DONE] Buy try-valid test FAILED." -ForegroundColor Red
}