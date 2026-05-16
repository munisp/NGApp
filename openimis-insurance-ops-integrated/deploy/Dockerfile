# Stage 1: Build the Go application
FROM golang:1.22.5-alpine AS builder

WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download all dependencies
RUN go mod download

# Copy the source code
COPY . .

# Build the application
# CGO_ENABLED=0 is important for static linking, which is good for small, secure containers
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /sync-worker ./cmd/main.go

# Stage 2: Create the final minimal image
FROM alpine:latest

# Install necessary packages (e.g., for SSL certificates)
RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy the compiled binary from the builder stage
COPY --from=builder /sync-worker .
COPY config.yaml .

# Expose the metrics port
EXPOSE 8080

# Run the binary
CMD ["./sync-worker"]
