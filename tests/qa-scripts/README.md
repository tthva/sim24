# SIM24 QA Test Scripts

## Prerequisites

- Node.js dev server running: `npm run dev` (default: http://localhost:3000)
- PostgreSQL running (via Docker): `docker compose up -d postgres`

## Directory Structure

```
tests/qa-scripts/
├── README.md                # This file
├── shared/
│   └── utils.ps1            # Shared helpers: phone/idempotency generation, request/response logging, assertions
├── forms/                   # Buy / Sell form tests
│   ├── test-buy-simple.ps1
│   ├── test-buy-soft-duplicate.ps1
│   ├── test-buy-try-valid.ps1
│   ├── test-sell-happy-strict-soft.ps1
│   ├── test-sell-market-happy-strict-soft.ps1   # TODO: confirm schema
│   └── test-sell-cons-happy-strict-soft.ps1     # TODO: confirm schema
├── search/
│   └── test-search-critical.ps1                 # TODO: confirm schema
├── investments/
│   └── test-investments-critical.ps1            # TODO: confirm schema
├── auth/
│   └── test-auth-critical.ps1                   # TODO: confirm endpoints
└── workflow/
    └── test-workflow-minimal-e2e.ps1            # TODO: confirm endpoints
```

## How to Run

### PowerShell scripts (recommended)

Run from the project root:

```powershell
# Buy — happy path with strict idempotency
powershell -ExecutionPolicy Bypass -File tests/qa-scripts/forms/test-buy-simple.ps1

# Buy — soft duplicate detection
powershell -ExecutionPolicy Bypass -File tests/qa-scripts/forms/test-buy-soft-duplicate.ps1

# Sell — 3 scenarios (happy, strict idempotency, soft duplicate)
powershell -ExecutionPolicy Bypass -File tests/qa-scripts/forms/test-sell-happy-strict-soft.ps1
```

### Batch scripts (legacy)

```cmd
run-tests.bat          # Critical-path: buy, sell, search, investments (happy + duplicate + validation)
run-tests-advanced.bat # Edge cases: idempotency, auth context, envelope compatibility
```

## Avoiding Soft-Duplicate Collisions

The soft-duplicate detection blocks repeat submissions with the **same phone number** within **10 seconds**.

All scripts use randomized phone numbers and idempotency keys via `shared/utils.ps1`:

```powershell
$phone = New-PhoneNumber -Prefix "091200"
$idemKey = New-IdempotencyKey -Prefix "qa-buy-simple"
```

This ensures each run is isolated from previous runs.

## Expected Status Codes

| Scenario | Status | Description |
|----------|--------|-------------|
| Happy path (new form) | **201** | Form created + workflow started |
| Strict idempotency (duplicate key) | **200** | `duplicate: true` in response |
| Soft duplicate (same data, no key) | **409** | `DUPLICATE_REQUEST` error |
| Validation error | **400** | `VALIDATION_ERROR` with field details |
| Unauthorized | **401** | Missing/invalid JWT |
| Forbidden | **403** | Insufficient role |
| Workflow failure | **500** | `WORKFLOW_START_FAILED` |

## Notes

- Scaffold scripts marked with **TODO** are placeholders pending schema confirmation by Blackbox.
- Do not edit production code (`app/`, `lib/`, `prisma/`) from these scripts.
- For HTTP, only `Invoke-WebRequest` or `Invoke-RestMethod` are used.