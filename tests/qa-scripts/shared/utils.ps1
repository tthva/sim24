# ============================================
# SIM24 QA - Shared Utilities
# ============================================
# Source with:
#   . .\tests\qa-scripts\shared\utils.ps1
# ============================================

# ---- Generate a unique, valid Iranian mobile number ----
function New-PhoneNumber {
  param([string]$Prefix = "0912")
  $remaining = 11 - $Prefix.Length
  $min = 10000000
  $max = 99999999
  if ($remaining -lt 8) {
    $min = [int]([Math]::Pow(10, $remaining - 1))
    $max = [int]([Math]::Pow(10, $remaining) - 1)
  }
  $rand = Get-Random -Minimum $min -Maximum $max
  $randInt = [int]$rand
  return [string]::Concat($Prefix, $randInt.ToString())
}

# ---- Generate a unique idempotency key ----
function New-IdempotencyKey {
  param([string]$Prefix = "qa")
  $rand = Get-Random -Minimum 10000000 -Maximum 99999999
  $ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  return "$Prefix-$($ts)-$rand"
}

# ---- Print a standard request log ----
function Write-Request {
  param(
    [string]$Method = "POST",
    [string]$Uri,
    [hashtable]$Headers = @{},
    [string]$Body = ""
  )
  Write-Host "[REQUEST]" -ForegroundColor Cyan
  Write-Host "  $Method $Uri"
  $headerParts = @()
  foreach ($key in $Headers.Keys) {
    $headerParts += "$key=$($Headers[$key])"
  }
  $headerStr = $headerParts -join ", "
  Write-Host "  Headers: $headerStr"
  Write-Host "  Body: $Body"
  Write-Host ""
}

# ---- Print a standard response log ----
function Write-Response {
  param(
    [int]$StatusCode,
    [string]$Body = ""
  )
  $color = "Gray"
  if ($StatusCode -ge 200 -and $StatusCode -lt 300) { $color = "Green" }
  elseif ($StatusCode -ge 400 -and $StatusCode -lt 500) { $color = "Yellow" }
  else { $color = "Red" }
  Write-Host "[RESPONSE]" -ForegroundColor $color
  Write-Host "  Status: $StatusCode"
  Write-Host "  Body: $Body"
  Write-Host ""
}

# ---- Assert expected status code, print [ASSERT] result ----
function Assert-StatusCode {
  param(
    [int]$Actual,
    [int]$Expected,
    [string]$Scenario = ""
  )
  $ok = $Actual -eq $Expected
  if ($ok) {
    Write-Host "[ASSERT] PASS - $Scenario (expected $Expected, got $Actual)" -ForegroundColor Green
  } else {
    Write-Host "[ASSERT] FAIL - $Scenario (expected $Expected, got $Actual)" -ForegroundColor Red
  }
  return $ok
}

# ---- Send a POST JSON request and return parsed response ----
function Invoke-PostJson {
  param(
    [string]$Uri,
    [hashtable]$Headers = @{},
    [object]$BodyObject,
    [int]$ExpectedStatus = 201
  )
  $jsonBody = $BodyObject | ConvertTo-Json -Depth 10
  $allHeaders = @{ "Content-Type" = "application/json" }
  foreach ($k in $Headers.Keys) { $allHeaders[$k] = $Headers[$k] }

  Write-Request -Method "POST" -Uri $Uri -Headers $allHeaders -Body $jsonBody

  try {
    $resp = Invoke-WebRequest -Uri $Uri -Method POST -Headers $allHeaders -Body $jsonBody -UseBasicParsing
    $status = [int]$resp.StatusCode
    $content = $resp.Content
    Write-Response -StatusCode $status -Body $content
    Assert-StatusCode -Actual $status -Expected $ExpectedStatus -Scenario "Status check"
    return @{
      StatusCode = $status
      Body = $content
      Success = $status -eq $ExpectedStatus
      RawResponse = $resp
    }
  } catch {
    $err = $_.Exception
    $status = 0
    $content = ""
    if ($err.Response) {
      $status = [int]$err.Response.StatusCode
      try {
        $reader = New-Object System.IO.StreamReader($err.Response.GetResponseStream())
        $content = $reader.ReadToEnd()
        $reader.Close()
      } catch { $content = "(could not read stream)" }
    }
    Write-Response -StatusCode $status -Body $content
    Assert-StatusCode -Actual $status -Expected $ExpectedStatus -Scenario "Status check"
    return @{
      StatusCode = $status
      Body = $content
      Success = $status -eq $ExpectedStatus
      RawError = $err
    }
  }
}

