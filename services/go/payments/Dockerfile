FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY payments.go .
RUN go build -o payments payments.go

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/payments .
EXPOSE 8114
CMD ["./payments"]
