FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY africanmarkets.go .
RUN go build -o africanmarkets africanmarkets.go

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/africanmarkets .
EXPOSE 8118
CMD ["./africanmarkets"]
