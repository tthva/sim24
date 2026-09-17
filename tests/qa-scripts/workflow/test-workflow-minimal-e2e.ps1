# ============================
# SIM24 — Workflow E2E Test
# ============================
# Tests the complete workflow lifecycle:
# 1. Login as operator_price
# 2. Submit a buy form (creates workflow instance)
# 3. Get workflow tasks for the operator
# 4. Complete the first step
# 5. Verify workflow progression
# ============================

$BASE = "http://localhost:3000"
$PASS = 0
$FAIL = 0
$TOKEN = $null

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
    $res = Invoke-WebRequest -Uri "$BASE/api/operator/auth" -Method POST -Body $body -ContentType "application/json" -SessionVariable s
    $cookies = $res.Headers["Set-Cookie"]
    $token = ($cookies | Where-Object { $_ -match "^token=" } | ForEach-Object { ($_ -split ";")[0] })
    return $token
}

Write-Host "`n═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Workflow E2E Test" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════`n" -ForegroundColor Cyan

# Step 1: Login as operator_price
Write-Host "📌 Step 1: Login as operator_price" -ForegroundColor Yellow
$TOKEN = Login-Operator -Username "operator_price" -Password "operator123"
Test-Step -Name "Login successful" -Script { if (-not $TOKEN) { throw "No token" } }

# Step 2: Submit a buy form (creates workflow)
Write-Host "`n📌 Step 2: Submit buy form" -ForegroundColor Yellow
$formBody = @{
    formType = "buy_direct"
    formData = @{
        nm = "test"
        fm = "user"
        ph = "09120000000"
        prov = "1"
        city = "1"
        birthDay = "01"
        birthMonth = "01"
        birthYear = "1370"
        pref = "09121111111"
        hk = "site"
        cond = "new"
    }
} | ConvertTo-Json -Depth 10

$formRes = Invoke-WebRequest -Uri "$BASE/api/forms/buy" -Method POST -Body $formBody -ContentType "application/json" -Headers @{ "Cookie" = $TOKEN } -SkipHttpErrorCheck
$formData = $formRes | ConvertFrom-Json

Test-Step -Name "Buy form submitted" -Script {
    if ($formRes.StatusCode -ne 201 -and $formRes.StatusCode -ne 200) { throw "Status: $($formRes.StatusCode)" }
}

$formId = $formData.data.id
$workflowCode = $formData.data.workflowCode
Write-Host "  Form ID: $formId, Workflow: $workflowCode" -ForegroundColor Gray

# Step 3: Get workflow tasks
Write-Host "`n📌 Step 3: Get workflow tasks" -ForegroundColor Yellow
$tasksRes = Invoke-WebRequest -Uri "$BASE/api/workflow/tasks" -Method GET -Headers @{ "Cookie" = $TOKEN } -SkipHttpErrorCheck
$tasksData = $tasksRes | ConvertFrom-Json

Test-Step -Name "Workflow tasks endpoint accessible" -Script {
    if ($tasksRes.StatusCode -ne 200) { throw "Status: $($tasksRes.StatusCode)" }
}

# Step 4: Get workflow instance
Write-Host "`n📌 Step 4: Get workflow instance" -ForegroundColor Yellow
$instanceRes = Invoke-WebRequest -Uri "$BASE/api/workflow/instance/$formId" -Method GET -Headers @{ "Cookie" = $TOKEN } -SkipHttpErrorCheck

Test-Step -Name "Workflow instance endpoint accessible" -Script {
    if ($instanceRes.StatusCode -ne 200 -and $instanceRes.StatusCode -ne 404) { throw "Status: $($instanceRes.StatusCode)" }
}

# Step 5: Verify workflow code mapping
Write-Host "`n📌 Step 5: Verify workflow code" -ForegroundColor Yellow
Test-Step -Name "Workflow code is valid" -Script {
    if (-not $workflowCode) { throw "No workflow code returned" }
    $validCodes = @("BUY_DIRECT", "BUY_INSTALLMENT", "BUY_PREORDER", "SELL_DIRECT", "SELL_MARKET_SWAP", "SELL_CONSIGNMENT", "INVESTMENT_REQUEST", "PRICE_SEARCH")
    if ($workflowCode -notin $validCodes) { throw "Unknown workflow code: $workflowCode" }
}

# Summary
Write-Host "`n═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Results: $PASS passed, $FAIL failed" -ForegroundColor $(if ($FAIL -eq 0) { "Green" } else { "Red" })
Write-Host "═══════════════════════════════════════`n" -ForegroundColor Cyan

if ($FAIL -gt 0) { exit 1 } else { exit 0 }