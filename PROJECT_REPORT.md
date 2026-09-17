# PROJECT REPORT — SIM24 (سیم۲۴)

---

## 1. Project Type
**Fullstack Web Application** — Next.js App Router with both frontend (React SPA) and backend (API routes) in a single monorepo.

---

## 2. Programming Languages
- **TypeScript** (primary — both frontend and backend)
- **CSS** (Tailwind + PostCSS)
- **SQL** (via Prisma ORM)

---

## 3. Framework
- **Next.js** `^16.2.7` — App Router, React 18, Server Components + API Routes
- **React** `^18` (frontend UI library)
- **Tailwind CSS** `^3.3.0` (utility-first CSS framework)
- **Prisma** `^5.22.0` (ORM / database layer)

---

## 4. Package Manager
**npm** (lock file: `package-lock.json`)

---

## 5. Entry Point
Next.js handles its own entry point internally. The primary entry for the application is:
- **Development:** `next dev` (entry script at `node_modules/.bin/next`)
- **Production:** `next start` (runs the compiled `.next` build)

No custom `server.js` — all routes are defined via the Next.js App Router (filesystem-based routing in `app/` and `app/(api)/`).

---

## 6. Run Command
| Mode | Command | Notes |
|------|---------|-------|
| Development | `npm run dev` | Runs `next dev` with hot reload |
| Production Build | `npm run build` | Runs `next build` |
| Production Start | `npm run start` | Runs `next start` after build |
| Database Seed | `npm run seed` | Runs `npx prisma db seed` (uses `tsx prisma/seed.ts`) |

---

## 7. Default Port
**3000** (Next.js default, configurable via `PORT` environment variable)

---

## 8. Environment Variables
| Variable | Required | Description | Example Value |
|----------|----------|-------------|---------------|
| `DATABASE_URL` | ✅ Yes | PostgreSQL connection string | `postgresql://postgres@localhost:5432/sim24` |
| `JWT_SECRET` | ✅ Yes | Secret key for JWT token signing (64 hex chars) | `5b8309ef8f19cee866f555531eb70705360fb0e9ca7712b3923834aa401899ca` |
| `NODE_ENV` | ✅ Yes | Runtime environment | `production` (typically) or `development` |
| `PORT` | ❌ No | Custom HTTP port override | `3000` |
| `CRON_API_KEY` | ❌ No | API key for CRON-based form check endpoint | — |
| `CRM_WEBHOOK_URL` | ❌ No | External CRM webhook URL (future use) | — |

---

## 9. Dependencies

### Production Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| `next` | ^16.2.7 | React framework with SSR, SSG, API routes |
| `react` / `react-dom` | ^18 | Frontend UI rendering |
| `@prisma/client` | ^5.22.0 | Database ORM client |
| `prisma` | ^5.22.0 | ORM CLI (schema migrations, seed) |
| `pg` | ^8.21.0 | PostgreSQL driver |
| `jose` | ^6.2.3 | JWT signing/verification (Web-standard, Edge-compatible) |
| `jsonwebtoken` | ^9.0.3 | Legacy JWT library (fallback / compatibility) |
| `bcryptjs` | ^3.0.3 | Password hashing (pure JS, no native deps) |
| `zod` | ^4.4.3 | Schema validation (API request payloads) |
| `vazirmatn` | ^33.0.3 | Persian (Farsi) font |
| `zaman` | ^2.1.1 | Persian date/time library |
| `@emotion/react` / `@emotion/styled` | ^11.x | CSS-in-JS (optional, possibly unused) |
| `@types/bcryptjs` / `@types/jsonwebtoken` | — | TypeScript type definitions |
| `install` | ^0.13.0 | (**Likely accidental dependency** — npm install shim) |

### Dev Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5 | TypeScript compiler |
| `tsx` | ^4.22.4 | Execute TypeScript directly (used for seed) |
| `tailwindcss` | ^3.3.0 | CSS utility framework |
| `postcss` | ^8 | CSS post-processor |
| `autoprefixer` | ^10 | CSS vendor prefixes |
| `@types/node` / `@types/react` / `@types/react-dom` | — | TypeScript type definitions |

---

## 10. Database

