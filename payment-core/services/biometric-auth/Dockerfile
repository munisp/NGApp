FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /biometric-auth .

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=builder /biometric-auth .
EXPOSE 50052 8082
HEALTHCHECK --interval=15s --timeout=5s --retries=3 CMD wget -qO- http://localhost:8082/health || exit 1
ENTRYPOINT ["./biometric-auth"]
