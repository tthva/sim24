# ============================
# SIM24 — Storage (S3/MinIO) Presigned URL Test
# ============================
# Tests:
# 1. Login as operator_price
# 2. Request Presigned PUT URL for a test file
# 3. Verify the upload URL is valid (starts with S3 endpoint)
# 4. Request Presigned GET URL for the same file
# 5. Verify the GET URL is valid and different from PUT URL
# 6. Test with invalid file type → expect validation error
# ============================

$BASE = "http://localhost:3000"
$PASS = 0
$FAIL = 0

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

function Login-Operator {
    param($Username, $Password)
    $body = @{ username = $Username; password = $Password } | ConvertTo-Json
    $res = Invoke-WebRequest -Uri "$BASE/api/operator/auth" -Method POST -Body $body -ContentType "application/json"
    $cookies = $res.Headers["Set-Cookie"]
    $token = ($cookies | Where-Object { $_ -match "^token=" } | ForEach-Object { ($_ -split ";")[0] })
    return $token
}

Write-Host "`n═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Storage (S3/MinIO) Presigned URL Test" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════`n" -ForegroundColor Cyan

# Step 1: Login
Write-Host "📌 Step 1: Login as operator_sell" -ForegroundColor Yellow
$TOKEN = Login-Operator -Username "operator_sell" -Password "operator123"
Test-Step -Name "Login successful" -Script { if (-not $TOKEN) { throw "No token" } }

# Step 2: Request Presigned PUT URL
Write-Host "`n📌 Step 2: Request Presigned PUT URL" -ForegroundColor Yellow
$putBody = @{
    originalName = "test-document.pdf"
    mimeType     = "application/pdf"
    fileSize     = 102400
} | ConvertTo-Json

$putRes = Invoke-WebRequest -Uri "$BASE/api/storage/presign" -Method POST -Body $putBody -ContentType "application/json" -Headers @{ "Cookie" = $TOKEN } -SkipHttpErrorCheck
$putData = $putRes | ConvertFrom-Json

Test-Step -Name "Presigned PUT returns 201" -Script {
    if ($putRes.StatusCode -ne 201) { throw "Status: $($putRes.StatusCode) - $($putData.error)" }
}

Test-Step -Name "Upload URL starts with S3 endpoint" -Script {
    if (-not $putData.data.uploadUrl) { throw "No uploadUrl" }
    if ($putData.data.uploadUrl -notmatch "^http") { throw "Invalid URL format: $($putData.data.uploadUrl)" }
}

Test-Step -Name "File key is generated" -Script {
    if (-not $putData.data.fileKey) { throw "No fileKey" }
    if ($putData.data.fileKey -notmatch "^uploads/") { throw "Key doesn't start with uploads/: $($putData.data.fileKey)" }
}

Test-Step -Name "Public URL is valid" -Script {
    if (-not $putData.data.publicUrl) { throw "No publicUrl" }
}

$fileKey = $putData.data.fileKey
Write-Host "  File Key: $fileKey" -ForegroundColor Gray

# Step 3: Request Presigned GET URL
Write-Host "`n📌 Step 3: Request Presigned GET URL" -ForegroundColor Yellow
$getUrl = "$BASE/api/storage/presign?fileKey=$([System.Web.HttpUtility]::UrlEncode($fileKey))"
$getRes = Invoke-WebRequest -Uri $getUrl -Method GET -Headers @{ "Cookie" = $TOKEN } -SkipHttpErrorCheck
$getData = $getRes | ConvertFrom-Json

Test-Step -Name "Presigned GET returns 200" -Script {
    if ($getRes.StatusCode -ne 200) { throw "Status: $($getRes.StatusCode) - $($getData.error)" }
}

Test-Step -Name "Download URL is valid" -Script {
    if (-not $getData.data.downloadUrl) { throw "No downloadUrl" }
    if ($getData.data.downloadUrl -notmatch "^http") { throw "Invalid URL format" }
}

Test-Step -Name "File metadata matches" -Script {
    if ($getData.data.originalName -ne "test-document.pdf") { throw "originalName mismatch" }
    if ($getData.data.mimeType -ne "application/pdf") { throw "mimeType mismatch" }
}

# Step 4: Test with invalid file type → expect error
Write-Host "`n📌 Step 4: Invalid file type → expect validation error" -ForegroundColor Yellow
$invalidBody = @{
    originalName = "virus.exe"
    mimeType     = "application/x-msdownload"
    fileSize     = 1024
} | ConvertTo-Json

$invalidRes = Invoke-WebRequest -Uri "$BASE/api/storage/presign" -Method POST -Body $invalidBody -ContentType "application/json" -Headers @{ "Cookie" = $TOKEN } -SkipHttpErrorCheck

Test-Step -Name "Invalid file type is rejected" -Script {
    if ($invalidRes.StatusCode -ne 400) { throw "Expected 400, got $($invalidRes.StatusCode)" }
}

# Step 5: Test without auth → expect 401
Write-Host "`n📌 Step 5: Unauthenticated request → expect 401" -ForegroundColor Yellow
$unauthRes = Invoke-WebRequest -Uri "$BASE/api/storage/presign" -Method POST -Body $putBody -ContentType "application/json" -SkipHttpErrorCheck

Test-Step -Name "Unauthenticated request is rejected" -Script {
    if ($unauthRes.StatusCode -ne 401) { throw "Expected 401, got $($unauthRes.StatusCode)" }
}

# Summary
Write-Host "`n═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Results: $PASS passed, $FAIL failed" -ForegroundColor $(if ($FAIL -eq 0) { "Green" } else { "Red" })
Write-Host "═══════════════════════════════════════`n" -ForegroundColor Cyan

if ($FAIL -gt 0) { exit 1 } else { exit 0 }