# SIM24 — Full Project Architecture Report

> **Version:** 1.0.0  
> **Date:** 2026-06-15  
> **Purpose:** Pre-refactor reconnaissance for ERP/Automation Engine  
> **Scope:** All pages, API routes, auth systems, database, existing automations

---

## 1. Complete Directory Map

### 1.1 `app/` — Next.js App Router (Frontend + API)

```
app/                                               # App Router Root
├── page.tsx                                       # Home page (menu grid + agentId propagation)
├── layout.tsx                                     # Root layout (RTL Persian, Vazirmatn font)
├── globals.css                                    # Global styles + Tailwind
│
├── (api)/                                         # API Route Group (rewritten to /api/*)
│   ├── auth/
│   │   ├── login/route.ts                         # POST - User login (username+password+OTP)
│   │   ├── check/route.ts                         # GET  - JWT status check (any role)
│   │   └── logout/route.ts                        # POST - Clear token cookie
│   │
│   ├── admin/
│   │   ├── auth/route.ts                          # POST - Admin login (Admin table, role="admin")
│   │   ├── agents/route.ts                        # GET/POST - List/Create agents
│   │   ├── agents/[id]/route.ts                   # DELETE - Delete agent
│   │   ├── agents/me/route.ts                     # GET - Admin self-info (Admin table)
│   │   └── forms/route.ts                         # GET - All forms (admin view)
│   │
│   ├── agent/
│   │   ├── auth/route.ts                          # POST - Agent login (Agent table, role="agent")
│   │   │                                         # DELETE - Agent logout
│   │   ├── me/route.ts                            # GET - Agent self-info
│   │   ├── stats/route.ts                         # GET - Agent stats (monthly/weekly/type)
│   │   └── forms/route.ts                         # GET - Agent's own forms
│   │
│   ├── forms/
│   │   ├── buy/route.ts                           # POST - Buy form (direct/market/cons/installment/preorder)
│   │   ├── sell/route.ts                          # POST - Sell form (direct/market/cons)
│   │   ├── search/route.ts                        # POST - SIM search/expertise form
│   │   └── invest/                                # (page component, not route)
│   │
│   ├── investments/route.ts                       # POST - Investment form
│   ├── sim-value/route.ts                         # GET  - SIM card value estimation (mock)
│   └── webhook/
│       └── crm/route.ts                           # POST - External CRM webhook receiver
│
├── (auth)/                                         # Route Group: Agent Workflows (protected)
│   ├── agent/
│   │   ├── Investment/
│   │   │   ├── page.tsx                           # Investment dashboard (AgentDashboard + mock data)
│   │   │   └── Invest/page.tsx                    # Investment workflow (RoleWorkflowPage)
│   │   ├── price-expert/
│   │   │   ├── page.tsx                           # Price expert dashboard (AgentDashboard)
│   │   │   ├── sell/page.tsx                      # Workflow: فروش سیم کارت
│   │   │   ├── value/page.tsx                     # Workflow: ارزش سیم کارت
│   │   │   ├── escrow/page.tsx                    # Workflow: فروش امانی
│   │   │   └── switch/page.tsx                    # Workflow: تعویض سیم کارت
│   │   ├── product-manager/
│   │   │   ├── page.tsx                           # Product manager dashboard (AgentDashboard)
│   │   │   ├── buy/page.tsx                       # Workflow: خرید سیم کارت
│   │   │   ├── sell/page.tsx                      # Workflow: فروش سیم کارت
│   │   │   ├── escrow/page.tsx                    # Workflow: فروش امانی
│   │   │   ├── switch/page.tsx                    # Workflow: تعویض مرحله ۲
│   │   │   └── f-switch/page.tsx                  # Workflow: تعویض فوری مرحله ۴
│   │   └── sell-manager/
│   │       ├── page.tsx                           # Sell manager dashboard (AgentDashboard)
│   │       ├── buy/page.tsx                       # Workflow: خرید سیم کارت
│   │       ├── sell/page.tsx                      # Workflow: فروش سیم کارت
│   │       ├── escrow/page.tsx                    # Workflow: فروش امانی
│   │       ├── switch/page.tsx                    # Workflow: تعویض سیم کارت
│   │       └── preorder/page.tsx                  # Workflow: پیش سفارش
│   └── admins/
│       ├── Investment/page.tsx                    # Admin dashboard (inline UI + mock data)
│       ├── price-expert/page.tsx                  # Admin dashboard (inline UI + mock data)
│       ├── product-manager/page.tsx               # Admin dashboard (inline UI + mock data)
│       └── sell-manager/page.tsx                  # Admin dashboard (inline UI + mock data)
│
├── admin/                                          # Admin Panel Pages (public paths, guarded by middleware)
│   ├── login/page.tsx                             # Admin login form (POST /api/admin/auth)
│   └── panel/
│       ├── page.tsx                               # Admin dashboard (fetch /api/admin/agents/me)
│       ├── agents/page.tsx                        # Agent CRUD management
│       └── forms/page.tsx                         # All forms view with filters
│
├── agent/                                          # Agent Panel Pages (public paths, guarded by middleware)
│   ├── login/page.tsx                             # Agent login form (POST /api/agent/auth)
│   └── panel/
│       ├── page.tsx                               # Agent dashboard (stats, agentId link)
│       └── forms/page.tsx                         # Agent's forms list with CSV export
│
├── buy/page.tsx                                    # Public: Customer buy form
├── sell/page.tsx                                   # Public: Customer sell form
├── search/                                         # Public: SIM search
├── invest/                                         # Public: Investment
├── login/                                          # Public: User login
├── settings/                                       # Settings pages
└── terms/                                          # Terms & conditions
```

