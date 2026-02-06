FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY merchant.go .
RUN go build -o merchant merchant.go

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/merchant .
EXPOSE 8117
CMD ["./merchant"]
