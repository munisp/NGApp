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
RUN go build -o /cession-management-service ./cmd/server

# Final stage
FROM alpine:latest

# Install ca-certificates for secure connections
RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy the built executable from the builder stage
COPY --from=builder /cession-management-service .

# Expose the port the app runs on
EXPOSE 8080

# Run the executable
CMD ["./cession-management-service"]
