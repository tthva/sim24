. .\tests\qa-scripts\shared\utils.ps1

$uri = "http://localhost:3000/api/forms/buy"
$phone = New-PhoneNumber -Prefix "091200"
$idemKey = New-IdempotencyKey -Prefix "qa-buy-simple"

$body = @{
  formType = "buy_direct"
  formData = @{
    nm = "test"
    fm = "test"
    ph = $phone
    prov = "tehran"
    city = "tehran"
    birthDay = "1"
    birthMonth = "1"
    birthYear = "1990"
    pref = "0"
    hk = "0"
    cond = "new"
  }
}

Write-Host "==============================" -ForegroundColor Cyan
Write-Host "  BUY - Happy Path (strict)" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host "Phone: $phone"
Write-Host "Key: $idemKey"
Write-Host ""

$result = Invoke-PostJson -Uri $uri -Headers @{ "x-idempotency-key" = $idemKey } -BodyObject $body -ExpectedStatus 201

Write-Host "[DONE] Buy simple test complete." -ForegroundColor Gray