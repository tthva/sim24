# =================================================================
# SIM24 — Production Acceptance Test Script for All 9 Form Types
# =================================================================
# Prerequisites:
#   - Dev server running on http://localhost:3000
#   - PostgreSQL running and accessible via DATABASE_URL
#   - Redis running and accessible via REDIS_URL
#   - psql CLI available in PATH
#
# Usage:
#   .\tests\qa-scripts\forms\test-all-9-forms.ps1
#
# This script uses unique markers (QA-TEST-<timestamp>) to identify
# test records. Cleanup commands are provided at the end.
# =================================================================

$baseUrl = "http://localhost:3000"
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$marker = "QA-TEST-$timestamp"
$results = @()

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SIM24 Production Acceptance Test" -ForegroundColor Cyan
Write-Host "Marker: $marker" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan

# Helper function to send a form submission
function Send-Form {
    param(
        [string]$endpoint,
        [string]$idempotencyKey,
        [hashtable]$body
    )
    $headers = @{
        "Content-Type" = "application/json"
        "x-idempotency-key" = $idempotencyKey
    }
    $json = $body | ConvertTo-Json -Depth 10
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl$endpoint" -Method POST -Headers $headers -Body $json -UseBasicParsing -ErrorAction Stop
        $statusCode = $response.StatusCode
        $responseBody = $response.Content
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $responseBody = $_.ErrorDetails.Message
    }
    return @{ status = $statusCode; body = $responseBody }
}

# Helper function to send a duplicate request
function Send-Duplicate {
    param(
        [string]$endpoint,
        [string]$idempotencyKey,
        [hashtable]$body
    )
    return Send-Form -endpoint $endpoint -idempotencyKey $idempotencyKey -body $body
}

# ─── Form 1: buy_direct ───────────────────────────────────────
Write-Host "`n[1/9] Testing buy_direct..." -ForegroundColor Green
$key1 = "qa-$marker-buy-direct"
$body1 = @{
    formType = "buy_direct"
    formData = @{
        nm = "QA"; fm = "TestBuyDirect"; ph = "09123456789"
        prov = "تهران"; city = "تهران"
        birthDay = "01"; birthMonth = "01"; birthYear = "1370"
        pref = "09120000001"; hk = "اینستاگرام"; cond = "new"
        _marker = $marker
    }
}
$r1 = Send-Form -endpoint "/api/forms/buy" -idempotencyKey $key1 -body $body1
$r1dup = Send-Duplicate -endpoint "/api/forms/buy" -idempotencyKey $key1 -body $body1
$results += [PSCustomObject]@{ Form="buy_direct"; Status=$r1.status; DupStatus=$r1dup.status; Key=$key1 }

# ─── Form 2: buy_installment ──────────────────────────────────
Write-Host "[2/9] Testing buy_installment..." -ForegroundColor Green
$key2 = "qa-$marker-buy-inst"
$body2 = @{
    formType = "buy_installment"
    formData = @{
        nm = "QA"; fm = "TestBuyInst"; ph = "09123456788"
        sp = "50000000"; dp = "15000000"; mo = 6; hk = "تلگرام"
        _marker = $marker
    }
}
$r2 = Send-Form -endpoint "/api/forms/buy" -idempotencyKey $key2 -body $body2
$r2dup = Send-Duplicate -endpoint "/api/forms/buy" -idempotencyKey $key2 -body $body2
$results += [PSCustomObject]@{ Form="buy_installment"; Status=$r2.status; DupStatus=$r2dup.status; Key=$key2 }

# ─── Form 3: buy_preorder ─────────────────────────────────────
Write-Host "[3/9] Testing buy_preorder..." -ForegroundColor Green
$key3 = "qa-$marker-buy-pre"
$body3 = @{
    formType = "buy_preorder"
    formData = @{
        nm = "QA"; fm = "TestBuyPre"; ph = "09123456787"
        nt = "09120000002"; hk = "دوستان"
        _marker = $marker
    }
}
$r3 = Send-Form -endpoint "/api/forms/buy" -idempotencyKey $key3 -body $body3
$r3dup = Send-Duplicate -endpoint "/api/forms/buy" -idempotencyKey $key3 -body $body3
$results += [PSCustomObject]@{ Form="buy_preorder"; Status=$r3.status; DupStatus=$r3dup.status; Key=$key3 }

