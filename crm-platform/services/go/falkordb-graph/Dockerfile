FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download 2>/dev/null || true
COPY . .
RUN CGO_ENABLED=0 go build -o /app/service ./cmd/... 2>/dev/null || CGO_ENABLED=0 go build -o /app/service .

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/service /usr/local/bin/service
EXPOSE 8080
CMD ["service"]
