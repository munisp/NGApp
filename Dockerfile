# 54Bank Core Banking Platform — Production Dockerfile
# Multi-stage build: Build client + server, then run in minimal image

FROM node:22-slim AS builder
WORKDIR /app

COPY package.json pnpm-lock.yaml patches/ ./patches/
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
RUN pnpm install

COPY . .
RUN pnpm run build

FROM node:22-slim AS production
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/drizzle ./drizzle

EXPOSE 3000
CMD ["node", "dist/index.js"]
