FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o postgres-query-optimizer-go .
FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/postgres-query-optimizer-go /usr/local/bin/
EXPOSE 8272
CMD ["postgres-query-optimizer-go"]