### 1.2 `components/` — Reusable UI Components (16 files)

| Component | Purpose | Used By |
|-----------|---------|---------|
| `Layout.tsx` | Main page layout wrapper | All pages |
| `Navbar.tsx` | Top navigation bar | Admin pages |
| `GlassCard.tsx` | Glass-morphism card | Agent dashboard, forms |
| `FieldSet.tsx` | Form input field | All forms |
| `AutocompleteField.tsx` | Province/city dropdown | Sell form |
| `SelectUs.tsx` | Generic select | Unknown |
| `HowKnow.tsx` | "How did you know us" selector | Buy/Sell forms |
| `TimeLine.tsx` | Duration/schedule selector | Sell form |
| `Consignment.tsx` | Consignment sale form | Sell form |
| `MarketSwap.tsx` | Market swap component | Unknown |
| `installment.tsx` | Installment plan form | Buy form |
| `preorder.tsx` | Preorder form | Buy form |
| `InputField.tsx` | Generic input field | Possibly unused |
| `AcceptTerms.tsx` | Terms acceptance checkbox | Buy/Sell forms |
| `BottomLogo.tsx` | Footer logo | Buy/Sell forms |
| `WithAuth.tsx` | Auth HOC wrapper | Possibly unused |

### 1.3 `lib/` — Utility Libraries

| File | Purpose |
|------|---------|
| `auth.ts` | Client-side auth helpers: `getToken()`, `isAuthenticated()`, `logout()` |
| `jwt.ts` | JWT sign/verify using `jose` library |
| `password.ts` | bcrypt hash/compare wrapper |
| `prisma.ts` | Prisma singleton client (connection pooling) |
| `iranData.ts` | Static Iran provinces (31) + cities (432) data |
| `useFormPersist.ts` | React hook for form localStorage persistence |
| `generated/prisma/` | Auto-generated Prisma client |

### 1.4 KEY FINDING: No `hooks/` or `services/` directories exist

There are **no custom hooks** (except `useFormPersist.ts` in lib/) and **no services layer**. All API calls are made directly via `fetch()` inline in page components.

### 1.5 KEY FINDING: Missing Component — `WorkflowPage.tsx`

The import `@/components/WorkflowPage` is used by **15 agent workflow pages**, but the file does NOT exist in `components/`. This renders all agent workflow pages non-functional.

---

## 2. Database Schema Deep-Dive

### 2.1 Complete Model Listing (from `prisma/schema.prisma`)

