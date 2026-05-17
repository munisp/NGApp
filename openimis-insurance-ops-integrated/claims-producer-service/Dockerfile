# Build Stage
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy go.mod and go.sum to download dependencies
COPY go.mod go.sum ./
# Copy the local avro package and update go.mod to resolve the replace directive
COPY ../pkg/avro /app/pkg/avro
RUN go mod tidy

# Copy the rest of the source code
COPY . .

# Build the application
RUN go build -o /claims-producer-service

# Final Stage
FROM alpine:latest

# Install ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy the built binary from the builder stage
COPY --from=builder /claims-producer-service .

# Expose the port the service runs on
EXPOSE 8080

# Command to run the executable
CMD ["./claims-producer-service"]
