FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /edgex-device-service ./cmd/main.go

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=builder /edgex-device-service /usr/local/bin/edgex-device-service
EXPOSE 8108
ENTRYPOINT ["edgex-device-service"]
