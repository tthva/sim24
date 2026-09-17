# ==================== Stage 1: Install Dependencies ====================
FROM node:22-alpine AS deps
WORKDIR /app

# Install required system packages for Prisma
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

# Install required system packages
RUN apk add --no-cache openssl

# Copy node_modules and Prisma client from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Accept JWT_SECRET as build arg (use dummy value if not provided)
ARG JWT_SECRET=dummy-jwt-secret-for-build
ENV JWT_SECRET=${JWT_SECRET}

# Build Next.js application (standalone output)
RUN npm run build

# ==================== Stage 3: Production Runtime ====================
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

# Install runtime system packages
RUN apk add --no-cache openssl curl tini

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy Prisma-generated client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Copy standalone build output (Next.js "output: standalone" mode)
COPY --from=builder /app/public ./public

# Copy the standalone server and its dependencies
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy next config and package.json for reference
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/package.json ./

# Set proper ownership
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=15s --timeout=10s --start-period=45s --retries=5 \
  CMD curl -f http://localhost:3000/api/auth/check || exit 1

# Use tini as init to handle signals properly for graceful shutdown
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["node", "server.js"]
