# =============================================================================
# Dockerfile for incident-engine service (Kafka consumer → PostgreSQL)
# Build from project root: docker build -f services/incident-engine/Dockerfile .
# =============================================================================

FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy workspace config and package files
COPY package.json package-lock.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY db/package.json ./db/
COPY services/incident-engine/package.json ./services/incident-engine/

# Install all dependencies
RUN npm ci

# Build stage
FROM base AS builder
WORKDIR /app

# Copy node_modules and package files from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json /app/package-lock.json ./

# Copy source code
COPY tsconfig.base.json ./
COPY packages/shared-types ./packages/shared-types
COPY db ./db
COPY services/incident-engine ./services/incident-engine

# Build all packages
RUN npm run build --workspace=packages/shared-types
RUN npm run build --workspace=db
RUN npm run build --workspace=services/incident-engine

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
COPY --from=builder /app/services/incident-engine/dist ./services/incident-engine/dist
COPY --from=builder /app/services/incident-engine/package.json ./services/incident-engine/

USER appuser

CMD ["node", "services/incident-engine/dist/index.js"]
