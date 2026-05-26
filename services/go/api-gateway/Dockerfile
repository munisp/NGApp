FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /api-gateway ./cmd/main.go

FROM alpine:3.19
RUN apk --no-cache add ca-certificates wget tzdata
WORKDIR /app
COPY --from=builder /api-gateway .
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:8000/health || exit 1
CMD ["./api-gateway"]