```prisma
// Provider: postgresql
// Connection: env("DATABASE_URL")

// ─── Admin ───
model Admin {
  id        String   @id @default(cuid())
  username  String   @unique
  password  String
  createdAt DateTime @default(now())
  agents    Agent[]                                   // 1:N → Agent
}

// ─── Agent ───
model Agent {
  id           String         @id @default(cuid())
  username     String         @unique
  password     String
  fullName     String?                                // Optional full name
  phone        String?                                // Optional phone
  active       Boolean        @default(true)           // Can be deactivated
  lastLogin    DateTime?                              // Track last login time
  adminId      String                                 // FK → Admin
  admin        Admin          @relation(fields: [adminId], references: [id])
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  forms        CustomerForm[]                          // 1:N → CustomerForm
}

// ─── CustomerForm (Primary Data Entity) ───
model CustomerForm {
  id          String   @id @default(cuid())
  phone       String?                                // Customer phone (denormalized)
  fullName    String?                                // Customer full name
  nationalId  String?                                // National ID (unused?)
  formType    String                                 // e.g. "sell_direct", "buy_installment"
  formData    Json                                   // JSON payload (validated by Zod)
  metadata    Json?                                  // Optional metadata
  agentId     String?                                // FK → Agent (nullable = anonymous)
  agent       Agent?   @relation(fields: [agentId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// ─── User (End Customer Account) ───
model User {
  id        String   @id @default(cuid())
  username  String   @unique
  password  String
  phone     String?                                 // Optional phone
  fullName  String?                                 // Optional full name
  active    Boolean  @default(true)                  // Can be deactivated
  lastLogin DateTime?                               // Track last login time
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ─── WebhookEvent (External Event Log) ───
model WebhookEvent {
  id        String   @id @default(cuid())
  event     String                                  // Event name
  payload   String                                  // Raw JSON string
  status    String                                  // "pending" | "sent" | "failed"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 2.2 Entity Relationship Diagram

```
  Admin ──1:N──→ Agent ──1:N──→ CustomerForm
   │                              ↑
   │                              │ (optional)
   │                              │
   └── (manages agents)      (public submitter)
                                      ↑
                                User (login only, no relation)
                                
  WebhookEvent (standalone log)
```

### 2.3 Key Observations

| Observation | Detail |
|-------------|--------|
| **No User ↔ CustomerForm relation** | Users can submit forms without linking to their account. The `User` model and `CustomerForm` have no relationship. |
| **No role field in DB** | Roles are NOT stored in the database. They are hardcoded strings in the JWT payload. |
| **No admin type field** | All admins are stored in the single `Admin` table with no `role` or `type` discriminator. |
| **Denormalized phone** | `CustomerForm.phone` duplicates the phone from `formData` JSON for faster queries. |
| **JSON formData** | All form fields are stored as a JSON blob with no schema enforcement at the DB level. Zod validates at the API layer. |
| **Optional agentId** | Forms can be submitted without an agent (anonymous public submissions). |
| **Soft-active only** | Agents and Users have `active: Boolean` but no hard deletion. Admins have no `active` field = permanent. |

---

## 3. Authentication & Identity

### 3.1 Three Authentication Tiers

| Tier | DB Table | JWT Role | Login Endpoint | Guards |
|------|----------|----------|----------------|--------|
| **Admin** | `Admin` | `"admin"` | `POST /api/admin/auth` | Middleware: `/admin/panel`, `/admin/agents`, `/admin/forms` |
| **Agent** | `Agent` | `"agent"` | `POST /api/agent/auth` | Middleware: `/agent/panel`, `/agent/forms` |
| **User** | `User` | `"user"` | `POST /api/auth/login` | None (no middleware protection for regular users) |

### 3.2 JWT Token Structure

```typescript
// lib/jwt.ts — signToken()
interface JwtPayload {
  id: string;              // Admin.id | Agent.id | User.id
  role: "admin" | "agent" | "user";
  adminId?: string;        // Only for Agents — FK to Admin
}

