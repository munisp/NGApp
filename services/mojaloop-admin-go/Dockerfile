FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o mojaloop-admin-go .
FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/mojaloop-admin-go /usr/local/bin/
EXPOSE 8269
CMD ["mojaloop-admin-go"]
