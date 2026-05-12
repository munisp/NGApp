FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN go build -o account-closure .
FROM alpine:3.19
COPY --from=builder /app/account-closure /usr/local/bin/
CMD ["account-closure"]
