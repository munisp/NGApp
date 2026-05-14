# Contributing to CRM Platform

## Development Setup

```bash
# Clone and install
git clone https://github.com/munisp/NGApp.git
cd NGApp/crm-platform/web
npm install

# Start dev server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Project Structure

```
crm-platform/
├── web/                    # React frontend (Vite + Tailwind v4)
│   ├── src/
│   │   ├── components/     # 125 JSX components
│   │   ├── contexts/       # Auth, Tenant, Notification, Theme
│   │   ├── hooks/          # useApiData, etc.
│   │   ├── services/       # API adapters
│   │   ├── lib/            # i18n, apiClient, utils
│   │   └── __tests__/      # Vitest test suites
│   └── public/             # Static assets, PWA manifest
├── services/
│   ├── go/                 # Go microservices (8 services)
│   ├── python/             # Python services (15 services)
│   └── rust/               # Rust services (8 services)
├── deploy/
│   ├── docker/             # Dockerfiles
│   ├── helm/               # Helm charts
│   ├── monitoring/         # Grafana, Prometheus, OTel
│   └── apisix/             # API gateway config
├── k8s/                    # Kubernetes manifests
└── docs/                   # Documentation
```

## Code Conventions

### Frontend
- **React functional components** with hooks (no class components)
- **Tailwind CSS v4** for styling — use `dark:` variants for dark mode
- **lucide-react** for icons
- **framer-motion** for animations
- **useApiData** hook for data fetching with fallback pattern
- All components must support dark mode and have ARIA attributes

### Backend
- **Go**: Standard library + Gin framework, table-driven tests
- **Rust**: Actix-web, integration tests
- **Python**: FastAPI, pytest

### Git
- Feature branches from `main`
- Conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`
- PR required for all changes — CI must pass
- No force push to main

## Testing

```bash
# Frontend unit tests
cd crm-platform/web && npx vitest run

# Go tests
cd crm-platform/services/go/crm-services && go test ./...

# Python tests
cd crm-platform/services/python/analytics-engine && pytest

# E2E tests
cd crm-platform/web && npx playwright test
```

## Multi-Tenant Architecture

- 10 tenant profiles with product-gated features
- 4 verticals: Banking, Telco, Commodity, CPaaS
- 21 product modules controlling sidebar visibility
- All components receive tenant context via `useTenant()` hook
