FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY corebanking.go .
RUN go build -o corebanking corebanking.go

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/corebanking .
EXPOSE 8113
CMD ["./corebanking"]
