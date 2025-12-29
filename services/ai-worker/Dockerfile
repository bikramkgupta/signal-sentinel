# =============================================================================
# Dockerfile for ai-worker service (Job processor → Gradient AI)
# Build from project root: docker build -f services/ai-worker/Dockerfile .
# =============================================================================

FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy workspace config and package files
COPY package.json package-lock.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY db/package.json ./db/
COPY services/ai-worker/package.json ./services/ai-worker/

# Install all dependencies
RUN npm ci

# Build stage
FROM base AS builder
WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared-types/node_modules ./packages/shared-types/node_modules
COPY --from=deps /app/db/node_modules ./db/node_modules
COPY --from=deps /app/services/ai-worker/node_modules ./services/ai-worker/node_modules

# Copy source code
COPY tsconfig.base.json ./
COPY packages/shared-types ./packages/shared-types
COPY db ./db
COPY services/ai-worker ./services/ai-worker

# Build all packages
RUN npm run build --workspace=packages/shared-types
RUN npm run build --workspace=db
RUN npm run build --workspace=services/ai-worker

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser

# Copy built files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/shared-types/package.json ./packages/shared-types/
COPY --from=builder /app/db/dist ./db/dist
COPY --from=builder /app/db/package.json ./db/
COPY --from=builder /app/services/ai-worker/dist ./services/ai-worker/dist
COPY --from=builder /app/services/ai-worker/package.json ./services/ai-worker/

USER appuser

CMD ["node", "services/ai-worker/dist/index.js"]
