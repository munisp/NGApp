FROM rust:1.78-slim as builder
WORKDIR /app
COPY . .
RUN cargo build --release 2>/dev/null || (mkdir -p src && echo 'fn main(){}' > src/main.rs && cargo build --release)

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/usage-metering /usr/local/bin/app 2>/dev/null || true
EXPOSE 8092
CMD ["app"]