// Token expiry: 24 hours
// Algorithm: HS256
// Secret: process.env.JWT_SECRET
```

### 3.3 Cookie Configuration Differences

| Endpoint | `secure` | `sameSite` | `maxAge` |
|----------|----------|------------|----------|
| `/api/admin/auth` | Based on protocol | `lax` | 24h |
| `/api/agent/auth` | Based on protocol | `lax` | 24h |
| `/api/auth/login` | Based on `NODE_ENV` | `strict` | 24h |

**Issue:** Notice `sameSite` is `"lax"` for admin/agent logins but `"strict"` for user logins.  
**Issue:** Admin login uses `isSecure` based on request protocol, while User login uses `process.env.NODE_ENV`.

### 3.4 Middleware Route Protection (`middleware.ts`)

**Guarded Paths:**

| Prefix | Role Required | Redirect On Failure |
|--------|---------------|-------------------|
| `/admin/panel` | `admin` | `/admin/login` |
| `/admin/agents` | `admin` | `/admin/login` |
| `/admin/forms` | `admin` | `/admin/login` |
| `/agent/panel` | `agent` | `/agent/login` |
| `/agent/forms` | `agent` | `/agent/login` |

**NOT Guarded (by middleware):**
- `/admin/login`, `/agent/login` — allowed without token
- `/admin/auth`, `/agent/auth` — API endpoints (handled internally)
- **All public pages** — `/buy`, `/sell`, `/`, `/search`, `/login`, etc.
- **All API routes** — `/api/*` (rewritten, not matched by middleware)

**The middleware matcher:**
```typescript
export const config = {
  matcher: ["/admin/:path*", "/agent/:path*"],
};
```

### 3.5 Role Definitions

Roles are **not stored in the database** and **not defined as Enums** anywhere in the codebase. They are:
- Hardcoded **string literals** in `lib/jwt.ts`:
  ```typescript
  role: "admin" | "agent" | "user"
  ```
- Verified by string comparison in middleware:
  ```typescript
  const role = payload.role as string;
  if (isAdminRoute && role !== "admin") { ... }
  ```

**There is no Prisma enum, TypeScript enum, or constant file for roles.** They are raw string unions.

---

## 4. The "Two-Admin" Issue — Deep Analysis

### 4.1 The Duplicate Admin Login Paths

After thorough analysis, here is the critical finding:

**Path A: Proper Admin Login**
| File | Route | What It Queries | JWT Role |
|------|-------|----------------|----------|
| `app/(api)/admin/auth/route.ts` | `POST /api/admin/auth` | `prisma.admin.findUnique()` | `role: "admin"` |
| `app/admin/login/page.tsx` | Frontend login form | Calls `/api/admin/auth` | N/A |

**Path B: Agent Login under /admin/agents/login (IDENTICAL LOGIC)**
| File | Route | What It Queries | JWT Role |
|------|-------|----------------|----------|
| `app/(api)/admin/agents/auth/route.ts` | `POST /api/admin/agents/auth` | `prisma.agent.findUnique()` | `role: "agent"` |
| *(no frontend page exists)* | `app/(api)/admin/agents/login/` | *(directory exists but empty)* | N/A |

### 4.2 The Confusion

The `app/(api)/admin/agents/auth/route.ts` file is a **complete duplicate** of `app/(api)/agent/auth/route.ts`. Both:
- Query the `Agent` table
- Sign JWT with `role: "agent"` and `adminId`
- Return the same response structure

This means there are **two ways to log in as an Agent**: `/api/agent/auth` and `/api/admin/agents/auth`. They are functionally identical.

### 4.3 The Logout Path Problem

The **admin panel** (`app/admin/panel/page.tsx`) calls:
```typescript
await fetch("/api/admin/agents/auth", { method: "DELETE" });
```

This calls the **agent logout**, not an admin logout. There is **no** `DELETE` handler on `/api/admin/auth`, meaning there is **no proper admin logout route**. If an admin's logout call succeeds, it's because it happens to clear the same `token` cookie regardless of who set it.

### 4.4 The `/api/admin/agents/me` Anomaly

The admin panel (`app/admin/panel/page.tsx`) fetches:
```typescript
const res = await fetch("/api/admin/agents/me", { credentials: "include" });
```

But the file `app/(api)/admin/agents/me/route.ts` actually queries the **Admin table**:
```typescript
const admin = await prisma.admin.findUnique({
  where: { id: payload.id as string },
  select: { id: true, username: true },
});
return NextResponse.json({ agent: admin });  // <-- Returns as "agent"!
```

The response wraps the admin object in `{ agent: ... }` instead of `{ admin: ... }`. This is a **naming inconsistency** — the admin gets returned as "agent" in the response.

### 4.5 Summary of "Two-Admin" Issues

| Issue | Severity | Details |
|-------|----------|---------|
| Duplicate agent login endpoint | 🟡 Medium | `/api/agent/auth` and `/api/admin/agents/auth` do the same thing |
| No proper admin logout route | 🔴 High | Admin calls agent logout API; no DELETE on `/api/admin/auth` |
| Admin response mislabeled as "agent" | 🟡 Medium | `/api/admin/agents/me` returns `{ agent: admin }` |
| Empty directory | 🟡 Low | `app/(api)/admin/agents/login/` exists but has no route file |

### 4.6 Root Cause

The project appears to have gone through a refactor where:
1. Originally, agents were managed under `/admin/agents/*` paths
2. A separate `/agent/*` path was created for agent self-service
3. The admin panel was migrated to use the new paths but the old files were never cleaned up
4. The result is **dual paths** for agent login, an **orphaned directory**, and a **misnamed response field**

---

## 5. Multi-Admin / Multi-Agent Conflict

### 5.1 Are There Multiple "Admin" Types?

**No, there is only ONE Admin table** with no discriminator field. All admins are equal:
- No `role` field in the `Admin` model
- No `type` field
- No `permissions` field
- No separate tables for different admin roles

The `app/(auth)/admins/` directory contains **separate dashboard pages** (price-expert, product-manager, sell-manager, Investment), but these are **NOT backed by any role-based access control**. Any admin can access any of these pages because:
- The middleware only checks `role === "admin"` — no sub-role check
- The admin login always sets `role: "admin"` — no sub-role in JWT

### 5.2 Admin Sub-Pages = UI Organization Only

The separate admin pages in `app/(auth)/admins/*` are:
- **Purely cosmetic differentiation** — each page has its own UI theme (colors, icons, section headers)
- **Not access-controlled** — any admin can navigate to any sub-page
- **Mock data only** — none of these pages fetch from the API yet

### 5.3 Agent Role Variants

Similarly, the agent sub-types (price-expert, product-manager, sell-manager, Investment) are:
- **Not stored in the database** — the `Agent` model has no `role` or `type` field
- **Not in the JWT** — the token only has `role: "agent"`, no sub-type
- **Purely frontend UI organization** — each folder in `app/(auth)/agent/` shows different mock data
- A single agent could theoretically access any of the 15 workflow pages if they know the URL

### 5.4 Conflict Summary

| Question | Answer |
|----------|--------|
| Are there separate login APIs for different admin types? | **No** — single `/api/admin/auth` for all |
| Do JWT payloads differ between admin types? | **No** — all admins get `role: "admin"` |
| Are there different agent types in the DB? | **No** — the `Agent` model has no subtype |
| Is there any RBAC for admin sub-pages? | **No** — no permission system exists |
| Can an agent for one role access another's pages? | **Yes** — URLs are not role-enforced |

---

## 6. Existing Automations

### 6.1 Webhook System

The only existing automation is `app/(api)/webhook/crm/route.ts`:

```typescript
export async function POST(request: NextRequest) {
  const body = await request.json();
  const signature = request.headers.get("X-CRM-Signature");
  // ... validation not implemented

  await prisma.webhookEvent.create({
    data: { event: body.event, payload: JSON.stringify(body), status: "pending" },
  });

  // Future: forward to CRM
  // fetch(process.env.CRM_WEBHOOK_URL, { method: "POST", body: JSON.stringify(body) })

  return NextResponse.json({ success: true });
}
```

**Status:** Skeleton implementation only. Receives events, logs to database, but:
- No signature validation logic
- No forwarding to external CRM
- No retry mechanism
- No webhook authentication (anyone can POST to this endpoint)

### 6.2 The `WebhookEvent` Table

```prisma
model WebhookEvent {
  id        String   @id @default(cuid())
  event     String                   // Event type name
  payload   String                   // Raw JSON string
  status    String                   // "pending" | "sent" | "failed"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Status column** supports three states, but no code transitions events beyond `"pending"`. There is no worker, no cron job, and no retry logic.

### 6.3 Automation Gaps

| Feature | Status | Location |
|---------|--------|----------|
| Webhook receiver | ✅ Exists (skeleton) | `app/(api)/webhook/crm/route.ts` |
| Webhook forwarding | ❌ Not implemented | Commented out |
| Signature validation | ❌ Not implemented | Dummy `signature` read |
| Retry mechanism | ❌ Not implemented | None |
| Background workers | ❌ Not implemented | No worker container |
| Job queue | ❌ Not implemented | No BullMQ integration yet |
| Workflow engine | ❌ Not implemented | No models or routes exist |
| Cron jobs | ❌ Not implemented | No scheduled tasks |
| Event-driven automation | ❌ Not implemented | No event bus |

---

## 7. Security Analysis

### 7.1 Current Protections

| Protection | Status | Details |
|-----------|--------|---------|
| JWT-based auth | ✅ | httpOnly cookies, 24h expiry |
| Middleware guards | ✅ | `/admin/*` and `/agent/*` |
| bcrypt passwords | ✅ | Salt rounds: 10 |
| SQL injection | ✅ | Prisma ORM parametrizes all queries |
| XSS protection | ✅ | httpOnly cookies |
| CSRF (sameSite) | ✅ | `strict` or `lax` on cookies |
| Rate limiting | ✅ | Nginx level (30 r/s API, 5 r/m login) |

### 7.2 Missing Protections

| Gap | Severity | Details |
|-----|----------|---------|
| No CSRF tokens for state-changing endpoints | 🟡 Medium | Forms only rely on `sameSite: lax` |
| No input sanitization on formData | 🟡 Medium | JSON blob stored directly from user input |
| No admin activity audit log | 🟡 Medium | No tracking of admin actions |
| No agent role separation | 🟠 High | Any agent can access any workflow |
| API token auth for webhook | 🟠 High | `/api/webhook/crm` is unauthenticated |
| No request size limits per endpoint | 🟡 Low | `client_max_body_size 10M` at Nginx only |
| No IP allowlisting for admin endpoints | 🟡 Low | Admin API is publicly accessible |

---

## 8. Critical Findings Summary

### 🔴 Critical (Must Fix Before ERP Refactor)

| # | Issue | Impact |
|---|-------|--------|
| C1 | **`WorkflowPage` component missing** | All 15 agent workflow pages are broken — cannot render |
| C2 | **No admin logout route** | Admin panel logout calls agent logout API by mistake |
| C3 | **No agent sub-type system** | Agent dashboards show different workflows but all agents have equal access |

### 🟠 High (Should Fix During ERP Refactor)

| # | Issue | Impact |
|---|-------|--------|
| H1 | **100% mock data in agent/admins pages** | Dashboard pages show fake data despite real API endpoints existing |
| H2 | **Duplicate agent login endpoints** | `/api/admin/agents/auth` = clone of `/api/agent/auth` |
| H3 | **No workflow status machine** | Forms have no lifecycle, no state transitions, no routing between agents |
| H4 | **No automation engine** | Webhook is a skeleton, no background jobs, no queue system |
| H5 | **API response inconsistency** | 4 different response formats across different endpoints |

### 🟡 Medium (Consider During ERP Refactor)

| # | Issue | Impact |
|---|-------|--------|
| M1 | `sameSite` mismatch between logins | Admin/agent uses `lax`, user uses `strict` |
| M2 | `{ agent: admin }` misnamed response | Naming confusion in admin self-info endpoint |
| M3 | Orphaned empty directory | `app/(api)/admin/agents/login/` exists but empty |
| M4 | No TypeScript types shared between frontend/backend | Zod schemas not used for frontend type safety |
| M5 | No `hooks/` or `services/` directories | All logic lives inline in page components |
| M6 | `localStorage` for agentId propagation | Fragile — clearing cache breaks the flow |
| M7 | No database-level schema enforcement for formData | All validation is at the Zod API layer only |

---

## 9. Architecture Recommendations for ERP Refactor

### 9.1 New Models Needed

```prisma
model AgentRole {
  id        String   @id @default(cuid())
  code      String   @unique     // "price-expert", "product-manager", "sell-manager", "investment"
  title     String                // "کارشناس قیمت", "مدیر محصول", etc.
  agents    AgentRoleAssignment[]
}

model AgentRoleAssignment {
  id        String   @id @default(cuid())
  agentId   String
  agent     Agent    @relation(fields: [agentId], references: [id])
  roleId    String
  role      AgentRole @relation(fields: [roleId], references: [id])
  
  @@unique([agentId, roleId])  // One agent can have multiple roles
}

model AutomationWorkflow {
  id          String   @id @default(cuid())
  formId      String   @unique
  form        CustomerForm @relation(fields: [formId], references: [id])
  status      String   // "pending", "active", "completed", "cancelled"
  currentRole String?  // Which role is currently responsible
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  steps       WorkflowStep[]
}

model WorkflowStep {
  id           String   @id @default(cuid())
  workflowId   String
  workflow     AutomationWorkflow @relation(fields: [workflowId], references: [id])
  role         String
  agentId      String?
  status       String   // "pending", "assigned", "in-progress", "completed", "rejected"
  data         Json?    // Step-specific data entered by agent
  notes        String?
  assignedAt   DateTime?
  completedAt  DateTime?
  createdAt    DateTime @default(now())
}
```

### 9.2 Cleanup Actions for "Two-Admin" Issue

1. **Remove** `app/(api)/admin/agents/auth/route.ts` — use only `app/(api)/agent/auth/route.ts`
2. **Remove** `app/(api)/admin/agents/login/` empty directory
3. **Fix** `app/admin/panel/page.tsx` — change logout to hit a proper admin logout endpoint
4. **Add** `DELETE` handler to `app/(api)/admin/auth/route.ts` for admin logout
5. **Fix** `app/(api)/admin/agents/me/route.ts` — return `{ admin: ... }` instead of `{ agent: admin }`
6. **Create** proper admin logout endpoint or add DELETE to existing admin auth route

### 9.3 Standardized API Response Format

```typescript
// Proposed unified response type
type ApiResponse<T> = 
  | { success: true; data: T; message?: string }
  | { success: false; error: string; details?: unknown; code?: string };
```

### 9.4 Missing Infrastructure to Create

| Component | Priority | Reason |
|-----------|----------|--------|
| `WorkflowPage.tsx` | 🔴 Immediate | 15 pages depend on it |
| `components/` standard library | 🟡 Medium | Forms duplicate 800+ lines of pattern |
| `lib/services/` for API calls | 🟡 Medium | Centralize fetch logic |
| `lib/hooks/` for form state | 🟡 Medium | Reusable form + validation hooks |
| `lib/types/` for shared types | 🟡 Medium | Share Zod schemas with frontend |
| `lib/constants.ts` for roles | 🟡 Medium | Single source of truth for role strings |

---

## Appendix A: File Count Summary

| Category | Files | Lines of Code (approx) |
|----------|-------|----------------------|
| API Routes (route.ts) | 14 | ~650 |
| Pages (page.tsx) | 28 | ~5,200 |
| Components | 16 | ~2,000 (est) |
| Lib files | 6 | ~600 |
| Prisma (schema + seed) | 2 | ~130 |
| Config files | 8 | ~150 |
| **Total** | **~74** | **~8,730** |

## Appendix B: Database Seed Data

The seed script (`prisma/seed.ts`) creates:

| Entity | Username | Password | Notes |
|--------|----------|----------|-------|
| Admin | `admin` | `Mkh84389@110` | Hashed |
| Agent 1 | `agent1` | `password123` | Linked to admin |
| Agent 2 | `agent2` | `password123` | Linked to admin |
| User | `user` | `password123` | Standalone customer account |

## Appendix C: All Login/Logout Endpoints

| Method | Endpoint | Authenticates As | Table | JWT Role | Has Logout? |
|--------|----------|------------------|-------|----------|-------------|
| POST | `/api/admin/auth` | Admin | `Admin` | `admin` | ❌ No DELETE |
| POST | `/api/agent/auth` | Agent | `Agent` | `agent` | ✅ DELETE exists |
| POST | `/api/admin/agents/auth` | Agent (duplicate!) | `Agent` | `agent` | ✅ DELETE exists |
| POST | `/api/auth/login` | User | `User` | `user` | ✅ POST logout exists |
| POST | `/api/auth/logout` | (any) | — | — | N/A |