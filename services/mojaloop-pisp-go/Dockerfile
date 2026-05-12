FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN go build -o mojaloop-pisp .
FROM alpine:3.19
COPY --from=builder /app/mojaloop-pisp /usr/local/bin/
CMD ["mojaloop-pisp"]
