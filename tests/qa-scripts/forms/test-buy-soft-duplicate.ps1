. .\tests\qa-scripts\shared\utils.ps1

$uri = "http://localhost:3000/api/forms/buy"
$phone = New-PhoneNumber -Prefix "091201"
$body = @{
  formType = "buy_direct"
  formData = @{
    nm = "soft"
    fm = "duplicate"
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
Write-Host "  BUY - Soft Duplicate Test" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host "Phone: $phone"
Write-Host ""

$result = Test-SoftDuplicate -Uri $uri -BodyObject $body -FirstExpected 201 -SecondExpected 409

if ($result.Passed) {
  Write-Host "DONE: Soft duplicate test PASSED." -ForegroundColor Green
} else {
  Write-Host "DONE: Soft duplicate test FAILED." -ForegroundColor Red
}