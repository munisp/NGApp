FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod .
COPY main.go .
RUN go build -o service main.go

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/service .
CMD ["./service"]