# ─── Form 4: sell_direct ──────────────────────────────────────
Write-Host "[4/9] Testing sell_direct..." -ForegroundColor Green
$key4 = "qa-$marker-sell-direct"
$body4 = @{
    formType = "sell_direct"
    formData = @{
        dNm = "QA"; dFm = "TestSellDirect"; dPh = "09123456786"
        dProv = 1; dCity = 1
        dBD = "01"; dBM = "01"; dBY = "1370"
        dOwn = "self"; dCond = "used"; dSimPh = "09120000003"; dHk = "گوگل"
        _marker = $marker
    }
}
$r4 = Send-Form -endpoint "/api/forms/sell" -idempotencyKey $key4 -body $body4
$r4dup = Send-Duplicate -endpoint "/api/forms/sell" -idempotencyKey $key4 -body $body4
$results += [PSCustomObject]@{ Form="sell_direct"; Status=$r4.status; DupStatus=$r4dup.status; Key=$key4 }

# ─── Form 5: sell_market ──────────────────────────────────────
Write-Host "[5/9] Testing sell_market..." -ForegroundColor Green
$key5 = "qa-$marker-sell-market"
$body5 = @{
    formType = "sell_market"
    formData = @{
        mNm = "QA"; mFm = "TestSellMarket"; mPh = "09123456785"
        mProv = 1; mCity = 1
        mBD = "01"; mBM = "01"; mBY = "1370"
        mPrice = "10000000"; mDuration = "3"
        mSimPh = "09120000004"; mOwn = "self"; mCond = "used"; mHk = "تبلیغات"
        nt = "09120000005"
        _marker = $marker
    }
}
$r5 = Send-Form -endpoint "/api/forms/sell" -idempotencyKey $key5 -body $body5
$r5dup = Send-Duplicate -endpoint "/api/forms/sell" -idempotencyKey $key5 -body $body5
$results += [PSCustomObject]@{ Form="sell_market"; Status=$r5.status; DupStatus=$r5dup.status; Key=$key5 }

# ─── Form 6: sell_cons ────────────────────────────────────────
Write-Host "[6/9] Testing sell_cons..." -ForegroundColor Green
$key6 = "qa-$marker-sell-cons"
$body6 = @{
    formType = "sell_cons"
    formData = @{
        nm = "QA"; fm = "TestSellCons"; ph = "09123456784"
        prov = 1; city = 1
        birthDay = "01"; birthMonth = "01"; birthYear = "1370"
        sph = "09120000006"; price = "5000000"; duration = "6"
        own = "other"; cond = "used"; hk = "یوتیوب"
        _marker = $marker
    }
}
$r6 = Send-Form -endpoint "/api/forms/sell" -idempotencyKey $key6 -body $body6
$r6dup = Send-Duplicate -endpoint "/api/forms/sell" -idempotencyKey $key6 -body $body6
$results += [PSCustomObject]@{ Form="sell_cons"; Status=$r6.status; DupStatus=$r6dup.status; Key=$key6 }

# ─── Form 7: real_market_value / search ───────────────────────
Write-Host "[7/9] Testing real_market_value..." -ForegroundColor Green
$key7 = "qa-$marker-search"
$body7 = @{
    formType = "real_market_value"
    formData = @{
        nm = "QA"; fm = "TestSearch"; uph = "09123456783"
        hk = "سایت"; type = "real_market_value"
        _marker = $marker
    }
}
$r7 = Send-Form -endpoint "/api/forms/search" -idempotencyKey $key7 -body $body7
$r7dup = Send-Duplicate -endpoint "/api/forms/search" -idempotencyKey $key7 -body $body7
$results += [PSCustomObject]@{ Form="search"; Status=$r7.status; DupStatus=$r7dup.status; Key=$key7 }

# ─── Form 8: invest_installment ───────────────────────────────
Write-Host "[8/9] Testing invest_installment..." -ForegroundColor Green
$key8 = "qa-$marker-invest-inst"
$body8 = @{
    it = "installment"
    nm = "QA"; fm = "TestInvestInst"; ph = "09123456782"; hk = "لینکدین"
    _marker = $marker
}
$r8 = Send-Form -endpoint "/api/investments" -idempotencyKey $key8 -body $body8
$r8dup = Send-Duplicate -endpoint "/api/investments" -idempotencyKey $key8 -body $body8
$results += [PSCustomObject]@{ Form="invest_installment"; Status=$r8.status; DupStatus=$r8dup.status; Key=$key8 }