# ---- Standard wrapper for a Soft-Duplicate scenario (no idempotency key) ----
function Test-SoftDuplicate {
  param(
    [string]$Uri,
    [object]$BodyObject,
    [int]$FirstExpected = 201,
    [int]$SecondExpected = 409
  )
  $headers = @{ "Content-Type" = "application/json" }

  Write-Host "--- SOFT DUPLICATE TEST ---" -ForegroundColor Yellow

  $result1 = Invoke-PostJson -Uri $Uri -Headers $headers -BodyObject $BodyObject -ExpectedStatus $FirstExpected
  Write-Host ""

  $result2 = Invoke-PostJson -Uri $Uri -Headers $headers -BodyObject $BodyObject -ExpectedStatus $SecondExpected
  Write-Host ""

  $pass1 = Assert-StatusCode -Actual $result1.StatusCode -Expected $FirstExpected -Scenario "First call"
  $pass2 = Assert-StatusCode -Actual $result2.StatusCode -Expected $SecondExpected -Scenario "Second call / soft duplicate"

  return @{
    First = $result1
    Second = $result2
    Passed = ($pass1 -and $pass2)
  }
}

# ---- PS 5.1/7-compatible HTTP request that never throws on non-2xx ----
# Returns objects like:
#   @{ Status = <int or -1 on network error>; Content = <string>; Headers = <collection> }
# Uses System.Net.Http.HttpClient when Cookie headers are present (PS 5.1 Invoke-WebRequest
# strips custom Cookie headers). Falls back to Invoke-WebRequest for simple requests.
function Invoke-WebSafe {
  param(
    [string]$Uri,
    [string]$Method = "GET",
    [hashtable]$Headers = @{},
    [string]$Body = "",
    [string]$ContentType = ""
  )
  # If Cookie header present, use HttpClient (PS 5.1 Invoke-WebRequest ignores custom Cookie headers)
  if ($Headers.ContainsKey('Cookie')) {
    # Load System.Net.Http if not already loaded (PS 5.1 doesn't load it by default)
        try { [void][System.Net.Http.HttpClientHandler] } catch { Add-Type -AssemblyName System.Net.Http }
    Write-Host "[DEBUG HttpClient] Cookie header detected, using HttpClient" -ForegroundColor DarkYellow
    try {
      $handler = New-Object System.Net.Http.HttpClientHandler
      $handler.UseCookies = $false
      $client = New-Object System.Net.Http.HttpClient -ArgumentList $handler
      $client.Timeout = [TimeSpan]::FromSeconds(30)
      $methodLower = $Method.ToLower()
      $httpMethod = New-Object System.Net.Http.HttpMethod $methodLower
      $req = New-Object System.Net.Http.HttpRequestMessage($httpMethod, $Uri)
      foreach ($k in $Headers.Keys) {
        $val = $Headers[$k]
        if ($k -eq 'Content-Type') { $req.Content.Headers.Add($k, $val) | Out-Null }
        else { $req.Headers.Add($k, $val) | Out-Null }
      }
      if ($Body) {
        $ct = if ($ContentType) { $ContentType } else { 'application/json' }
        $req.Content = New-Object System.Net.Http.StringContent($Body, [System.Text.Encoding]::UTF8, $ct)
      }
      $resp = $client.SendAsync($req).Result
      $status = [int]$resp.StatusCode
      $content = $resp.Content.ReadAsStringAsync().Result
      $hc = [Ordered]@{}
      foreach ($h in $resp.Headers) { $hc[$h.Key] = ($h.Value -join ',') }
      foreach ($h in $resp.Content.Headers) { if ($h.Key -ne 'Content-Type') { $hc[$h.Key] = ($h.Value -join ',') } }
      $handler.Dispose()
      $client.Dispose()
      return [PSCustomObject]@{ Status = $status; Content = $content; Headers = $hc }
    } catch {
      $e = $_.Exception
      if ($e.InnerException) { $e = $e.InnerException }
      if ($e.Response) {
        $status = [int]$e.Response.StatusCode
        $content = ""
        try {
          $reader = New-Object System.IO.StreamReader($e.Response.Content.ReadAsStreamAsync().Result)
          $content = $reader.ReadToEnd()
          $reader.Close()
        } catch { $content = "(could not read stream)" }
        $hc = [Ordered]@{}
        foreach ($h in $e.Response.Headers) { $hc[$h.Key] = ($h.Value -join ',') }
        return [PSCustomObject]@{ Status = $status; Content = $content; Headers = $hc }
      }
      Write-Host "[Invoke-WebSafe error] $Method $Uri : $($e.Message)" -ForegroundColor Red
      return [PSCustomObject]@{ Status = -1; Content = ""; Headers = @{} }
    }
    return
  }
  # Default: use Invoke-WebRequest (no Cookie header)
  $params = @{ Uri = $Uri; Method = $Method; UseBasicParsing = $true }
  if ($Headers.Count -gt 0) { $params.Headers = $Headers }
  if ($Body) { $params.Body = $Body }
  if ($ContentType) { $params.ContentType = $ContentType }
  try {
    $r = Invoke-WebRequest @params
    return [PSCustomObject]@{ Status = [int]$r.StatusCode; Content = $r.Content; Headers = $r.Headers }
  } catch {
    $e = $_.Exception
    if ($e.Response) {
      $status = [int]$e.Response.StatusCode
      $content = ""
      try {
        $reader = New-Object System.IO.StreamReader($e.Response.GetResponseStream())
        $content = $reader.ReadToEnd()
        $reader.Close()
      } catch { $content = "(could not read stream)" }
      return [PSCustomObject]@{ Status = $status; Content = $content; Headers = $e.Response.Headers }
    }
    return [PSCustomObject]@{ Status = -1; Content = ""; Headers = @{} }
  }
}

