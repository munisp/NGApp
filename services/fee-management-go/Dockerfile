FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN go build -o fee-management .
FROM alpine:3.19
COPY --from=builder /app/fee-management /usr/local/bin/
CMD ["fee-management"]
