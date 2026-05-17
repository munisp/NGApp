# Stage 1: Build the Go application
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download all dependencies
RUN go mod download

# Copy the source code
COPY . .

# Build the application
# CGO_ENABLED=0 is important for static linking, which is good for small, portable containers
RUN CGO_ENABLED=0 go build -ldflags "-s -w" -o /metrics-exporter-service ./main.go

# Stage 2: Create the final minimal image
FROM alpine:latest

# Install ca-certificates for HTTPS connections
RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy the built executable from the builder stage
COPY --from=builder /metrics-exporter-service .

# Copy the default configuration file
COPY --from=builder /app/config/config.yaml ./config/config.yaml

# Expose the port defined in the default config (9100)
EXPOSE 9100

# Run the executable
CMD ["./metrics-exporter-service"]