### Type
**PostgreSQL** (via Prisma ORM)

### Connection
- Defined in `.env.local`: `DATABASE_URL=postgresql://postgres@localhost:5432/sim24`
- Also defaults to a local `dev.db` (SQLite) if no `DATABASE_URL` is set? — No, `schema.prisma` explicitly uses `postgresql` provider and reads `DATABASE_URL` from env.

### Schema (5 models)
| Model | Table | Purpose |
|-------|-------|---------|
| `Admin` | `Admin` | Super admin accounts with agent management |
| `Agent` | `Agent` | Sales agents linked to an admin |
| `User` | `User` | End-user accounts (login via username+password+OTP) |
| `CustomerForm` | `CustomerForm` | Form submissions (buy/sell/invest/search) with JSON data |
| `WebhookEvent` | `WebhookEvent` | External webhook event log |

### Key Relationships
- Admin `1:N` Agent (one admin manages many agents)
- Agent `1:N` CustomerForm (one agent submits many forms)
- No direct relation between User and CustomerForm

### Migrations
- Located in `prisma/migrations/` directory (already applied)
- Seed script at `prisma/seed.ts` (executed via `tsx`)

---

## 11. Project Structure

```
/
├── app/                          # Next.js App Router (frontend + API)
│   ├── layout.tsx                # Root layout (RTL, Persian font)
│   ├── page.tsx                  # Home page (main menu grid)
│   ├── globals.css               # Global Tailwind styles
│   ├── (api)/                    # **API route group** (rewritten from /api/:path*)
│   │   ├── auth/
│   │   │   ├── login/route.ts    # POST - User login (username+password+OTP)
│   │   │   ├── check/route.ts    # GET  - JWT auth check
│   │   │   └── logout/route.ts   # POST - Clear auth cookie
│   │   ├── admin/
│   │   │   ├── auth/route.ts     # POST - Admin login
│   │   │   ├── agents/route.ts   # GET/POST - CRUD agents
│   │   │   ├── forms/route.ts    # GET - List all forms (admin view)
│   │   │   ├── panel/            # Admin panel page (page component)
│   │   │   ├── login/            # Admin login page
│   │   │   └── agents/           # Admin agents list page
│   │   ├── agent/
│   │   │   ├── auth/route.ts     # POST/DELETE - Agent login/logout
│   │   │   ├── me/route.ts       # GET - Current agent info
│   │   │   ├── stats/route.ts    # GET - Agent dashboard statistics
│   │   │   ├── forms/route.ts    # GET - List agent's forms
│   │   │   ├── auth/             # Agent login page
│   │   │   └── forms/            # Agent forms page
│   │   ├── forms/
│   │   │   ├── buy/route.ts      # POST - Submit buy form (direct/market/cons/installment/preorder)
│   │   │   ├── sell/route.ts     # POST - Submit sell form (direct/market/cons)
│   │   │   ├── search/route.ts   # POST - Submit search/expertise form
│   │   │   └── invest/           # Investment form (page component)
│   │   ├── investments/route.ts  # POST - Submit investment form
│   │   ├── sim-value/route.ts    # GET  - SIM card value estimation (mock)
│   │   └── webhook/
│   │       └── crm/route.ts      # POST - CRM webhook receiver
│   ├── admin/                    # Admin panel pages (frontend)
│   ├── agent/                    # Agent panel pages (frontend)
│   ├── buy/                      # Buy flow pages
│   ├── sell/                     # Sell flow pages
│   ├── search/                   # SIM search/expertise pages
│   ├── invest/                   # Investment pages
│   ├── login/                    # User login page
│   ├── settings/                 # Settings pages
│   └── terms/                    # Terms & conditions pages
├── components/                   # Reusable React components
│   ├── Layout.tsx                # Main layout wrapper
│   ├── Navbar.tsx                # Navigation bar
│   ├── GlassCard.tsx             # Glass-morphism card component
│   ├── InputField.tsx            # Form input component
│   ├── FieldSet.tsx              # Field group component
│   ├── AutocompleteField.tsx     # Autocomplete input
│   ├── SelectUs.tsx              # Dropdown/select component
│   ├── HowKnow.tsx               # "How did you know us?" component
│   ├── TimeLine.tsx              # Timeline/stepper component
│   ├── BottomLogo.tsx            # Footer logo
│   ├── Consignment.tsx           # Consignment form component
│   ├── MarketSwap.tsx            # Market swap component
│   ├── installment.tsx           # Installment component
│   ├── preorder.tsx              # Pre-order component
│   ├── AcceptTerms.tsx           # Terms acceptance checkbox
│   └── WithAuth.tsx              # Auth HOC wrapper
├── lib/                          # Utility libraries
│   ├── auth.ts                   # Client-side auth helpers (getToken, isAuthenticated, logout)
│   ├── jwt.ts                    # JWT sign/verify (using jose)
│   ├── password.ts               # bcrypt hash/compare
│   ├── prisma.ts                 # Prisma singleton client
│   ├── iranData.ts               # Iran provinces/cities data
│   ├── useFormPersist.ts         # Form persistence hook (localStorage)
│   └── generated/                # Auto-generated files
├── prisma/                       # Database schema & migrations
│   ├── schema.prisma             # Prisma schema (5 models, PostgreSQL)
│   ├── seed.ts                   # Database seed script
│   ├── migrations/               # Migration history
│   └── dev.db                    # Local SQLite dev database (legacy?)
├── public/                       # Static assets
│   ├── fonts/                    # Font files
│   ├── *.png, *.svg              # Images and icons
│   └── logo.png, logo2.png       # Brand logos
├── middleware.ts                 # Next.js Edge Middleware (JWT auth guard for /admin/* and /agent/*)
├── next.config.mjs               # Next.js config (rewrites, images, dev origins)
├── tailwind.config.ts            # Tailwind CSS configuration
├── postcss.config.mjs            # PostCSS configuration
├── tsconfig.json                 # TypeScript configuration
├── .env.local                    # Local environment variables (DATABASE_URL, JWT_SECRET, NODE_ENV)
├── .gitignore                    # Git ignore rules
├── ecosystem.config.js           # PM2 process manager config (for production)
└── package.json                  # Project manifest & scripts
```

