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
RUN go build -o /reinsurer-api ./cmd/reinsurer-api

# Final stage
FROM alpine:latest

# Install ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy the built executable and config file
COPY --from=builder /reinsurer-api .
COPY --from=builder /app/configs/config.yaml ./configs/config.yaml

# Expose the port the app runs on
EXPOSE 8080

# Command to run the executable
CMD ["./reinsurer-api"]
