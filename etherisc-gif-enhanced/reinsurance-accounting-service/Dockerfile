# Build stage
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download all dependencies. Dependencies will be cached if the go.mod and go.sum files are not changed
RUN go mod download

# Copy the source code
COPY . .

# Build the application
RUN go build -o /reinsurance-accounting-service ./cmd/main.go

# Final stage
FROM alpine:latest

# Install ca-certificates for HTTPS connections
RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy the compiled executable from the builder stage
COPY --from=builder /reinsurance-accounting-service .

# Expose the application port and metrics port
EXPOSE 8080
EXPOSE 9090

# Run the executable
CMD ["./reinsurance-accounting-service"]