# ─── Form 9: invest_buy-sell ──────────────────────────────────
Write-Host "[9/9] Testing invest_buy-sell..." -ForegroundColor Green
$key9 = "qa-$marker-invest-bs"
$body9 = @{
    it = "buy-sell"
    nm = "QA"; fm = "TestInvestBS"; ph = "09123456781"; hk = "توییتر"
    _marker = $marker
}
$r9 = Send-Form -endpoint "/api/investments" -idempotencyKey $key9 -body $body9
$r9dup = Send-Duplicate -endpoint "/api/investments" -idempotencyKey $key9 -body $body9
$results += [PSCustomObject]@{ Form="invest_buy-sell"; Status=$r9.status; DupStatus=$r9dup.status; Key=$key9 }

# ─── Results Summary ──────────────────────────────────────────
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "RESULTS SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
$results | Format-Table -AutoSize

# ─── Database Verification (requires psql) ────────────────────
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "DATABASE VERIFICATION (requires psql)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host @"
Run the following SQL to verify test records:

-- Count records by formType for this test marker:
SELECT "formType", COUNT(*) as count
FROM customer_forms
WHERE "formData"::text LIKE '%QA-TEST-$timestamp%'
GROUP BY "formType"
ORDER BY "formType";

-- Verify exactly 1 record per form type:
SELECT "formType", COUNT(*) as count
FROM customer_forms
WHERE "formData"::text LIKE '%QA-TEST-$timestamp%'
GROUP BY "formType"
HAVING COUNT(*) > 1;

-- Verify AuditLog entries:
SELECT cf."formType", COUNT(al.id) as audit_count
FROM customer_forms cf
JOIN audit_logs al ON al."entityId" = cf.id AND al.entity = 'form'
WHERE cf."formData"::text LIKE '%QA-TEST-$timestamp%'
GROUP BY cf."formType";

-- Cleanup test records:
DELETE FROM audit_logs
WHERE "entityId" IN (
  SELECT id FROM customer_forms
  WHERE "formData"::text LIKE '%QA-TEST-$timestamp%'
) AND entity = 'form';

DELETE FROM customer_forms
WHERE "formData"::text LIKE '%QA-TEST-$timestamp%';
"@ -ForegroundColor Yellow

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "ATTACHMENT IDOR TEST (for buy/sell/search forms)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host @"
# Test 1: Anonymous user submitting attachmentIds should get 401:
curl -X POST http://localhost:3000/api/forms/buy ^
  -H "Content-Type: application/json" ^
  -H "x-idempotency-key: qa-$marker-att-anon" ^
  -d "{\"formType\":\"buy_direct\",\"formData\":{\"nm\":\"QA\",\"fm\":\"AttAnon\",\"ph\":\"09123456780\",\"prov\":\"T\",\"city\":\"T\",\"birthDay\":\"01\",\"birthMonth\":\"01\",\"birthYear\":\"1370\",\"pref\":\"09120000099\",\"hk\":\"test\",\"cond\":\"new\",\"attachmentIds\":[\"fake-uuid\"]}}"

# Expected: 401 UNAUTHORIZED_ATTACHMENT

# Test 2: Authenticated user with foreign attachment should rollback:
# (Requires a valid auth token and a foreign-owned attachment ID)
# curl -X POST http://localhost:3000/api/forms/buy ^
#   -H "Content-Type: application/json" ^
#   -H "x-idempotency-key: qa-$marker-att-foreign" ^
#   -H "Cookie: token=<valid-jwt-token>" ^
#   -d "{\"formType\":\"buy_direct\",\"formData\":{\"nm\":\"QA\",\"fm\":\"AttForeign\",\"ph\":\"09123456779\",\"prov\":\"T\",\"city\":\"T\",\"birthDay\":\"01\",\"birthMonth\":\"01\",\"birthYear\":\"1370\",\"pref\":\"09120000098\",\"hk\":\"test\",\"cond\":\"new\",\"attachmentIds\":[\"foreign-attachment-uuid\"]}}"

# Expected: 500 (transaction rollback due to count mismatch)
# Verify: No customer_forms record with _marker = QA-TEST-$timestamp-att-foreign
"@ -ForegroundColor Yellow

Write-Host "`nDone. Review results above." -ForegroundColor Green