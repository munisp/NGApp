# Use a minimal Go image for building
FROM golang:1.21-alpine AS builder

# Set necessary environment variables
ENV CGO_ENABLED=0
ENV GOOS=linux

WORKDIR /app

# Copy go mod and sum files
COPY go.mod .
COPY go.sum .

# Download all dependencies
RUN go mod download

# Copy the source code
COPY . .

# Build the application
RUN go build -ldflags "-s -w" -o /payment-service ./main.go

# Use a minimal image for the final stage
FROM alpine:latest

# Install ca-certificates for HTTPS connections
RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy the compiled application from the builder stage
COPY --from=builder /payment-service .

# Expose the port the application runs on
EXPOSE 8080

# Command to run the executable
CMD ["./payment-service"]
