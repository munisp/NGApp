FROM rust:1.77-alpine AS builder
RUN apk add --no-cache musl-dev
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src/ ./src/
RUN cargo build --release

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=builder /app/target/release/performance-gateway .
EXPOSE 8114
ENV PORT=8114
HEALTHCHECK --interval=30s CMD wget -qO- http://localhost:8114/health || exit 1
CMD ["./performance-gateway"]
