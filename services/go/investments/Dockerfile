FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY investments.go .
RUN go build -o investments investments.go

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/investments .
EXPOSE 8116
CMD ["./investments"]
