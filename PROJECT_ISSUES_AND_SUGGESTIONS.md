# PROJECT_ISSUES_AND_SUGGESTIONS — SIM24

> **محدوده:** تحلیل معماری/پیکربندی + نتایج تست‌های عملی اخیر (Buy/Sell) + پیشنهادهای اجرایی اولویت‌دار  
> **نسخه:** 1.0 (براساس خروجی‌ها و تست‌هایی که انجام شد)

---

## 1) خلاصه نتایج تست‌های اخیر (Buy و Sell)

### 1.1 Buy — صحت Zod Validation + پاکت استاندارد موفق/خطا (Envelopes)
**مسیر تست‌شده:** `POST /api/forms/buy` (در App Router)

موارد کلیدی که تثبیت شد:

1) **Strict Idempotency (با header `x-idempotency-key`)**
- درخواست اول: **201**
- درخواست دوم با همان کلید:
  - **200**
  - `success=true`
  - `meta.duplicate=true`
  - `workflowStarted=false`
  - همان id نسبت به درخواست اول (طبق QA)

2) **Soft Duplicate (بدون header)**
- درخواست اول: **201**
- درخواست دوم پشت‌سرهم (در پنجره زمانی 10s):
  - **409**
  - `success=false`
  - `error.code = "DUPLICATE_REQUEST"`
  - `error.message = "A similar request was submitted recently"`

3) **Zod Validation / Error Code**
- برای سناریوهای نامعتبر، پاسخ:
  - **400**
  - `error.code = "VALIDATION_ERROR"`
  - `error.message = "خطا در اعتبارسنجی داده‌ها"`

> نکته: در مسیرهای Buy، منطق duplicate مطابق rule شما کار می‌کرد:
> - **اگر `x-idempotency-key` باشد → strict idempotency و برگشت نتیجه قبلی با envelope موفق (200)**
> - **اگر header نباشد → soft duplicate و بازگرداندن Conflict (409)**

---

### 1.2 Sell — اصلاح Payload با فیلدهای صحیح `d*` + اعداد `dProv/dCity`
**مسیر واقعی route تست:** `app/(api)/forms/sell/route.ts`  
**علت 400های اولیه:** payload تست sell از فیلدهای `d*` استفاده نمی‌کرد (کلیدهایی مثل `nm/fm/ph/...` ارسال شده بود)، در حالی که Zod schema برای `sell_direct` کلیدهای زیر را می‌طلبد:
- `dNm, dFm, dPh, dProv, dCity, dBD, dBM, dBY, dOwn, dCond, dSimPh, dHk`

#### تغییرات اعمال‌شده روی تست
- فایل `test-sell-happy-strict-soft.ps1` به payload معتبر `sell_direct` تغییر کرد:
  - `dProv/dCity` عددی شدند (Zod فقط number می‌خواهد)
  - `dOwn/dCond` با enumهای درست match شدند
  - تاریخ با فرمت مورد انتظار Zod (`dBD/dBM` دو رقمی، `dBY` چهار رقمی/رشته regex) فرستاده شد

#### سناریوهای Critical-path (Sell) — نتیجه نهایی
**payload جدید Sell Direct (طبق درخواست شما)**
```json
{
  "formType": "sell_direct",
  "formData": {
    "dNm": "test",
    "dFm": "test",
    "dPh": "09120000000",
    "dProv": 8,
    "dCity": 101,
    "dBD": "01",
    "dBM": "01",
    "dBY": "1370",
    "dOwn": "self",
    "dCond": "used",
    "dSimPh": "09121111111",
    "dHk": "0"
  }
}
```

**انتظار/نتیجه:**

1) **Happy Path**
- **201**
- `success=true`
- `workflowStarted=true`

2) **Strict Idempotency** (با `x-idempotency-key`)
- Request #1: **201**
- Request #2:
  - **200**
  - `success=true`
  - `meta.duplicate=true`
  - `workflowStarted=false`

3) **Soft Duplicate** (بدون header)
- Request #1: **201**
- Request #2:
  - **409**
  - `success=false`
  - `error.code="DUPLICATE_REQUEST"`

