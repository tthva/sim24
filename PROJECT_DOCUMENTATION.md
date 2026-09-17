# 📱 SIM24 - مستندات فنی پروژه

> **نسخه:** 0.1.0  
> **تاریخ بروزرسانی:** 11 ژوئن 2026  
> **نویسنده:** تیم توسعه SIM24

---

## 📋 فهرست مطالب

1. [معرفی کلی پروژه](#1-معرفی-کلی-پروژه)
2. [معماری و استک فنی](#2-معماری-و-استک-فنی)
3. [ساختار پروژه](#3-ساختار-پروژه)
4. [مدل‌های دیتابیس (Prisma Schema)](#4-مدلهای-دیتابیس-prisma-schema)
5. [سیستم احراز هویت](#5-سیستم-احراز-هویت)
6. [API Routes](#6-api-routes)
7. [صفحات (Pages)](#7-صفحات-pages)
8. [کامپوننت‌ها (Components)](#8-کامپوننتها-components)
9. [کتابخانه‌های کمکی (Lib)](#9-کتابخانههای-کمکی-lib)
10. [استایل‌دهی و تم](#10-استایلدهی-و-تم)
11. [نقشه راه و کارهای باقی‌مانده](#11-نقشه-راه-و-کارهای-باقیمانده)

---

## 1. معرفی کلی پروژه

**SIM24** یک پلتفرم جامع آنلاین برای خرید، فروش، کارشناسی قیمت و سرمایه‌گذاری در حوزه سیم‌کارت‌های موبایل ایران است. این پلتفرم با هدف ایجاد بازاری امن و شفاف برای معاملات سیم‌کارت طراحی شده و خدمات زیر را ارائه می‌دهد:

- 🛒 **خرید امن سیم‌کارت** (نقدی، اقساطی، پیش‌سفارش)
- 💰 **فروش امن سیم‌کارت** (مستقیم، امانی، تعویض/بازار)
- 📊 **کارشناسی قیمت سیم‌کارت** (استعلام ارزش واقعی بازار)
- 📈 **سرمایه‌گذاری امن** (مشارکت در فروش اقساط و خرید و فروش)

### ذی‌نفعان سیستم

| نقش | توضیح |
|-----|-------|
| **Admin (مدیر)** | مدیریت کل سیستم، ایجاد و مدیریت نمایندگان (Agents)، مشاهده فرم‌های مشتریان |
| **Agent (نماینده)** | ثبت فرم‌های مشتریان، مشاهده آمار و گزارش‌های عملکرد خود |
| **User (کاربر عادی)** | کاربران نهایی که از طریق صفحه ورود احراز هویت می‌شوند |
| **Customer (مشتری)** | کاربران بدون احراز هویت که فرم‌های خرید/فروش/سرمایه‌گذاری را پر می‌کنند |

---

## 2. معماری و استک فنی

### تکنولوژی‌های اصلی

| دسته | تکنولوژی | نسخه |
|------|----------|------|
| **فریم‌ورک** | Next.js (App Router) | ^16.2.7 |
| **زبان** | TypeScript | ^5 |
| **UI** | React | ^18 |
| **استایل‌دهی** | Tailwind CSS | ^3.3.0 |
| **ORM** | Prisma | ^5.22.0 |
| **دیتابیس** | PostgreSQL | - |
| **احراز هویت** | JWT (jose) | ^6.2.3 |
| **هش رمز عبور** | bcryptjs | ^3.0.3 |
| **اعتبارسنجی** | Zod | ^4.4.3 |
| **فونت** | Vazirmatn | ^33.0.3 |
| **تاریخ شمسی** | Zaman | ^2.1.1 |

### معماری کلی

```
┌─────────────────────────────────────────────────────────┐
│                    Client (Browser)                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │  Home    │ │   Buy    │ │   Sell   │ │  Invest     │ │
│  │  Page    │ │   Page   │ │   Page   │ │   Page      │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬──────┘ │
│       │             │             │               │       │
│  ┌────┴─────────────┴─────────────┴───────────────┴────┐ │
│  │              API Layer (Next.js Route Handlers)      │ │
│  │  /api/auth/*  /api/forms/*  /api/investments/*      │ │
│  │  /api/sim-value  /api/webhook/*  /api/agent/*       │ │
│  └────────────────────────┬────────────────────────────┘ │
└───────────────────────────┼──────────────────────────────┘
                            │
┌───────────────────────────┼──────────────────────────────┐
│                    Server Side                            │
│  ┌────────────────────────┴────────────────────────────┐ │
│  │              Prisma ORM + PostgreSQL                 │ │
│  │  Admin | Agent | CustomerForm | User | WebhookEvent │ │
│  └─────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              Middleware (JWT Verification)           │ │
│  │  /admin/* → role=admin   /agent/* → role=agent      │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

## 3. ساختار پروژه

```
g:\tet\
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root Layout (RTL, Vazirmatn)
│   ├── page.tsx                  # صفحه اصلی (Home)
│   ├── globals.css               # استایل‌های سراسری
│   ├── (api)/                    # API Routes (Route Handlers)
│   │   ├── auth/                 # احراز هویت کاربران
│   │   │   ├── login/route.ts    # POST - ورود کاربر
│   │   │   ├── logout/route.ts   # POST - خروج کاربر
│   │   │   └── check/route.ts    # GET - بررسی وضعیت احراز هویت
│   │   ├── admin/                # پنل مدیریت
│   │   │   ├── auth/             # احراز هویت ادمین
│   │   │   ├── login/            # ورود ادمین
│   │   │   ├── panel/            # داشبورد ادمین
│   │   │   ├── agents/           # مدیریت نمایندگان
│   │   │   └── forms/            # مشاهده فرم‌ها
│   │   ├── agent/                # پنل نماینده
│   │   │   ├── auth/             # احراز هویت نماینده
│   │   │   ├── forms/            # فرم‌های نماینده
│   │   │   ├── me/               # اطلاعات پروفایل
│   │   │   └── stats/route.ts    # GET - آمار نماینده
│   │   ├── forms/                # فرم‌های مشتریان
│   │   │   ├── buy/route.ts      # POST - فرم خرید
│   │   │   ├── sell/route.ts     # POST - فرم فروش
│   │   │   └── search/route.ts   # POST - فرم کارشناسی
│   │   ├── investments/route.ts  # POST - فرم سرمایه‌گذاری
│   │   ├── sim-value/route.ts    # GET - استعلام ارزش سیم‌کارت
│   │   └── webhook/crm/route.ts  # POST - وب‌هوک CRM
│   ├── buy/                      # صفحه خرید
│   ├── sell/                     # صفحه فروش
│   ├── invest/                   # صفحه سرمایه‌گذاری
│   ├── search/                   # صفحه کارشناسی قیمت
│   ├── login/                    # صفحه ورود
│   ├── admin/                    # صفحات پنل مدیریت
│   ├── agent/                    # صفحات پنل نماینده
│   ├── settings/                 # صفحه تنظیمات
│   └── terms/                    # صفحه قوانین و مقررات
├── components/                   # کامپوننت‌های React
│   ├── Layout.tsx                # layout wrapper (max-width: 440px)
│   ├── GlassCard.tsx             # کارت شیشه‌ای (Glassmorphism)
│   ├── FieldSet.tsx              # فیلد ورودی با label شناور
│   ├── Navbar.tsx                # نوار ناوبری
│   ├── BottomLogo.tsx            # لوگوی پایین صفحه
│   ├── AcceptTerms.tsx           # چک‌باکس پذیرش قوانین
│   ├── HowKnow.tsx               # انتخاب نحوه آشنایی
│   ├── TimeLine.tsx              # انتخاب بازه زمانی
│   ├── Consignment.tsx           # فرم فروش امانی
│   ├── Installment.tsx           # فرم خرید اقساطی
│   ├── Preorder.tsx              # فرم پیش‌سفارش
│   ├── SelectUs.tsx              # کامپوننت "چرا ما؟"
│   ├── AutocompleteField.tsx     # فیلد جستجوی خودکار (استان/شهر)
│   ├── MarketSwap.tsx            # کامپوننت تعویض سیم‌کارت
│   └── WithAuth.tsx              # HOC محافظت از صفحات
├── lib/                          # کتابخانه‌های کمکی
│   ├── prisma.ts                 # Prisma Client (Singleton)
│   ├── auth.ts                   # توابع کمکی احراز هویت (Client-side)
│   ├── jwt.ts                    # sign/verify توکن JWT
│   ├── password.ts               # hash/compare رمز عبور
│   ├── iranData.ts               # داده‌های استان‌ها و شهرهای ایران
│   └── useFormPersist.ts         # هوک ذخیره‌سازی فرم در localStorage
├── prisma/
│   ├── schema.prisma             # مدل‌های دیتابیس
│   ├── seed.ts                   # داده‌های اولیه (Seed)
│   └── migrations/               # مایگریشن‌های دیتابیس
├── public/                       # فایل‌های استاتیک
│   ├── fonts/                    # فونت Vazirmatn
│   ├── logo.png                  # لوگوی اصلی
│   └── *.svg, *.png              # آیکون‌ها و تصاویر
├── middleware.ts                 # Middleware احراز هویت مسیرها
├── next.config.mjs               # تنظیمات Next.js
├── tailwind.config.ts            # تنظیمات Tailwind CSS
├── tsconfig.json                 # تنظیمات TypeScript
├── package.json                  # وابستگی‌ها و اسکریپت‌ها
├── ecosystem.config.js           # تنظیمات PM2
└── .env.local                    # متغیرهای محیطی
```

---

## 4. مدل‌های دیتابیس (Prisma Schema)

### 4.1 Admin (مدیر سیستم)

| فیلد | نوع | توضیح |
|------|-----|-------|
| `id` | String (CUID) | شناسه یکتا |
| `username` | String (Unique) | نام کاربری |
| `password` | String | رمز عبور هش شده |
| `createdAt` | DateTime | تاریخ ایجاد |
| `agents` | Agent[] | رابطه یک به چند با نمایندگان |

### 4.2 Agent (نماینده)

| فیلد | نوع | توضیح |
|------|-----|-------|
| `id` | String (CUID) | شناسه یکتا |
| `username` | String (Unique) | نام کاربری |
| `password` | String | رمز عبور هش شده |
| `fullName` | String? | نام کامل |
| `phone` | String? | شماره تماس |
| `active` | Boolean | وضعیت فعال/غیرفعال (پیش‌فرض: true) |
| `lastLogin` | DateTime? | آخرین زمان ورود |
| `adminId` | String | کلید خارجی به Admin |
| `admin` | Admin | رابطه چند به یک با Admin |
| `forms` | CustomerForm[] | رابطه یک به چند با فرم‌های مشتریان |

### 4.3 CustomerForm (فرم مشتری)

| فیلد | نوع | توضیح |
|------|-----|-------|
| `id` | String (CUID) | شناسه یکتا |
| `phone` | String? | شماره تماس مشتری |
| `fullName` | String? | نام کامل مشتری |
| `nationalId` | String? | کد ملی |
| `formType` | String | نوع فرم (buy_direct, sell_cons, invest_installment, ...) |
| `formData` | Json | داده‌های فرم (ساختار پویا) |
| `metadata` | Json? | متادیتای اضافی |
| `agentId` | String? | کلید خارجی به Agent (نماینده ارجاع‌دهنده) |
| `agent` | Agent? | رابطه چند به یک با Agent |

### 4.4 User (کاربر عادی)

| فیلد | نوع | توضیح |
|------|-----|-------|
| `id` | String (CUID) | شناسه یکتا |
| `username` | String (Unique) | نام کاربری |
| `password` | String | رمز عبور هش شده |
| `phone` | String? | شماره تماس |
| `fullName` | String? | نام کامل |
| `active` | Boolean | وضعیت فعال/غیرفعال |
| `lastLogin` | DateTime? | آخرین زمان ورود |

### 4.5 WebhookEvent (رویداد وب‌هوک)

| فیلد | نوع | توضیح |
|------|-----|-------|
| `id` | String (CUID) | شناسه یکتا |
| `event` | String | نوع رویداد |
| `payload` | String | داده‌های رویداد (JSON string) |
| `status` | String | وضعیت: pending, sent, failed |

### نمودار ER

```
┌──────────┐       ┌──────────┐       ┌──────────────┐
│  Admin   │───1:N──│  Agent   │───1:N──│ CustomerForm │
└──────────┘       └──────────┘       └──────────────┘
                                            │
┌──────────┐       ┌──────────────┐         │ (optional)
│   User   │       │ WebhookEvent │         │
└──────────┘       └──────────────┘         │
                                       agentId (FK)
```

---

## 5. سیستم احراز هویت

### 5.1 معماری احراز هویت

سیستم احراز هویت بر پایه **JWT (JSON Web Token)** با استفاده از کتابخانه `jose` پیاده‌سازی شده است. توکن‌ها در **httpOnly Cookie** ذخیره می‌شوند تا از حملات XSS جلوگیری شود.

### 5.2 سطوح دسترسی (Roles)

| نقش | دسترسی‌ها |
|-----|----------|
| **admin** | پنل مدیریت، مدیریت نمایندگان، مشاهده تمام فرم‌ها |
| **agent** | پنل نماینده، ثبت فرم مشتری، مشاهده آمار خود |
| **user** | ورود به بخش‌های محافظت‌شده کاربری |

### 5.3 فایل‌های مرتبط

| فایل | توضیح |
|------|-------|
| `lib/jwt.ts` | توابع `signToken` و `verifyToken` با الگوریتم HS256 |
| `lib/password.ts` | توابع `hashPassword` و `comparePassword` با bcryptjs |
| `lib/auth.ts` | توابع کمکی Client-side: `getToken`, `isAuthenticated`, `logout` |
| `middleware.ts` | محافظت از مسیرهای `/admin/*` و `/agent/*` |
| `components/WithAuth.tsx` | Higher-Order Component برای محافظت از صفحات |

### 5.4 جریان ورود (Login Flow)

```
1. کاربر نام کاربری و رمز عبور را وارد می‌کند
2. اعتبارسنجی اولیه در سمت کلاینت (regex)
3. ارسال به /api/auth/login با POST
4. جستجوی کاربر در دیتابیس (prisma.user.findUnique)
5. مقایسه رمز عبور با bcrypt.compare
6. اعتبارسنجی کد OTP (فعلاً هر کد ۶ رقمی پذیرفته می‌شود)
7. بروزرسانی lastLogin
8. ایجاد JWT با signToken (شامل id و role)
9. تنظیم Cookie با نام "token" (httpOnly, secure, sameSite: strict)
10. بازگشت پاسخ موفقیت به کلاینت
```

### 5.5 جریان بررسی احراز هویت

```
1. کلاینت GET /api/auth/check را فراخوانی می‌کند
2. سرور توکن را از Cookie می‌خواند
3. توکن با jwtVerify اعتبارسنجی می‌شود
4. در صورت موفقیت: { authenticated: true, role, id } برگردانده می‌شود
5. در صورت شکست: { authenticated: false } با status 401
```

### 5.6 Middleware محافظت از مسیرها

```typescript
// مسیرهای محافظت‌شده:
ADMIN_ROUTES = ["/admin/panel", "/admin/agents", "/admin/forms"]
AGENT_ROUTES = ["/agent/panel", "/agent/forms"]

// مسیرهای احراز هویت (بدون نیاز به توکن):
AUTH_ADMIN_ROUTES = ["/admin/auth"]
AUTH_AGENT_ROUTES = ["/agent/auth"]
```

---

## 6. API Routes

### 6.1 احراز هویت

#### `POST /api/auth/login`
ورود کاربر با username، password و OTP.

**Request Body:**
```json
{
  "username": "string",
  "password": "string",
  "otp": "string (6 digits)"
}
```

**Response (200):**
```json
{
  "success": true,
  "user": { "id": "string", "username": "string" }
}
```

#### `POST /api/auth/logout`
خروج کاربر و حذف Cookie توکن.

#### `GET /api/auth/check`
بررسی وضعیت احراز هویت کاربر.

**Response (200):**
```json
{
  "authenticated": true,
  "role": "user",
  "id": "string"
}
```

---

### 6.2 فرم‌های خرید

#### `POST /api/forms/buy`
ثبت فرم خرید سیم‌کارت.

**formType‌های پشتیبانی‌شده:**
- `buy_direct` - خرید نقدی
- `buy_market` - خرید از بازار
- `buy_cons` - خرید امانی
- `buy_installment` - خرید اقساطی
- `buy_preorder` - پیش‌سفارش

**اعتبارسنجی با Zod:**
- `buyFormSchema`: نام، نام خانوادگی، موبایل (09xxxxxxxxx)، استان، شهر، تاریخ تولد، شماره دلخواه، نحوه آشنایی، وضعیت (new/used)
- `installmentFormSchema`: نام، نام خانوادگی، موبایل، مبلغ سیمکارت، پیش‌پرداخت، تعداد اقساط (۱-۱۲)، نحوه آشنایی
- `preorderFormSchema`: نام، نام خانوادگی، موبایل، توضیحات، نحوه آشنایی

**تشخیص agentId:**
1. اولویت اول: query parameter `?agentId=xxx`
2. اولویت دوم: JWT cookie (اگر کاربر agent باشد)

---

### 6.3 فرم‌های فروش

#### `POST /api/forms/sell`
ثبت فرم فروش سیم‌کارت.

**formType‌های پشتیبانی‌شده:**
- `sell_direct` - فروش مستقیم
- `sell_market` - فروش در بازار (تعویض)
- `sell_cons` - فروش امانی

**فیلدهای فروش مستقیم (sell_direct):**
نام، نام خانوادگی، موبایل، استان (number)، شهر (number)، تاریخ تولد، مالکیت (self/other)، وضعیت (new/used)، شماره فروشی، نحوه آشنایی

**فیلدهای فروش بازار (sell_market):**
نام، نام خانوادگی، موبایل، استان، شهر، تاریخ تولد، شماره امانت، قیمت، مدت زمان، مالکیت، وضعیت، نحوه آشنایی

---

### 6.4 فرم کارشناسی قیمت

#### `POST /api/forms/search`
ثبت درخواست کارشناسی قیمت (ارزش واقعی بازار).

**formType‌های پشتیبانی‌شده:**
- `real_market_value` - استعلام ارزش واقعی
- `search` - جستجو

---

### 6.5 فرم سرمایه‌گذاری

#### `POST /api/investments`
ثبت فرم سرمایه‌گذاری.

**Request Body:**
```json
{
  "it": "installment | buy-sell",
  "nm": "نام",
  "fm": "نام خانوادگی",
  "ph": "09xxxxxxxxx",
  "hk": "نحوه آشنایی"
}
```

---

### 6.6 استعلام ارزش سیم‌کارت

#### `GET /api/sim-value?phoneNumber=09xxxxxxxxx&condition=dry|used`
استعلام ارزش تقریبی سیم‌کارت (در حال حاضر Mock).

**Response:**
```json
{
  "status": "success",
  "message": "استعلام با موفقیت انجام شد.",
  "result": {
    "phoneNumber": "09xxxxxxxxx",
    "condition": "dry",
    "operator": "همراه اول",
    "status": "شماره رند (طلایی)",
    "owner": "نامشخص (نیاز به استعلام از اپراتور)",
    "value": "نیاز به کارشناسی",
    "lastDigits": "1234"
  }
}
```

**ویژگی‌ها:**
- تشخیص اپراتور (همراه اول، ایرانسل، رایتل) بر اساس prefix
- تشخیص شماره‌های رند (طلایی) با الگوریتم regex
- پشتیبانی از ۳۲ prefix مختلف

---

### 6.7 آمار نماینده

#### `GET /api/agent/stats`
دریافت آمار عملکرد نماینده (نیاز به احراز هویت agent).

**Response:**
```json
{
  "totalForms": 150,
  "uniqueCustomers": 120,
  "byType": { "buy": 50, "sell": 60, "invest": 40 },
  "monthly": [{ "month": "2026-01", "count": 12 }, ...],
  "weekly": [{ "week": "2026-W23", "count": 5 }, ...]
}
```

---

### 6.8 وب‌هوک CRM

#### `POST /api/webhook/crm`
دریافت رویدادهای خارجی و ذخیره در دیتابیس (جهت یکپارچگی با CRM در آینده).

---

## 7. صفحات (Pages)

### 7.1 صفحه اصلی (`/`)

**فایل:** `app/page.tsx`

صفحه اصلی شامل ۴ کارت منو است:
1. **فروش امن** → `/sell`
2. **خرید امن** → `/buy`
3. **کارشناسی قیمت** → `/search`
4. **سرمایه‌گذاری امن** → `/invest`

**ویژگی‌ها:**
- تشخیص `agentId` از URL query parameter و ذخیره در localStorage
- ارسال خودکار agentId به صفحات مقصد
- انیمیشن‌های fadeUp با delay‌های مختلف
- طراحی واکنش‌گرا (max-width: 440px)

---

### 7.2 صفحه خرید (`/buy`)

**فایل:** `app/buy/page.tsx`

سه تب برای انواع خرید:
1. **خرید نقدی** - فرم کامل با فیلدهای نام، نام خانوادگی، موبایل، استان، شهر، تاریخ تولد، شماره دلخواه، نحوه آشنایی
2. **خرید اقساطی** - کامپوننت `Installment` (مبلغ سیمکارت، پیش‌پرداخت، تعداد اقساط)
3. **پیش‌سفارش** - کامپوننت `Preorder` (توضیحات سفارش)

**ویژگی‌ها:**
- ذخیره‌سازی خودکار فرم در localStorage (کلید: `buyForm`)
- بازیابی اطلاعات فرم در صورت رفرش صفحه
- مودال تأیید اطلاعات قبل از ارسال نهایی
- اعتبارسنجی کامل فیلدها

---

### 7.3 صفحه فروش (`/sell`)

**فایل:** `app/sell/page.tsx`

سه تب برای انواع فروش:
1. **فروش مستقیم** - فروش سیمکارت به صورت مستقیم
2. **تعویض سیمکارت** - فروش در بازار با قابلیت تعویض
3. **فروش امانی** - کامپوننت `Consignment`

**ویژگی‌ها:**
- AutocompleteField برای انتخاب استان و شهر (با داده‌های واقعی ایران)
- RadioButtons برای انتخاب مالکیت و وضعیت
- TimeLine برای انتخاب مدت زمان
- فرمت خودکار قیمت (جداسازی سه‌رقمی)
- اعتبارسنجی تاریخ تولد (حداقل ۱۷ سال)
- ذخیره‌سازی در localStorage (کلید: `sellForm`)

---

### 7.4 صفحه سرمایه‌گذاری (`/invest`)

**فایل:** `app/invest/page.tsx`

**بخش‌ها:**
1. **درباره سیم‌کارت ۲۴** - متن معرفی شرکت (قابل باز و بسته شدن)
2. **انتخاب نوع سرمایه‌گذاری:**
   - مشارکت در فروش اقساط با سود ثابت ماهانه (۶٪)
   - مشارکت در خرید و فروش (بانکداری سیمکارت ۰۹۱۲) با سود ۵۰-۱۰۰٪ سالیانه
3. **کامپوننت SelectUs** - نمایش مزایای رقابتی
4. **فرم ثبت‌نام** - نام، نام خانوادگی، موبایل، نحوه آشنایی

---

### 7.5 صفحه کارشناسی قیمت (`/search`)

**فایل:** `app/search/page.tsx`

**بخش‌ها:**
1. **ورودی شماره موبایل** - با فرمت فارسی و debounce 600ms
2. **انتخاب وضعیت** - خشک / کارکرده
3. **نمایش نتیجه استعلام** - اپراتور، وضعیت (رند/معمولی)، مالک
4. **فرم درخواست کارشناسی** - نام، نام خانوادگی، شماره تماس، نحوه آشنایی
5. **دکمه‌های اقدام** - فروش امانی، ارزش واقعی بازار، فروش سیمکارت

---

### 7.6 صفحه ورود (`/login`)

**فایل:** `app/login/page.tsx`

**جریان دو مرحله‌ای:**
1. **مرحله اول:** ورود نام کاربری و رمز عبور
   - اعتبارسنجی: نام کاربری (انگلیسی، حداقل ۳ کاراکتر)، رمز عبور (انگلیسی، حداقل ۴ کاراکتر)
2. **مرحله دوم:** ورود کد ۶ رقمی OTP
   - تایمر ۶۰ ثانیه‌ای برای ارسال مجدد
   - در حال حاضر هر کد ۶ رقمی پذیرفته می‌شود (SMS integration در آینده)

**ویژگی‌ها:**
- redirect خودکار به `/` در صورت احراز هویت قبلی
- نمایش خطاهای اعتبارسنجی به صورت real-time

---

## 8. کامپوننت‌ها (Components)

### 8.1 Layout
**فایل:** `components/Layout.tsx`

Wrapper اصلی تمام صفحات با:
- max-width: 440px (طراحی mobile-first)
- box-shadow برای افکت کارتی
- فونت Vazirmatn
- background گرادیانت (main-color → secondary-color)

### 8.2 GlassCard
**فایل:** `components/GlassCard.tsx`

کارت شیشه‌ای با افکت Glassmorphism:
- background: gradient شفاف
- border: #88ffa4
- border-radius: 24px
- blur effect روی border

### 8.3 FieldSet
**فایل:** `components/FieldSet.tsx`

فیلد ورودی با label شناور (float label):
- پشتیبانی از type‌های text, password, tel, num
- نمایش وضعیت valid/invalid با استایل‌های متفاوت
- helperText برای نمایش پیام خطا
- trailingIcon برای آیکون انتهای فیلد
- پشتیبانی از RTL

### 8.4 AutocompleteField
**فایل:** `components/AutocompleteField.tsx`

فیلد جستجوی خودکار برای انتخاب استان و شهر:
- فیلتر شدن گزینه‌ها با تایپ کاربر
- پشتیبانی از keyboard navigation
- نمایش منوی کشویی با انیمیشن

### 8.5 HowKnow
**فایل:** `components/HowKnow.tsx`

انتخاب نحوه آشنایی با مجموعه:
- گزینه‌ها: اینستاگرام، تلگرام، دوستان، سایت، سایر
- نمایش خطا در صورت عدم انتخاب

### 8.6 AcceptTerms
**فایل:** `components/AcceptTerms.tsx`

چک‌باکس پذیرش قوانین و مقررات:
- لینک به صفحه `/terms`
- نمایش خطا در صورت عدم تأیید

### 8.7 TimeLine
**فایل:** `components/TimeLine.tsx`

انتخاب بازه زمانی (مدت زمان):
- گزینه‌ها: ۱ ماهه، ۳ ماهه، ۶ ماهه، ۱ ساله

### 8.8 Consignment
**فایل:** `components/Consignment.tsx`

فرم فروش امانی با فیلدهای:
- نام، نام خانوادگی، موبایل، استان، شهر
- تاریخ تولد، شماره امانت، قیمت، مدت زمان
- مالکیت، وضعیت، نحوه آشنایی

### 8.9 Installment
**فایل:** `components/installment.tsx`

فرم خرید اقساطی با فیلدهای:
- مبلغ سیمکارت، پیش‌پرداخت
- تعداد اقساط (۱ تا ۱۲ ماه)

### 8.10 Preorder
**فایل:** `components/preorder.tsx`

فرم پیش‌سفارش با فیلد:
- توضیحات (حداقل ۲ کاراکتر)

### 8.11 SelectUs
**فایل:** `components/SelectUs.tsx`

باکس "چرا سیم‌کارت ۲۴؟" با قابلیت باز و بسته شدن.

### 8.12 WithAuth
**فایل:** `components/WithAuth.tsx`

Higher-Order Component برای محافظت از صفحات:
- بررسی احراز هویت با `isAuthenticated()`
- redirect به `/login` در صورت عدم احراز هویت
- نمایش loading در حین بررسی

### 8.13 BottomLogo
**فایل:** `components/BottomLogo.tsx`

لوگوی پایین صفحه با تصویر `vector99.png`.

### 8.14 Navbar
**فایل:** `components/Navbar.tsx`

نوار ناوبری (در صفحات داخلی استفاده می‌شود).

### 8.15 MarketSwap
**فایل:** `components/MarketSwap.tsx`

کامپوننت تعویض سیم‌کارت (بازار).

---

## 9. کتابخانه‌های کمکی (Lib)

### 9.1 Prisma Client (`lib/prisma.ts`)

Singleton pattern برای Prisma Client:
```typescript
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
```

### 9.2 JWT (`lib/jwt.ts`)

- **signToken:** ایجاد توکن JWT با payload شامل `id`, `role`, `adminId?`
- **verifyToken:** اعتبارسنجی و استخراج payload از توکن
- الگوریتم: HS256
- انقضا: ۲۴ ساعت
- کلید مخفی: `JWT_SECRET` از environment variables

### 9.3 Password (`lib/password.ts`)

- **hashPassword:** هش رمز عبور با bcryptjs (10 salt rounds)
- **comparePassword:** مقایسه رمز عبور با هش

### 9.4 Auth Client (`lib/auth.ts`)

توابع کمکی سمت کلاینت:
- **getToken():** خواندن توکن از document.cookie
- **isAuthenticated():** بررسی احراز هویت با fetch به `/api/auth/check`
- **logout():** خروج و redirect به `/login`

### 9.5 Iran Data (`lib/iranData.ts`)

داده‌های کامل استان‌ها و شهرهای ایران:
- ۳۱ استان
- ۴۳۲+ شهر
- تابع `getCitiesOfProvince(provinceId)` برای فیلتر شهرها

### 9.6 useFormPersist (`lib/useFormPersist.ts`)

هوک سفارشی برای ذخیره‌سازی و بازیابی خودکار داده‌های فرم در localStorage.

---

## 10. استایل‌دهی و تم

### 10.1 پالت رنگی

| رنگ | کد HEX | کاربرد |
|-----|--------|--------|
| اصلی (Primary) | `#1c3968` | پس‌زمینه اصلی |
| ثانویه (Secondary) | `#11223d` | پس‌زمینه ثانویه |
| سبز (Accent) | `#51BB70` | دکمه‌ها، حالت فعال |
| سبز روشن | `#23E250` | هایلایت، بج‌ها |
| قرمز خطا | `#FF6B6B` | پیام‌های خطا |
| سفید | `#FFFFFF` | متن‌ها |
| طوسی | `#636363` | پس‌زمینه input |

### 10.2 افکت‌های Glassmorphism

```css
.gc {
  background: linear-gradient(180deg, rgba(217,217,217,0.2) 0%, rgba(115,115,115,0) 100%);
  border: 2px solid #88ffa4;
  border-radius: 24px;
}
.gc::before {
  border: 6px solid #737373;
  filter: blur(8px);
}
```

### 10.3 انیمیشن‌ها

| کلاس | انیمیشن | مدت | کاربرد |
|------|---------|-----|--------|
| `.afu` | fadeUp | 0.45s | ورود المان‌ها از پایین |
| `.afi` | fadeIn | 0.35s | نمایش تدریجی |
| `.asd` | slideDown | 0.35s | ورود از بالا |
| `.d1` - `.d6` | delay | 0.05s - 0.3s | تأخیر stagger |

### 10.4 فونت

فونت **Vazirmatn** با تمام weight‌ها (100 تا 900) به صورت woff2 بارگذاری می‌شود.

---

## 11. نقشه راه و کارهای باقی‌مانده

### 11.1 کارهای تکمیل‌شده ✅

- [x] ساختار پایه Next.js با App Router
- [x] مدل‌های دیتابیس (Admin, Agent, CustomerForm, User, WebhookEvent)
- [x] سیستم احراز هویت JWT با سه نقش
- [x] Middleware محافظت از مسیرهای admin و agent
- [x] صفحات خرید، فروش، سرمایه‌گذاری، کارشناسی قیمت
- [x] فرم‌های پویا با اعتبارسنجی Zod
- [x] ذخیره‌سازی خودکار فرم در localStorage
- [x] API استعلام ارزش سیم‌کارت (Mock)
- [x] API آمار نماینده
- [x] وب‌هوک CRM (ذخیره رویدادها)
- [x] طراحی واکنش‌گرا با Glassmorphism
- [x] فونت Vazirmatn
- [x] داده‌های استان‌ها و شهرهای ایران
- [x] کامپوننت AutocompleteField
- [x] مودال‌های تأیید اطلاعات

### 11.2 در حال انجام 🚧

- [ ] پنل مدیریت (Admin Panel) - صفحات در حال توسعه
- [ ] پنل نماینده (Agent Panel) - صفحات در حال توسعه
- [ ] صفحه تنظیمات (Settings)

### 11.3 کارهای آینده 📋

- [ ] **اتصال SMS واقعی** برای ارسال کد OTP
- [ ] **اتصال به سرویس استعلام اپراتور** برای اطلاعات واقعی سیم‌کارت
- [ ] **یکپارچگی با CRM خارجی** (ارسال webhook events)
- [ ] **داشبورد مدیریت** با نمودارها و گزارش‌های تحلیلی
- [ ] **سیستم اعلان‌ها** (Notification)
- [ ] **آپلود مدارک** (تصویر کارت ملی، شناسنامه)
- [ ] **درگاه پرداخت** آنلاین
- [ ] **قراردادهای هوشمند** (تولید خودکار PDF)
- [ ] **تست‌های واحد** (Unit Tests) و **تست‌های E2E**
- [ ] **Docker** کانتینرایز کردن پروژه
- [ ] **CI/CD Pipeline**
- [ ] **PWA** (Progressive Web App)
- [ ] **SEO Optimization** (متادیتا، sitemap)
- [ ] **i18n** پشتیبانی از زبان‌های دیگر
- [ ] **گزارش‌گیری پیشرفته** (Excel export)
- [ ] **لاگین با Google/SSO**
- [ ] **Rate Limiting** روی API routes
- [ ] **CSRF Protection**

### 11.4 بدهی فنی (Technical Debt) ⚠️

- [ ] جایگزینی `fallback-secret-change-me` با JWT_SECRET واقعی در production
- [ ] حذف OTP mock و پیاده‌سازی SMS واقعی
- [ ] جایگزینی داده‌های Mock در `/api/sim-value` با سرویس واقعی
- [ ] اضافه کردن validation برای `birthDay`, `birthMonth`, `birthYear` در سمت سرور
- [ ] یکپارچه‌سازی نحوه ذخیره‌سازی فرم‌ها (بعضی از فرم‌ها از localStorage استفاده می‌کنند، بعضی نه)
- [ ] رفع duplicate city در `iranData.ts` (سیرجان - id 51 و 320)
- [ ] اضافه کردن type safety بیشتر (کاهش استفاده از `as any`)
- [ ] بهبود error handling در API routes
- [ ] اضافه کردن logging مناسب
- [ ] بهینه‌سازی bundle size (tree-shaking lodash و غیره)

---

## 📊 آمار پروژه

| معیار | مقدار |
|-------|-------|
| **تعداد فایل‌های TypeScript/TSX** | ~۳۰+ |
| **تعداد API Routes** | ۱۲+ |
| **تعداد صفحات** | ۸+ |
| **تعداد کامپوننت‌ها** | ۱۵ |
| **تعداد مدل‌های دیتابیس** | ۵ |
| **تعداد نقش‌های کاربری** | ۳ |
| **تعداد استان‌های ایران** | ۳۱ |
| **تعداد شهرها** | ۴۳۲+ |

---

## 🔧 راهنمای راه‌اندازی

### پیش‌نیازها

- Node.js 18+
- PostgreSQL
- npm

### نصب و راه‌اندازی

```bash
# 1. کلون پروژه
git clone <repository-url>
cd tet

# 2. نصب وابستگی‌ها
npm install

# 3. تنظیم متغیرهای محیطی
cp .env.example .env.local
# ویرایش DATABASE_URL و JWT_SECRET در .env.local

# 4. اجرای مایگریشن‌ها
npx prisma migrate dev

# 5. اجرای Seed (داده‌های اولیه)
npm run seed

# 6. اجرای پروژه در محیط توسعه
npm run dev

# 7. build برای production
npm run build
npm start
```

### اسکریپت‌های موجود

| اسکریپت | توضیح |
|---------|-------|
| `npm run dev` | اجرای سرور توسعه |
| `npm run build` | build پروژه |
| `npm start` | اجرای نسخه production |
| `npm run seed` | اجرای داده‌های اولیه دیتابیس |

---

## 📝 نتیجه‌گیری

پروژه **SIM24** یک پلتفرم جامع و مدرن برای بازار سیم‌کارت ایران است که با استفاده از تکنولوژی‌های روز (Next.js 16، TypeScript، Prisma، Tailwind CSS) ساخته شده است. معماری پروژه تمیز و ماژولار بوده و از الگوهای طراحی مناسبی مانند Server Components، Route Handlers و Middleware استفاده می‌کند.

نقاط قوت پروژه:
- طراحی زیبا و مدرن با افکت‌های Glassmorphism
- اعتبارسنجی قوی با Zod
- سیستم احراز هویت امن با JWT
- ذخیره‌سازی خودکار فرم‌ها در localStorage
- پشتیبانی کامل از RTL و زبان فارسی
- معماری مقیاس‌پذیر و قابل گسترش

---

> **تماس با تیم توسعه:** برای اطلاعات بیشتر با تیم SIM24 تماس بگیرید.