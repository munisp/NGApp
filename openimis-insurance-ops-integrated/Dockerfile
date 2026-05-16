# Build stage
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download all dependencies
RUN go mod download

# Copy the source code
COPY . .

# Build the worker and api binaries
RUN go build -o /usr/local/bin/worker ./cmd/worker
RUN go build -o /usr/local/bin/api ./cmd/api

# Final stage
FROM alpine:latest

# Install ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy binaries and config
COPY --from=builder /usr/local/bin/worker /usr/local/bin/worker
COPY --from=builder /usr/local/bin/api /usr/local/bin/api
COPY --from=builder /app/config/config.yaml /root/config.yaml

# Expose ports (8080 for API, 9090 for metrics)
EXPOSE 8080
EXPOSE 9090

# Default command (can be overridden in Kubernetes)
CMD ["/usr/local/bin/worker"]
