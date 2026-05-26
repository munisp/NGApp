# ─── Build stage ──────────────────────────────────────────────────────────────
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache gcc musl-dev librdkafka-dev

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=1 GOOS=linux go build -ldflags="-s -w" -o og-rmm-worker .

# ─── Runtime stage ────────────────────────────────────────────────────────────
FROM alpine:3.19

RUN apk add --no-cache librdkafka ca-certificates tzdata

WORKDIR /app
COPY --from=builder /app/og-rmm-worker .

EXPOSE 8090

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:8090/v1/health || exit 1

ENTRYPOINT ["./og-rmm-worker"]
