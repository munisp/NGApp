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
RUN go build -o /openimis-consumer ./main.go

# Run stage
FROM alpine:latest

# Install necessary packages for confluent-kafka-go (librdkafka dependencies)
RUN apk --no-cache add libc6-compat

WORKDIR /root/

# Copy the built binary and config
COPY --from=builder /openimis-consumer .
COPY openimis-consumer/config/config.yaml ./config/config.yaml

# Command to run the executable
CMD ["./openimis-consumer"]
