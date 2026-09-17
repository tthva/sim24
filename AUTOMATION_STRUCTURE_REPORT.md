# Automation Structure Analysis Report

> **Project:** SIM24 (سیم۲۴)  
> **Focus:** `app/(auth)`, `app/buy`, `app/sell`, `app/agent`, `app/(api)`  
> **Date:** 2026-06-15  
> **Goal:** Analyze existing authentication and agent workflow architecture for building an automation system

---

## 1. Directory Tree: `app/(auth)`

```
app/(auth)/
├── agent/                                   # Agent role pages (protected)
│   ├── page.tsx                             # (empty/missing?)
│   ├── Investment/
│   │   ├── page.tsx                         # Investment dashboard (AgentDashboard)
│   │   └── Invest/
│   │       └── page.tsx                     # Investment workflow (WorkflowPage)
│   ├── price-expert/
│   │   ├── page.tsx                         # Price expert dashboard (AgentDashboard)
│   │   ├── escrow/page.tsx                  # Escrow workflow (WorkflowPage)
│   │   ├── sell/page.tsx                    # Sell workflow (WorkflowPage)
│   │   ├── switch/page.tsx                  # Switch workflow (WorkflowPage)
│   │   └── value/page.tsx                   # Value estimation workflow (WorkflowPage)
│   ├── product-manager/
│   │   ├── page.tsx                         # Product manager dashboard (AgentDashboard)
│   │   ├── buy/page.tsx                     # Buy workflow (WorkflowPage)
│   │   ├── escrow/page.tsx                  # Escrow workflow (WorkflowPage)
│   │   ├── f-switch/page.tsx                # Fast switch workflow (WorkflowPage)
│   │   ├── sell/page.tsx                    # Sell workflow (WorkflowPage)
│   │   └── switch/page.tsx                  # Switch workflow (WorkflowPage)
│   └── sell-manager/
│       ├── page.tsx                         # Sell manager dashboard (AgentDashboard)
│       ├── buy/page.tsx                     # Buy workflow (WorkflowPage)
│       ├── escrow/page.tsx                  # Escrow workflow (WorkflowPage)
│       ├── preorder/page.tsx                # Preorder workflow (WorkflowPage)
│       ├── sell/page.tsx                    # Sell workflow (WorkflowPage)
│       └── switch/page.tsx                  # Switch workflow (WorkflowPage)
│
└── admins/                                  # Admin dashboard pages
    ├── Investment/page.tsx                  # Investment admin dashboard
    ├── price-expert/page.tsx                # Price expert admin dashboard
    ├── product-manager/page.tsx             # Product manager admin dashboard
    └── sell-manager/page.tsx                # Sell manager admin dashboard
```

### Key Observation
The `app/(auth)` route group contains **15 agent workflow sub-pages** and **4 admin dashboard pages**.  
Each agent role (price-expert, product-manager, sell-manager, Investment) shares the same structural pattern:
- A **dashboard page** (`page.tsx`) using `AgentDashboard` component
- **Workflow sub-pages** (buy, sell, escrow, switch, etc.) using `WorkflowPage` component

---

## 2. Directory Tree: `app/agent` (Public Agent Area)

```
app/agent/
├── login/
│   └── page.tsx                     # Agent login form (fetch POST /api/agent/auth)
└── panel/
    ├── page.tsx                     # Agent dashboard with stats (fetch /api/agent/stats, /api/agent/me)
    └── forms/
        └── page.tsx                 # Agent forms listing (fetch /api/agent/forms)
```

---

## 3. Directory Tree: `app/buy` & `app/sell` (Public Customer Forms)

```
app/buy/
└── page.tsx                         # Customer buy form (buy_direct, buy_inst, buy_pre)

app/sell/
└── page.tsx                         # Customer sell form (sell_direct, sell_market, sell_cons)
```

These are **public-facing customer entry points** that collect form data and POST to `/api/forms/buy` and `/api/forms/sell`.

---

## 4. Directory Tree: `app/(api)` (API Routes)

