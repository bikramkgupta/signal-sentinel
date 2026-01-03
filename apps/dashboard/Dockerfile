# =============================================================================
# Dockerfile for dashboard (Next.js frontend)
# Build from project root: docker build -f apps/dashboard/Dockerfile .
# Uses Next.js standalone output for optimized production builds
# =============================================================================

FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy workspace config and package files
COPY package.json package-lock.json ./
COPY apps/dashboard/package.json ./apps/dashboard/

# Install all dependencies
RUN npm ci

# Build stage
FROM base AS builder
WORKDIR /app

# Copy node_modules from deps stage (npm workspaces hoists to root)
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY apps/dashboard ./apps/dashboard

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build Next.js app
WORKDIR /app/apps/dashboard
RUN npm run build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3002
ENV HOSTNAME="0.0.0.0"

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/apps/dashboard/public ./public

# Set correct permissions for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/apps/dashboard/.next/standalone ./

# Copy static assets into the correct location
COPY --from=builder --chown=nextjs:nodejs /app/apps/dashboard/.next/static ./.next/static

# Copy node_modules - Next.js standalone in monorepo needs the root node_modules
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

USER nextjs

EXPOSE 3002

# Next.js standalone server
CMD ["node", "server.js"]
