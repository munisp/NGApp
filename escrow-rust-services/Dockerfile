# Multi-stage Dockerfile for EscrowProtect Rust Services
# Builds both webhook-dispatcher and event-ingestion services

FROM rust:1.75-bookworm AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    cmake \
    libssl-dev \
    libsasl2-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
COPY common/Cargo.toml ./common/
COPY webhook-dispatcher/Cargo.toml ./webhook-dispatcher/
COPY event-ingestion/Cargo.toml ./event-ingestion/

RUN mkdir -p common/src webhook-dispatcher/src event-ingestion/src && \
    echo "pub fn dummy() {}" > common/src/lib.rs && \
    echo "fn main() {}" > webhook-dispatcher/src/main.rs && \
    echo "fn main() {}" > event-ingestion/src/main.rs

RUN cargo build --release 2>/dev/null || true

COPY common/src ./common/src
COPY webhook-dispatcher/src ./webhook-dispatcher/src
COPY event-ingestion/src ./event-ingestion/src

RUN touch common/src/lib.rs webhook-dispatcher/src/main.rs event-ingestion/src/main.rs

RUN cargo build --release --bin webhook-dispatcher --bin event-ingestion


FROM debian:bookworm-slim AS webhook-dispatcher

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    libsasl2-2 \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -r -u 1000 -g root escrow

COPY --from=builder /app/target/release/webhook-dispatcher /usr/local/bin/

USER escrow

EXPOSE 8080

ENV RUST_LOG=info
ENV ESCROW__HOST=0.0.0.0
ENV ESCROW__PORT=8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

CMD ["webhook-dispatcher"]


FROM debian:bookworm-slim AS event-ingestion

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    libsasl2-2 \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -r -u 1000 -g root escrow

COPY --from=builder /app/target/release/event-ingestion /usr/local/bin/

USER escrow

EXPOSE 8080

ENV RUST_LOG=info
ENV ESCROW__HOST=0.0.0.0
ENV ESCROW__PORT=8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

CMD ["event-ingestion"]
