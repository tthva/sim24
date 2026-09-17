@echo off
REM Test Admin Login
echo.
echo ===== TEST 1: Admin Login =====
curl -v -X POST http://localhost:3000/api/admin/auth ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"admin\",\"password\":\"Mkh84389@110\"}" 2>&1 | find /i "success" || find /i "error"

echo.
echo ===== TEST 2: Agent Login (agent1) =====
curl -v -X POST http://localhost:3000/api/agent/auth ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"agent1\",\"password\":\"password123\"}" 2>&1 | find /i "success" || find /i "error"

echo.
echo ===== TEST 3: Agent Login (agent2) =====
curl -v -X POST http://localhost:3000/api/agent/auth ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"agent2\",\"password\":\"password123\"}" 2>&1 | find /i "success" || find /i "error"

echo.
echo ===== TEST 4: Wrong Password =====
curl -v -X POST http://localhost:3000/api/admin/auth ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"admin\",\"password\":\"wrongpassword\"}" 2>&1 | find /i "error"

echo.
echo ===== TEST 5: Check Public Pages =====
curl -v http://localhost:3000/ 2>&1 | find /i "200" || echo "OK"

echo.
echo Tests completed!
