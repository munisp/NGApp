# Build stage
FROM golang:1.18-alpine AS builder

WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN go build -o /underwriting-producer ./main.go

# Run stage
FROM alpine:latest

# Install necessary packages for confluent-kafka-go (librdkafka dependencies)
RUN apk --no-cache add libc6-compat

WORKDIR /root/

# Copy the built binary and config
COPY --from=builder /underwriting-producer .
COPY underwriting-producer/config/config.yaml ./config/config.yaml

# Expose port (if it were a web service, but it's a producer)
# EXPOSE 8080

# Command to run the executable
CMD ["./underwriting-producer"]