# ---- Robustly extract a named cookie value from a raw Set-Cookie collection.
# Handles both array-valued and comma-joined single-string header shapes.
function Get-CookieValue {
  param([object]$RawHeaders, [string]$Name)
  $set = $null
  $tn = $RawHeaders.GetType().FullName
  if ($tn -like '*WebHeaderCollection*') {
    $set = $RawHeaders['Set-Cookie']
  } elseif ($tn -like '*StringCollection*') {
    $set = $RawHeaders -join ', '
  } elseif ($tn -like '*Dictionary*' -and $RawHeaders['Set-Cookie'] -ne $null) {
    $set = $RawHeaders['Set-Cookie']
  } elseif ($RawHeaders -is [array]) {
    $set = $RawHeaders -join ', '
  } else {
    $set = $RawHeaders
  }
  if (-not $set) { return "" }
  $joined = if ($set -is [array]) { $set -join ', ' } else { $set }
  foreach ($chunk in ($joined -split ',')) {
    foreach ($seg in ($chunk -split ';')) {
      $seg = $seg.Trim()
      if ($seg -like "$Name=*") {
        $v = $seg.Substring($Name.Length + 1)
        if ($v) { return $v }
      }
    }
  }
  return ""
}

# ---- Build a Cookie header value: name=value pairs (no attrs). ----
function Get-CookieHeader([object]$RawHeaders) {
  $set = $null
  $tn = $RawHeaders.GetType().FullName
  if ($tn -like '*WebHeaderCollection*') {
    $set = $RawHeaders['Set-Cookie']
  } elseif ($tn -like '*StringCollection*') {
    $set = $RawHeaders -join ', '
  } elseif ($tn -like '*Dictionary*' -and $RawHeaders['Set-Cookie'] -ne $null) {
    $set = $RawHeaders['Set-Cookie']
  } elseif ($RawHeaders -is [array]) {
    $set = $RawHeaders -join ', '
  } else {
    $set = $RawHeaders
  }
  if (-not $set) { return "" }
  $joined = if ($set -is [array]) { $set -join ', ' } else { $set }
  $pairs = @()
  foreach ($chunk in ($joined -split ',')) {
    foreach ($seg in ($chunk -split ';')) {
      $seg = $seg.Trim()
      $idx = $seg.IndexOf('=')
      if ($idx -gt 0) {
        $n = $seg.Substring(0, $idx).Trim()
        $v = $seg.Substring($idx + 1)
        if ($n -and $v) { $pairs += "$n=$v" }
      }
    }
  }
  return ($pairs -join '; ')
}

Write-Host "[DONE] Shared utilities loaded." -ForegroundColor Gray
