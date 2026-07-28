# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download all dependencies
RUN go mod download

# Copy the source code
COPY . .

# Build the application
RUN go build -o /openimis-policy-integration ./cmd/server

# Final stage
FROM alpine:latest

WORKDIR /root/

# Install ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates

# Copy the built executable from the builder stage
COPY --from=builder /openimis-policy-integration .
COPY --from=builder /app/configs/config.yaml ./configs/config.yaml

# Expose the port the application runs on
EXPOSE 8080

# Command to run the executable
CMD ["./openimis-policy-integration"]
