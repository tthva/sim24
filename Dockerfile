# ─── Stage 1: Dependencies ───
FROM node:22-alpine AS deps
# Pin the official registry: the build host may inject a paid mirror
# (mirror-npm.runflare.com) via proxy env, which can 402 on fetch.
RUN npm config set registry https://registry.npmjs.org/ && \
    apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ─── Stage 2: Builder ───
FROM node:22-alpine AS builder
# Build-time only placeholder: lib/jwt.ts throws at import if JWT_SECRET is
# unset, and Next collects page data during build. A dummy is NOT baked into
# the runtime image — the real secret is injected via env at `docker run`.
ARG JWT_SECRET=dummy-jwt-secret-for-build
ENV JWT_SECRET=${JWT_SECRET}
# Heap cap for the build (next build can exceed 2GB without it)
ENV NODE_OPTIONS=--max-old-space-size=1536
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma Client before build
RUN npx prisma generate
# Build Next.js (with standalone output)
RUN npm run build

# ─── Stage 3: Runner ───
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl curl tini
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built assets
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Copy Prisma runtime dependencies.
# NOTE: only @prisma/client — @prisma/engines (~40MB, CLI/migrate tooling)
# is intentionally NOT shipped; the runtime query engine lives in .prisma.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Healthcheck: accepts 200 or 401 (auth/check returns 401 without cookie)
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/auth/check | grep -qE '^(200|401)$' || exit 1

# Use tini as init to handle signals properly for graceful shutdown
ENTRYPOINT ["/sbin/tini", "--"]

CMD ["node", "server.js"]

