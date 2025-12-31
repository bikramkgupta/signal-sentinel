# =============================================================================
# Dockerfile for indexer service (Kafka consumer → OpenSearch)
# Build from project root: docker build -f services/indexer/Dockerfile .
# =============================================================================

FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy workspace config and package files
COPY package.json package-lock.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY db/package.json ./db/
COPY services/indexer/package.json ./services/indexer/

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
COPY services/indexer ./services/indexer

# Build all packages
RUN npm run build --workspace=packages/shared-types
RUN npm run build --workspace=db
RUN npm run build --workspace=services/indexer

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
COPY --from=builder /app/services/indexer/dist ./services/indexer/dist
COPY --from=builder /app/services/indexer/package.json ./services/indexer/

USER appuser

CMD ["node", "services/indexer/dist/index.js"]