---

## 12. Build Requirements

### Required Build Steps in Production
```bash
# 1. Install dependencies
npm ci --omit=dev       # or npm install --production (but Prisma client needs dev deps for generate)

# Better approach:
npm ci                  # Install ALL dependencies

# 2. Generate Prisma client
npx prisma generate

# 3. Apply database migrations
npx prisma migrate deploy

# 4. (Optional) Seed database
npm run seed

# 5. Build Next.js application
npm run build

# 6. Start production server
npm run start
```

### Build Artifacts
- `.next/` — Compiled Next.js output (server + client bundles)
- `node_modules/` — Dependencies
- `prisma/migrations/` — Applied migrations

### Build Tools Used
- **TypeScript** (`tsc` / `tsx`) — Type checking and compilation
- **Next.js Build** (`next build`) — Production bundling (uses webpack/turbopack internally)
- **Tailwind CSS** — Generates optimized CSS during build
- **Prisma** — Code generation for type-safe database client

---

## 13. Deployment Strategy

### Architecture Overview
This is a **Fullstack Next.js application** that can be deployed as a single container serving both the frontend SPA and backend API.

### Recommended Docker Deployment

#### Base Image
- **Node.js 22 Alpine** (`node:22-alpine`) — Small, secure, production-optimized
- Includes OpenSSL for Prisma PostgreSQL connections

#### Multi-stage Build
1. **Stage 1 (Deps):** Install all dependencies + generate Prisma client
2. **Stage 2 (Build):** Run `next build`
3. **Stage 3 (Production):** Copy build output, install production deps only, run `next start`

#### Required Ports
| Port | Purpose |
|------|---------|
| `3000` | HTTP (Next.js application server) |

> No database port is exposed — the PostgreSQL database should run in a separate container or as a managed service.

#### Runtime Command
```bash
node_modules/.bin/next start
```
or via PM2 (as in `ecosystem.config.js`):
```bash
pm2-runtime start ecosystem.config.js
```

