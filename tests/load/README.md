# Load Testing (k6)

## Prerequisites

Install k6: https://k6.io/docs/getting-started/installation/

```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D68
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

## Running Tests

```bash
# Smoke test (quick validation, 5 VUs)
k6 run tests/load/k6-smoke.js

# Stress test (find breaking point, up to 200 VUs)
k6 run tests/load/k6-stress.js

# Soak test (30min stability check, 20 VUs)
k6 run tests/load/k6-soak.js

# Custom base URL
k6 run -e BASE_URL=https://staging.pos-54link.com tests/load/k6-smoke.js
```

## Thresholds

| Test | p95 Latency | Error Rate |
|------|------------|-----------|
| Smoke | < 500ms | < 10% |
| Stress | < 2000ms | < 30% |
| Soak | < 1000ms | < 5% |

## CI Integration

The smoke test runs in CI on every PR. Stress and soak tests run on `main` branch merges only.
