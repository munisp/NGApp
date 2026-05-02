# Multi-stage Dockerfile for Payment Switch Crypto Remittance

# Stage 1: Build frontend
FROM node:22-alpine AS frontend-builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY client/package.json ./client/

# Install pnpm and dependencies
RUN npm install -g pnpm@latest
RUN pnpm install --frozen-lockfile

# Copy frontend source
COPY client ./client
COPY shared ./shared

# Build frontend
RUN pnpm --filter client build

# Stage 2: Build backend
FROM node:22-alpine AS backend-builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY server/package.json ./server/

# Install pnpm and dependencies
RUN npm install -g pnpm@latest
RUN pnpm install --frozen-lockfile --prod

# Copy backend source
COPY server ./server
COPY shared ./shared
COPY drizzle ./drizzle

# Build backend (TypeScript compilation)
RUN pnpm --filter server build

# Stage 3: Production image
FROM node:22-alpine

WORKDIR /app

# Install production dependencies only
RUN npm install -g pnpm@latest

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy built frontend from frontend-builder
COPY --from=frontend-builder /app/client/dist ./client/dist

# Copy built backend from backend-builder
COPY --from=backend-builder /app/server/dist ./server/dist
COPY --from=backend-builder /app/drizzle ./drizzle

# Copy shared code
COPY shared ./shared

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start application
CMD ["node", "server/dist/index.js"]
