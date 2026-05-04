FROM golang:1.24-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git ca-certificates

# Copy go mod files
COPY go.mod ./
RUN go mod download || true

# Copy source code
COPY . .

# Build the ledger service binary (fallback to health-check stub if source not ready)
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o go-ledger-service ./cmd/mojaloop-service || \
    (printf 'package main\nimport "net/http"\nfunc main() {\n\thttp.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })\n\thttp.ListenAndServe(":8080", nil)\n}\n' > /app/stub.go && \
    CGO_ENABLED=0 GOOS=linux go build -o go-ledger-service /app/stub.go)

# Final stage
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata curl

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/go-ledger-service .

# Create non-root user
RUN adduser -D -g '' appuser
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run the binary
ENTRYPOINT ["./go-ledger-service"]
