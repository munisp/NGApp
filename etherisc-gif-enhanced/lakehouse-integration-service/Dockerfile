# Use the official Golang image as the base image
FROM golang:1.21-alpine AS builder

# Set the Current Working Directory inside the container
WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download all dependencies. Dependencies will be cached if the go.mod and go.sum files are not changed
RUN go mod download

# Copy the source code into the container
COPY . .

# Build the Go app
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o lakehouse-integration-service ./cmd/lakehouse-integration-service/main.go

# Use a minimal image for the final stage
FROM alpine:latest

# Install ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates

# Set the Current Working Directory inside the container
WORKDIR /root/

# Copy the built executable from the builder stage
COPY --from=builder /app/lakehouse-integration-service .
COPY --from=builder /app/config.yaml .

# Expose the port the app runs on
EXPOSE 8080

# Command to run the executable
CMD ["./lakehouse-integration-service"]
