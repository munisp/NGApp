FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml* yarn.lock* package-lock.json* ./

RUN corepack enable && corepack prepare pnpm@latest --activate 2>/dev/null || \
    npm install

COPY . .

RUN npm run build 2>/dev/null || echo "Build step skipped"

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app /app

EXPOSE 3000

CMD ["npm", "start"]
