FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY . .
RUN CGO_ENABLED=0 go build -o apisix-gateway-go .
FROM alpine:3.19
COPY --from=builder /app/apisix-gateway-go /usr/local/bin/
EXPOSE 8275
CMD ["apisix-gateway-go"]