#### لاگ pinpoint برای Validation (کمک به pinpointing)
در `app/(api)/forms/sell/route.ts` یک `console.error` برای چاپ `err.issues` اضافه شد تا مشخص شود چه فیلدهایی Zod را fail می‌کند:
- `SELL_VALIDATION_ERROR_ISSUES: { formType, issues }`

---

## 2) ریسک‌ها و مشکلات معماری/پیکربندی

### 2.1 تداخل کتابخانه‌های JWT (jose vs jsonwebtoken)
**ریسک (High):**
- در پروژه، هر دو ماژول `jose` و `jsonwebtoken` وجود دارند.
- اگر در routeها/utilityها برای sign/verify یا ساخت claimها از mix استفاده شود، ممکن است:
  - ناسازگاری در format payload
  - ناسازگاری در validation (alg, iss, exp)
  - باگ‌های امنیتی ظریف (مثلاً تایید با کلید اشتباه یا تفسیر متفاوت claims)

**پیشنهاد:**
- استانداردسازی روی **یک کتابخانه** (ترجیحاً همان که در pipeline اصلی استفاده می‌شود).
- در صورت نیاز به مهاجرت، یک لایه adapter بسازید و در کل کد فقط از آن استفاده کنید.

---

### 2.2 next.config.mjs — rewrite سراسری `/api/:path* -> /:path*`
**ریسک (Critical):**
- rewrite سراسری می‌تواند باعث شود:
  - مسیرهای داخلی Next به شکلی غیرمنتظره resolve شوند
  - یا requestهای API با مسیرهای page/route collision کنند
- در سیستم‌های auth-sensitive و workflow-sensitive، یک collision کوچک می‌تواند باعث:
  - bypass policy
  - یا اجرای handler غلط

**پیشنهاد:**
- rewrite را محدود کنید یا شرط‌هایی برای مسیرهای واقعی API لحاظ کنید.
- برای endpoints حیاتی یک suite تست مسیر انجام دهید (auth + workflow + forms).

---

### 2.3 next.config.mjs — `images.unoptimized: true`
**ریسک (Medium):**
- از نظر امنیتی غالباً مشکل مستقیم ندارد، اما:
  - باعث کاهش caching/optimization در تصویرها می‌شود
  - می‌تواند performance را تحت فشار بگذارد

**پیشنهاد:**
- در production رفتار مناسب تصاویر را بررسی کنید (اگر در prod نیاز به unoptimized ندارید، فعال نشود).

---

### 2.4 امنیت متغیرهای محیطی و Secret Rotation Policy
**ریسک (Critical):**
- `.env.example` شامل اطلاعات حساس بالقوه/الگوهای secret است.
- اگر secrets در repo/CI افشا شوند یا rotation policy وجود نداشته باشد، ریسک امنیتی بالا می‌رود.

**پیشنهاد:**
- `JWT_SECRET` و کلیدهای دیگر:
  - فقط در محیط‌های امن مدیریت شوند (Vault/CI secrets)
  - rotation policy با زمان‌بندی مشخص داشته باشند
- در `Production` حداقل این موارد را enforce کنید:
  - عدم وجود secrets در log
  - محدودسازی دسترسی به کانتینر/volumes

---

### 2.5 ابهام و پیچیدگی معماری Workflow Engine (E2E Test ضروری)
**ریسک (High):**
- مدل‌های Workflow قوی هستند، ولی بدون تست E2E این ریسک وجود دارد:
  - state transitionهای اشتباه بین stepها
  - ناسازگاری data payload با schema step
  - خطا در `startWorkflow/completeStep/reassignStep` که فقط در runtime خودش را نشان می‌دهد

**پیشنهاد:**
- ساخت تست سناریومحور (E2E) برای چرخه کامل:
  - start → complete → timeline → reassign/reject
- برای هر workflow code حداقل یک happy path و یک error path تست کنید.

---

## 3) پیشنهادهای اجرایی (Actionable Recommendations)

> قالب: **اولویت (Critical/High/Medium/Low)** + **نوع اصلاح (Quick Win / Refactor / Architectural)**

---

### 3.1 Critical Priority