```
app/(api)/
├── auth/
│   ├── login/route.ts               # POST - User login (username+password+OTP)
│   ├── check/route.ts               # GET  - JWT auth status check
│   └── logout/route.ts              # POST - Clear auth cookie
├── admin/
│   ├── auth/route.ts                # POST - Admin login
│   ├── agents/route.ts              # GET/POST - Agent CRUD
│   └── forms/route.ts              # GET - List all forms (admin view)
├── agent/
│   ├── auth/route.ts                # POST - Agent login, DELETE - Agent logout
│   ├── me/route.ts                  # GET - Current agent info
│   ├── stats/route.ts               # GET - Agent stats
│   └── forms/route.ts              # GET - Agent's forms
├── forms/
│   ├── buy/route.ts                 # POST - Buy form submission (buy_direct, buy_market, buy_cons, buy_installment, buy_preorder)
│   ├── sell/route.ts                # POST - Sell form submission (sell_direct, sell_market, sell_cons)
│   ├── search/route.ts              # POST - Search/expertise form
│   └── invest/                      # (page component)
├── investments/route.ts            # POST - Investment form
├── sim-value/route.ts              # GET  - SIM value estimation (mock)
└── webhook/crm/route.ts            # POST - CRM webhook receiver
```

---

## 5. Page-by-Page Analysis

### 5.1 Agent Dashboards (`app/(auth)/agent/*/page.tsx`)

**Pattern:** All 4 role dashboards use the `AgentDashboard` component.

| Page | Role Title | Categories | Mock Works |
|------|-----------|------------|------------|
| `price-expert/page.tsx` | کارشناس قیمت | فروش, تعویض, ارزش سیم کارت, خرید امانی | 4 mock items |
| `product-manager/page.tsx` | مدیر محصول | خرید, فروش, تعویض, تعویض فوری, امانی | 3 mock items |
| `sell-manager/page.tsx` | مدیر فروش | خرید, فروش, پیش سفارش, تعویض, امانی | 8 mock items |
| `Investment/page.tsx` | مدیریت سرمایه‌گذاری | خرید سرمایه‌گذاری, فروش پورتفوی, پیش‌خرید کد, سودآوری, صندوق‌ها | 3 mock items |

**Imports:**
```typescript
import AgentDashboard, { CategoryItem, WorkItem } from "@/components/AgentDashboard";
```

**Props Pattern:**
```typescript
<AgentDashboard title="مدیر محصول" categories={categories} works={works} />
```
- `categories: CategoryItem[]` — Array of `{ title, count, href }`
- `works: WorkItem[]` — Array of `{ id, title, section, status, phone, date, href }`

**Key Issue:** All data is **hardcoded mock data**. No API fetching occurs in these pages.

### 5.2 Agent Workflow Pages (`app/(auth)/agent/*/*/page.tsx`)

**Pattern:** All 15 workflow pages use the same `RoleWorkflowPage` component via `@/components/WorkflowPage`.

| Page | stepTitle | displayFields | inputFields | initialData |
|------|-----------|---------------|-------------|-------------|
| price-expert/sell | فروش سیم کارت | province, city, SaleContactNumber, statusType | purchasePrice, salePrice, agentNote | Province+City+contact |
| price-expert/value | ارزش سیم کارت | SaleContactNumber, statusType | ValuePrice | Contact+mock status |
| price-expert/escrow | فروش امانی | customerPrice, duration, province, city, statusType | valueSellPrice | Price+duration |
| price-expert/switch | تعویض سیم کارت | province, city, SaleContactNumber, statusType | purchasePrice, salePrice, agentNote | Contact+status |
| product-manager/buy | خرید سیم کارت | SaleContactNumber | isAvailable, useSuggestedPrice, FinalPrice, agentNote | Contact+price |
| product-manager/sell | فروش سیم کارت | SaleContactNumber, simOwner, SalePrice | *(empty)* | Contact+owner+price |
| product-manager/escrow | فروش امانی | BuyContactNumber, simOwner, customerPrice, duration, province, city, statusType, contactNumber, previousAgentNotes | *(empty)* | Full mock data |
| product-manager/switch | تعویض سیم کارت مرحله ۲ | SaleContactNumber | useSuggestedPrice, agentNote | Contact |
| product-manager/f-switch | تعویض سیم کارت مرحله ۴ | SaleContactNumber, simOwner, SalePrice | *(empty)* | Contact+owner+price |
| sell-manager/buy | خرید سیم کارت | simOwner, province, city, BuyContactNumber, contactNumber, previousAgentNotes | *(empty)* | Full contact data |
| sell-manager/sell | فروش سیم کارت | PriceAgentNotes, province, city, SaleContactNumber, statusType, customerPrice, duration | purchasePrice, agentNote | Price+duration |
| sell-manager/escrow | فروش امانی | PriceAgentNotes, simOwner, customerPrice, duration, province, city, statusType, contactNumber | *(empty)* | Full mock data |
| sell-manager/preorder | پیش سفارش | simOwner, contactNumber, customerDescription | *(empty)* | Owner+contact |
| sell-manager/switch | تعویض سیم کارت | BuyContactNumber, simOwner, customerPrice, duration, province, city, statusType, contactNumber, previousAgentNotes | *(empty)* | Full mock data |
| Investment/Invest | سرمایه گذاری | investmentType, contactRequest, simOwner, contactNumber | *(empty)* | Full investment data |

