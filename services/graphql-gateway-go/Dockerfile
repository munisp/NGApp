FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN go build -o graphql-gateway .
FROM alpine:3.19
COPY --from=builder /app/graphql-gateway /usr/local/bin/
CMD ["graphql-gateway"]
