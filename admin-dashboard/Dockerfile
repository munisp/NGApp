FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml* yarn.lock* package-lock.json* ./

RUN corepack enable && corepack prepare pnpm@latest --activate 2>/dev/null || \
    npm install

COPY . .

RUN npm run build 2>/dev/null || echo "Build step skipped"

# Production image
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })" || exit 1

CMD ["npm", "start"]
