# Contributing to NGApp CRM Platform

## Quick Start

```bash
# Clone and setup
git clone https://github.com/munisp/NGApp.git
cd NGApp/crm-platform

# Copy environment config
cp .env.example .env
# Edit .env with your credentials

# Start infrastructure
docker compose -f deploy/docker/docker-compose.yml up -d postgres redis kafka

# Frontend
cd web && npm install && npm run dev

# Go services
cd services/go/crm-services && go run ./cmd/main.go

# Python services (example: sales-agent)
cd services/python/sales-agent && pip install -r requirements.txt && python main.py
```

## Project Structure

```
crm-platform/
├── web/                    # React frontend (152 components, Vite)
│   ├── src/components/     # UI components (JSX)
│   ├── src/contexts/       # Auth, Tenant, Theme, Notification
│   ├── src/hooks/          # useApiData, custom hooks
│   ├── src/lib/            # apiClient, i18n, queryClient
│   └── src/__tests__/      # Vitest unit tests
├── services/
│   ├── go/crm-services/    # Go backend (Gin, Postgres, Redis)
│   ├── rust/               # Rust services (9 services)
│   └── python/             # Python services (13 services)
├── middleware/              # 15 middleware configs
├── deploy/
│   ├── docker/             # Docker Compose + Dockerfiles
│   └── grafana/            # Dashboards + alerting
├── k8s/                    # Kubernetes manifests
└── docs/                   # Architecture + OpenAPI
```

## Development Guidelines

### Frontend
- Components use JSX with Tailwind CSS + Lucide React icons
- All components must support dark mode (`dark:` classes)
- Use `useApiData` hook for data fetching (falls back to seed data)
- Use `useTranslation` hook for i18n (5 languages: en, ha, yo, ig, fr)
- Product gating: use `hasProduct()` from TenantContext
- Wrap all routes with `<P permission="...">` for RBAC

### Backend
- **Go**: API services, CRUD handlers, middleware
- **Rust**: High-performance engines (workflow, real-time, vector search)
- **Python**: ML models, analytics pipelines, NLP

### Testing
```bash
# Frontend unit tests
cd web && npx vitest run

# Go tests
cd services/go/crm-services && go test ./...

# Python tests
cd services/python/sales-agent && pytest
```

### Commits
- Use conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`
- Never push directly to `main` — create a feature branch

## Architecture

- **Multi-tenant**: 10 tenants, 21 product modules, 4 verticals (Banking, Telco, Commodity, CPaaS)
- **RBAC**: 123 routes with permission guards via AuthContext
- **Middleware**: Kafka, Dapr, Fluvio, Temporal, Postgres, Keycloak, Permify, Redis, Mojaloop, OpenSearch, OpenAppSec, APISIX, TigerBeetle, Lakehouse, WebSocket
- **Observability**: Prometheus metrics, Grafana dashboards, OTEL tracing
