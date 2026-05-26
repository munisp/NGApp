# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM rust:1.82-slim AS builder

WORKDIR /app

# Install system dependencies for OpenSSL
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Cache dependencies
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release 2>/dev/null || true
RUN rm -f src/main.rs

# Build the actual application
COPY src/ ./src/
RUN cargo build --release

# ─── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM debian:bookworm-slim AS runtime

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Copy the compiled binary
COPY --from=builder /app/target/release/physics-engine /app/physics-engine

# Non-root user for security
RUN useradd -r -s /bin/false appuser && chown appuser:appuser /app/physics-engine
USER appuser

EXPOSE 8000

ENV RUST_LOG=info
ENV PHYSICS_ENGINE_HOST=0.0.0.0
ENV PHYSICS_ENGINE_PORT=8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["/app/physics-engine"]