#### C1) محدودسازی یا بازنگری rewrite سراسری API
- **Priority:** Critical
- **Type:** Architectural
- **Impact:** جلوگیری از collision و bypass routing

**اقدام:**
- rewrite rule را محدود کنید تا فقط مسیرهای مورد نیاز پوشش داده شود.
- بعد از تغییر، تست‌های زیر را اجرا کنید:
  - `/api/forms/buy`
  - `/api/forms/sell`
  - `/api/auth/check`
  - workflow endpoints (start/complete/reassign)

---

#### C2) استانداردسازی JWT backend
- **Priority:** Critical
- **Type:** Refactor
- **Impact:** کاهش ریسک امنیتی و باگ‌های claim/verify

**اقدام:**
- تعیین کنید کدام کتابخانه “source of truth” است.
- استفاده از کتابخانه دیگر را حذف یا در adapter encapsulate کنید.

---

#### C3) سیاست Secret Rotation و حذف اطلاعات حساس از log/ci
- **Priority:** Critical
- **Type:** Quick Win / Architectural
- **Impact:** کاهش ریسک افشای secret

**اقدام:**
- یک سند کوتاه SOP بنویسید:
  - rotation schedule
  - re-issuance strategy برای JWT
  - roll-back strategy

---

### 3.2 High Priority

#### H1) اضافه کردن E2E تست‌های Workflow Engine
- **Priority:** High
- **Type:** Architectural
- **Impact:** جلوگیری از خطاهای runtime و state mismatch

**اقدام:**
- سناریوهای زیر را تست کنید:
  - happy path برای `SELL_DIRECT` و `BUY_DIRECT`
  - error path (مثلاً workflow start failure)
  - duplicate handling در presence/absence of idempotency key

---

#### H2) تعریف Access/Policy چک لیست برای auth/admin/agent/operator
- **Priority:** High
- **Type:** Quick Win
- **Impact:** جلوگیری از ناسازگاری role enforcement

**اقدام:**
- برای هر endpoint:
  - role موردنیاز
  - method موردنیاز
  - behavior در نبود token
  - behavior در token invalid

---

### 3.3 Medium Priority

#### M1) بهینه‌سازی `images.unoptimized` در production
- **Priority:** Medium
- **Type:** Quick Win
- **Impact:** بهبود performance

---

#### M2) یکپارچه‌سازی envelope/error envelope برای همه endpoints
- **Priority:** Medium
- **Type:** Refactor
- **Impact:** کاهش پیچیدگی client

**اقدام:**
- یک contract واحد تعریف و اعمال شود:
  - success: `success=true` و `data` شامل `message/id/...`
  - error: `success=false` و `error:{code,message,meta?}`

> در حال حاضر برای buy/sell با موفقیت استانداردسازی بخشی انجام شده (طبق نتایج تست).

---

### 3.4 Low Priority

#### L1) بهبود کیفیت logging debug
- **Priority:** Low
- **Type:** Quick Win
- **Impact:** کمک به دیباگ بدون آلودگی لاگ

**اقدام:**
- `console.error`های debug را با env flag کنترل کنید.

---

## 4) وضعیت فعلی و گام بعدی پیشنهادی
- تست‌های Critical-path اخیر روی **buy** و **sell_direct** موفق بودند:
  - Buy: 201 + strict(200 duplicate) + soft(409 DUPLICATE_REQUEST)
  - Sell: Zod schema درست شد با payload `d*` و عددی کردن `dProv/dCity` + سناریوها مطابق انتظار

**گام بعدی پیشنهادی:**
- Critical-path برای:
  - `sell_market`
  - `sell_cons`
- سپس E2E برای workflowهای مربوط به این formTypeها.

---

## ضمیمه: فایل‌های کلیدی که در این تلاش نقش داشتند
- `app/(api)/forms/sell/route.ts`
  - افزودن pinpoint لاگ برای `ZodError.issues`
- `test-sell-happy-strict-soft.ps1`
  - اصلاح payload و اجرای سناریوهای duplicate/idempotency
- (در تلاش Buy مشابه) `test-buy-soft-duplicate.ps1` و تست‌های buy دیگر
