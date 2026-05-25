# Multi-stage build for customer portal

# Stage 1: Build frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build frontend
RUN pnpm build

# Stage 2: Build backend
FROM node:22-alpine AS backend-builder
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile --prod

# Stage 3: Production image
FROM node:22-alpine
WORKDIR /app

# Install production dependencies
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Copy built frontend from frontend-builder
COPY --from=frontend-builder /app/dist ./dist

# Copy server code
COPY server ./server
COPY shared ./shared
COPY drizzle ./drizzle

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "server/_core/index.js"]