**Imports:**
```typescript
import RoleWorkflowPage from "@/components/WorkflowPage";
```

**Props Pattern:**
```typescript
<RoleWorkflowPage
  stepTitle="..."                    // Workflow step name in Persian
  displayFields={["field1", ...]}   // Read-only data fields to display
  inputFields={["field1", ...]}     // Editable input fields for the agent
  initialData={{ ... }}             // Initial mock data for the form
/>
```

**Critical Issue:** `WorkflowPage` component is **NOT in the `components/` directory**. The import points to `@/components/WorkflowPage` but no such file exists in the listed components. The component is likely compiled into `.next/` or is expected to be created. This means the entire agent workflow system is currently **non-functional** — all 15 workflow pages will fail to render.

### 5.3 Admin Dashboard Pages (`app/(auth)/admins/*/page.tsx`)

**Pattern:** All 4 admin pages use a **self-contained inline UI** with `Navbar` and no shared `AgentDashboard` or `WorkflowPage`.

| Page | Title | Metric Cards | List Items |
|------|-------|-------------|------------|
| product-manager | مرکز مدیریت محصول | 4 metrics | 3 request cards |
| price-expert | مرکز ارزش‌گذاری | 4 metrics | 3 request cards |
| sell-manager | مرکز مدیریت فروش | 4 metrics | 3 request cards |
| Investment | (same as price-expert layout) | 4 metrics | 3 request cards |

**Imports:**
```typescript
import Link from "next/link";
import Navbar from "@/components/Navbar";
```

**Architecture:** These are standalone dashboard pages with hardcoded mock data. They link to agent workflow pages via `next/Link` components.

---

## 6. Authentication Architecture

### 6.1 Three Auth Tiers

| Tier | Login API | Cookie | Role | Routes |
|------|-----------|--------|------|--------|
| User | `POST /api/auth/login` | `token` JWT | `user` | Public pages |
| Admin | `POST /api/admin/auth` | `token` JWT | `admin` | `/admin/*` |
| Agent | `POST /api/agent/auth` | `token` JWT | `agent` | `/agent/*` |

### 6.2 Auth Implementation Details

**JWT Token Structure (from `lib/jwt.ts`):**
```typescript
{ id: string; role: "admin" | "agent" | "user"; adminId?: string }
```