#### Environment Variables (at runtime)
| Variable | Required | How to Pass |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Docker env / Docker Compose |
| `JWT_SECRET` | ✅ | Docker env / Docker Compose (Docker secrets recommended) |
| `NODE_ENV` | ✅ | Set to `production` |
| `PORT` | ❌ | Defaults to `3000` |

#### Volume Requirements
| Volume | Purpose |
|--------|---------|
| (none required) | Stateless application — all data in PostgreSQL |

No persistent volumes needed for the app container itself. Database persistence is handled by the PostgreSQL container's volume.

#### Database Container
- **Image:** `postgres:16-alpine`
- **Port:** `5432`
- **Volume:** `pgdata:/var/lib/postgresql/data`
- **Health Check:** Required before app starts

---

## 14. Recommended Dockerfile

```dockerfile
# ==================== Stage 1: Install Dependencies ====================
FROM node:22-alpine AS deps
WORKDIR /app

# Install OpenSSL (required by Prisma for PostgreSQL)
RUN apk add --no-cache openssl

# Copy dependency files
COPY package.json package-lock.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Generate Prisma client
COPY prisma ./prisma
RUN npx prisma generate

# ==================== Stage 2: Build Application ====================
FROM node:22-alpine AS builder
WORKDIR /app

# Install OpenSSL
RUN apk add --no-cache openssl

# Copy deps and Prisma client from stage 1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js application
RUN npm run build

# ==================== Stage 3: Production Runtime ====================
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma

# Copy Prisma-generated client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy build output
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/package.json ./

# Set proper ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

# Expose application port
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/auth/check || exit 1

# Start the application
CMD ["node_modules/.bin/next", "start"]
```

---

## 15. Recommended docker-compose.yml

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    container_name: sim24-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-changeme}
      POSTGRES_DB: sim24
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: sim24-app
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD:-changeme}@postgres:5432/sim24
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      postgres:
        condition: service_healthy
    # Uncomment to use PM2 instead of next start:
    # command: ["npx", "pm2-runtime", "start", "ecosystem.config.js"]

volumes:
  pgdata:
    driver: local
```

### Environment File (.env for docker-compose)
```env
# PostgreSQL password (change in production!)
POSTGRES_PASSWORD=changeme

# JWT secret (64 hex chars — generate with: openssl rand -hex 32)
JWT_SECRET=5b8309ef8f19cee866f555531eb70705360fb0e9ca7712b3923834aa401899ca
```

---

## Deployment Checklist

| Step | Description |
|------|-------------|
| 1️⃣ | Set `POSTGRES_PASSWORD` to a strong random value |
| 2️⃣ | Generate a new `JWT_SECRET` via `openssl rand -hex 32` |
| 3️⃣ | Run `docker compose up -d` |
| 4️⃣ | Run migrations: `docker compose exec app npx prisma migrate deploy` |
| 5️⃣ | (Optional) Seed database: `docker compose exec app npm run seed` |
| 6️⃣ | Verify health: `curl http://localhost:3000/api/auth/check` |

---

## Additional Notes

### Authentication Flow
1. **Middleware guards** — Edge middleware (`middleware.ts`) protects `/admin/*` and `/agent/*` routes by verifying JWT from httpOnly cookies
2. **API authentication** — Backend API routes verify JWT tokens from cookies via `jose`
3. **Form submission** — Forms can be submitted with or without authentication; anonymous submissions linked via `agentId` query parameter

### API Rewrite
`next.config.mjs` rewrites `/api/:path*` → `/:path*`, meaning all API routes in `app/(api)/` are accessible via `/api/...` prefix.

### PM2 (Production Process Manager)
An `ecosystem.config.js` is present for PM2-based deployments. In Docker, this is optional — `next start` is sufficient.

### Potential Improvements for Production
1. Remove the `"install"` dependency from `package.json` (likely accidental)
2. Add `--no-cache` to npm ci in Dockerfile for reproducible builds
3. Consider using `next start` with clustering via PM2 if running outside Docker
4. Add rate limiting to API routes (e.g., `@upstash/ratelimit` or `express-rate-limit`-style middleware)
5. Add structured logging (e.g., `pino` or `winston`)
6. Consider adding a reverse proxy (Nginx/Caddy) in front of Next.js for SSL termination and static file caching