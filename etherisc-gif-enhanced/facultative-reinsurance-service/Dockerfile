# Use the official Golang image as the base image
FROM golang:1.18-alpine AS builder

# Set the Current Working Directory inside the container
WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download all dependencies. Dependencies will be cached if the go.mod and go.sum files are not changed
RUN go mod download

# Copy the source code into the container
COPY . .

# Build the Go application
RUN go build -o /facultative-reinsurance-service ./cmd/main.go

# Start a new stage from scratch
FROM alpine:latest

# Install ca-certificates for HTTPS connections
RUN apk --no-cache add ca-certificates

# Set the Current Working Directory inside the container
WORKDIR /root/

# Copy the pre-built binary file from the previous stage
COPY --from=builder /facultative-reinsurance-service .

# Expose the port the application runs on
EXPOSE 8080
EXPOSE 9090

# Command to run the executable
CMD ["./facultative-reinsurance-service"]
