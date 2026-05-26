# Multi-stage build for Go protocol-adapter
FROM golang:1.22-alpine AS builder
WORKDIR /build
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /protocol-adapter ./cmd/...

FROM gcr.io/distroless/static-debian12
COPY --from=builder /protocol-adapter /protocol-adapter
EXPOSE 8090
ENTRYPOINT ["/protocol-adapter"]