**Middleware Protection (`middleware.ts`):**
- Guards `/admin/*` and `/agent/*` routes
- Reads JWT from `token` cookie
- Verifies role matches (`admin` can't access `/agent/*`, vice versa)
- Redirects to login on failure

**Agent Login Flow (`app/agent/login/page.tsx`):**
1. User submits username + password
2. `fetch POST /api/agent/auth` with credentials
3. Server verifies against `Agent` table via bcrypt
4. JWT is set in httpOnly cookie
5. Redirect to `/agent/panel`

**Agent Panel Flow (`app/agent/panel/page.tsx`):**
1. Fetches `/api/agent/me` to verify session
2. Fetches `/api/agent/stats` for analytics
3. On unauthorized (401), redirects to `/agent/login`
4. Shows logout button that calls `DELETE /api/agent/auth`

**Form Submission Pattern (from `app/buy/page.tsx`):**
```typescript
const agentId = localStorage.getItem("agentId");
const url = "/api/forms/buy" + (agentId ? `?agentId=${encodeURIComponent(agentId)}` : "");
const res = await fetch(url, { method: "POST", body: JSON.stringify({ formType, formData }) });
```

### 6.3 Customer Form → Agent Link Flow

1. Agent shares a URL: `https://sim24.ir/?agentId={agentId}`
2. Home page (`app/page.tsx`) reads `agentId` from query param
3. Stores in `localStorage`
4. Propagates `agentId` to all form submission pages (buy, sell, invest, search)
5. Forms include `agentId` in the API call
6. Backend stores `agentId` on the `CustomerForm` record

---

## 7. API Route Patterns

### 7.1 Form Submission Pattern (POST)

All form routes follow the same structure:

```typescript
// file: app/(api)/forms/[type]/route.ts
export async function POST(req: NextRequest) {
  // 1. Extract agentId from query params or JWT cookie
  // 2. Parse request body: { formType, formData }
  // 3. Validate with Zod schema
  // 4. Save to Prisma (customerForm.create)
  // 5. Return { message, data: { id, createdAt } }
}
```

**Common validation libraries:** `zod`  
**Common response format:** `{ message, data: { id, createdAt } }` or `{ message, errors }`

### 7.2 Data Retrieval Pattern (GET)

```typescript
// file: app/(api)/agent/forms/route.ts
export async function GET(request: NextRequest) {
  // 1. Verify JWT token from cookie
  // 2. Extract role: "agent" or "admin"
  // 3. Build Prisma where clause with filters
  // 4. Return { forms } or { agents }
}
```
**Filters supported:** `formType`, `phone`, `startDate`, `endDate`, `agentId` (admin only)

### 7.3 JWT Verification Pattern

```typescript
const token = request.cookies.get("token")?.value;
if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
const payload = await verifyToken(token);
if (payload.role !== "agent") return NextResponse.json({ error: "forbidden" }, { status: 403 });
```

---

## 8. Component Patterns

### 8.1 Form UI Components

| Component | Path | Usage | Props |
|-----------|------|-------|-------|
| `FieldSet` | `@/components/FieldSet` | Basic text/input field | `label, value, onChange, error, helperText, dir, type` |
| `AutocompleteField` | `@/components/AutocompleteField` | Province/city dropdown | `label, options, value, onChange, error, disabled` |
| `HowKnow` | `@/components/HowKnow` | "How did you know us?" selector | `val, onChange, forceError` |
| `TimeLine` | `@/components/TimeLine` | Duration selector (months) | `val, onChange, forceError` |
| `Consignment` | `@/components/Consignment` | Consignment sale form | `submitted, onFieldChange` |
| `AcceptTerms` | `@/components/AcceptTerms` | Terms checkbox | `ch, onChange, showErr` |
| `GlassCard` | `@/components/GlassCard` | Glass-morphism card wrapper | `cls, ch` |
| `Layout` | `@/components/Layout` | Main page layout | `ch` |
| `BottomLogo` | `@/components/BottomLogo` | Footer logo | — |

### 8.2 State Management Pattern (Customer Forms)

All customer forms (`app/buy/page.tsx`, `app/sell/page.tsx`) use:

```typescript
// 1. Individual useState for each field
const [nm, setNm] = useState("");
const [fm, setFm] = useState("");
// ...

// 2. localStorage persistence
const LS_KEY = "buyForm";
useEffect(() => {
  // Restore from localStorage on mount
  const saved = localStorage.getItem(LS_KEY);
  if (saved) { /* parse and set state */ }
}, []);
useEffect(() => {
  // Save on every change
  localStorage.setItem(LS_KEY, JSON.stringify({ ... }));
}, [/* all state variables */]);

// 3. Validation on submit
const handleSubmit = () => {
  setSubmitted(true);
  if (isValid) setShowConfirm(true);
};

// 4. Confirmation modal before final API call
const handleConfirmFinal = async () => {
  const res = await fetch("/api/forms/buy?...", { /* POST */ });
  if (res.ok) { /* clear form + localStorage */ }
};
```

---

## 9. Agent Workflow Architecture Problems

### 9.1 Critical Issues

| Issue | Severity | Details |
|-------|----------|---------|
| **Missing WorkflowPage component** | 🔴 Critical | 15 pages import from `@/components/WorkflowPage` but the component does not exist in the `components/` directory. The entire agent workflow system is non-functional. |
| **100% hardcoded mock data** | 🟠 High | Agent dashboard pages (`AgentDashboard`) and admin pages use hardcoded arrays of `CategoryItem` and `WorkItem`. No data is fetched from the API. |
| **No API integration in agent dashboards** | 🟠 High | The agent dashboards do not call any API to get real counts, real work items, or real statuses. |
| **No server actions** | 🟠 High | All forms use client-side `fetch()` calls rather than Next.js Server Actions. This means no progressive enhancement, no form validation on the server before submission. |
| **No Prisma direct access from pages** | 🟡 Medium | Pages never call Prisma directly. All DB access goes through API routes, which is correct, but the API routes are inconsistent in error handling. |
| **localStorage for agentId** | 🟡 Medium | Agent ID is stored in `localStorage` for form submissions. This is fragile — clearing browser cache breaks the agent link. No server-side session tracking exists for unauthenticated customer journeys. |

### 9.2 Architectural Problems

| Problem | Description |
|---------|-------------|
| **No shared workflow state** | Each `WorkflowPage` is standalone. There is no centralized state management for tracking a form's progress through multiple stages (e.g., customer submits → price expert reviews → product manager publishes). |
| **No workflow routing engine** | The current architecture has no backend logic for routing a form from one agent role to another. The admin pages show links to agent workflows, but the routing is all static in the frontend. |
| **No status machine** | `CustomerForm.formData` is a JSON blob with no standardized status field. Different parts of the app interpret status differently. There is no state machine or lifecycle management for forms. |
| **Duplicate code in forms** | Both `app/buy/page.tsx` and `app/sell/page.tsx` duplicate the same pattern: localStorage persistence, field-by-field state, validation, confirmation modal, fetch call. ~800 lines of code just for two forms. |
| **No TypeScript sharing** | Form field types are re-declared in multiple places. The Zod schemas in API routes are the source of truth, but the frontend doesn't use them for type safety. |
| **Mock data vs real data** | Agent dashboards mock data, but the API endpoints (`/api/agent/forms`, `/api/agent/stats`) already return real data. The dashboards simply never call them. |
| **WorkflowPage is a black box** | Since the component is missing, its full capabilities are unknown. Based on the props passed, it likely renders `displayFields` as read-only info cards and `inputFields` as agent input forms, but there's no way to verify. |

---

## 10. Reusable Patterns for Automation System

### 10.1 What Works Well (Should Be Replicated)

| Pattern | Location | Why It Works |
|---------|----------|-------------|
| **Zod validation** | All `route.ts` files | Type-safe, self-documenting, produces clear error messages |
| **Agent link propagation** | `app/page.tsx` + `localStorage` | Simple, works without authentication |
| **JWT middleware guards** | `middleware.ts` | Edge-compatible, role-based, centralized |
| **API route delegation** | `app/(api)/forms/*` | Clean separation of concerns |
| **Cookie-based auth** | All login routes | httpOnly cookies prevent XSS, `sameSite: strict` prevents CSRF |
| **Prisma singleton** | `lib/prisma.ts` | Prevents connection leak in development |
| **Health check endpoint** | `/api/auth/check` | Simple, no auth required, used by Docker HEALTHCHECK |
| **Persian date handling** | `app/agent/panel/forms/page.tsx` | Comprehensive `toPersianDate` and `toPersianDateShort` utilities |
| **CSV export** | `app/agent/panel/forms/page.tsx` | `exportToCSV` with BOM, proper escaping, Persian headers |

### 10.2 What Should Be Abstracted for Automation

```typescript
// Proposed Shared Types (currently duplicated)
interface FormSubmission {
  formType: string;
  formData: Record<string, unknown>;
  agentId?: string;
  metadata?: Record<string, unknown>;
}

interface WorkflowStep {
  id: string;
  title: string;
  role: "price-expert" | "product-manager" | "sell-manager" | "investment";
  status: "pending" | "in-progress" | "completed" | "rejected";
  formId: string;
  assignedTo?: string;
  previousStep?: string;
  nextStep?: string;
}

interface DashboardStats {
  totalForms: number;
  byStatus: Record<string, number>;
  byRole: Record<string, number>;
  recentActivity: ActivityItem[];
}
```

### 10.3 API Response Standardization

Current API responses are inconsistent:

| API Route | Success Format | Error Format |
|-----------|---------------|--------------|
| `forms/buy` | `{ message, data: { id, createdAt } }` | `{ message, errors }` |
| `forms/sell` | `{ message, data: { id, createdAt } }` | `{ message }` |
| `agent/auth` | `{ success: true, agent: {...} }` | `{ error: "..." }` |
| `stats` | `{ totalForms, uniqueCustomers, byType, ... }` | `{ error: "unauthorized" }` |

**Standardization needed:**
```typescript
// Proposed unified response format
type ApiResponse<T> = 
  | { success: true; data: T; message?: string }
  | { success: false; error: string; details?: unknown };
```

---

## 11. Automation System Recommendations

### 11.1 Workflow Engine Architecture

```
Customer submits form
        ↓
[Form Submitted] ──── agentId attached?
        ↓
[Agent Dashboard] ── Price Expert reviews price
        ↓
[Product Manager] ── Reviews inventory, publishes
        ↓
[Sell Manager] ───── Finalizes sale, handles logistics
        ↓
[Completed]
```

### 11.2 Required Backend Tables (New Prisma Models)

```prisma
model AutomationWorkflow {
  id          String   @id @default(cuid())
  formId      String
  form        CustomerForm @relation(fields: [formId], references: [id])
  status      String   // pending, active, completed, cancelled
  currentStep String   // which role is handling it
  steps       WorkflowStep[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model WorkflowStep {
  id           String   @id @default(cuid())
  workflowId   String
  workflow     AutomationWorkflow @relation(fields: [workflowId], references: [id])
  role         String   // price-expert, product-manager, sell-manager, investment
  agentId      String?
  agent        Agent?   @relation(fields: [agentId], references: [id])
  status       String   // pending, assigned, in-progress, completed, rejected
  notes        String?
  data         Json?    // role-specific data entered at this step
  assignedAt   DateTime?
  completedAt  DateTime?
  createdAt    DateTime @default(now())
}
```

### 11.3 API Routes to Create

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/automation/start` | Create a new workflow from a submitted form |
| GET | `/api/automation/workflows` | List workflows (filterable by role, status) |
| GET | `/api/automation/workflows/:id` | Get workflow detail with all steps |
| POST | `/api/automation/step/complete` | Mark a step as complete, advance to next |
| POST | `/api/automation/step/assign` | Assign a step to a specific agent |
| GET | `/api/automation/stats` | Automation-specific dashboard stats |

### 11.4 Frontend Pages to Create

| Route | Purpose | Component |
|-------|---------|-----------|
| `/agent/automation` | All workflows assigned to agent | `AutomationDashboard` |
| `/agent/automation/:id` | Workflow detail with current step | `AutomationDetail` |
| `/admins/automation` | Global workflow overview | `AutomationAdmin` |
| `/api/automation/webhook` | External automation trigger | (API route) |

### 11.5 Reusable Components to Build

| Component | Purpose | Based On |
|-----------|---------|----------|
| `AutomationDashboard` | Workflow list with filters | `AgentDashboard` pattern |
| `AutomationDetail` | Single workflow with step-by-step view | `WorkflowPage` pattern (once created) |
| `StatusBadge` | Color-coded status indicator | Inline badges in admin pages |
| `WorkflowTimeline` | Visual step progression | `WorkflowPage.displayFields` concept |
| `FormFieldRenderer` | Renders a field as read-only or editable | `LABEL_MAP` + `VALUE_MAP` pattern |

---

## 12. Conclusion

The current architecture has a **solid foundation** for an automation system:

- ✅ Authentication is already role-based (admin, agent, user)
- ✅ Form submission API endpoints exist with Zod validation
- ✅ Agent linking is implemented (query params + localStorage)
- ✅ Database schema (`CustomerForm`) accepts JSON form data

**However, 15 agent workflow pages are non-functional** due to the missing `WorkflowPage` component, and all agent dashboard data is hardcoded. The automation system must:

1. **First create the WorkflowPage component** (or replace it) — this is the foundation for all agent workflows
2. **Connect agent dashboards to real API data** — replace mock data with actual API calls
3. **Create the workflow engine models** — `AutomationWorkflow` + `WorkflowStep`
4. **Build the routing system** — automatically move forms through stages based on role completion
5. **Standardize the API response format** — consistent success/error across all endpoints

---

## Appendix: Complete File Count

| Directory | Pages | API Routes | Components |
|-----------|-------|------------|------------|
| `app/(auth)/agent/*` | 19 | — | — |
| `app/(auth)/admins/*` | 4 | — | — |
| `app/agent/*` | 3 | — | — |
| `app/(api)/*` | — | 14 | — |
| `app/buy` | 1 | — | — |
| `app/sell` | 1 | — | — |
| `components/` | — | — | 16 (visible) |
| **Total** | **28** | **14** | **16** |