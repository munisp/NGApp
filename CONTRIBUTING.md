# Contributing to 54Link Agent Banking Platform

Thank you for your interest in contributing to the 54Link Agent Banking Platform. This document provides guidelines and best practices for development.

## Table of Contents

1. [Development Environment Setup](#development-environment-setup)
2. [Project Architecture](#project-architecture)
3. [Code Standards](#code-standards)
4. [Git Workflow](#git-workflow)
5. [Testing Requirements](#testing-requirements)
6. [Security Guidelines](#security-guidelines)
7. [Deployment Process](#deployment-process)

## Development Environment Setup

### Prerequisites

- Node.js 22+ (LTS)
- pnpm 9+
- PostgreSQL 16+
- Redis 7+
- Docker & Docker Compose (for full-stack local development)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/54link/agent-banking-platform.git
cd agent-banking-platform

# Install dependencies
pnpm install

# Start infrastructure services
docker compose up -d postgres redis

# Push database schema
pnpm db:push

# Seed development data
node scripts/seed-comprehensive.mjs

# Start development server
pnpm dev
```

### Environment Variables

All environment variables are managed through the platform's secret management system. Never commit `.env` files. Required variables are documented in `server/_core/env.ts`.

## Project Architecture

```
├── client/                 # React 19 + Tailwind 4 frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components (shadcn/ui)
│   │   ├── contexts/       # React contexts (Theme, Notification)
│   │   ├── hooks/          # Custom hooks (useSocket, useOfflineSync)
│   │   ├── lib/            # Utilities (trpc client, roleNavConfig)
│   │   ├── pages/          # Page-level components (93+ pages)
│   │   ├── store/          # Zustand state management
│   │   └── App.tsx         # Route definitions
│   └── public/             # Static assets (favicon only)
├── server/                 # Express 4 + tRPC 11 backend
│   ├── _core/              # Framework plumbing (DO NOT EDIT)
│   ├── lib/                # Business logic modules
│   ├── routers/            # tRPC routers (68+ routers)
│   ├── routers.ts          # Main appRouter composition
│   └── *.test.ts           # Vitest test files
├── drizzle/                # Database schema & migrations
├── shared/                 # Shared types & constants
├── scripts/                # Utility scripts (seed, smoke test, security audit)
├── infra/                  # Infrastructure configs (nginx, logrotate)
├── k8s/                    # Kubernetes deployment manifests
├── .github/workflows/      # CI/CD pipelines
└── docker-compose.yml      # Full-stack Docker setup
```

### Key Conventions

- **tRPC-first**: All API communication uses tRPC procedures. Never use raw fetch/axios.
- **Drizzle ORM**: All database access goes through Drizzle. Never write raw SQL.
- **Zustand**: Client-side state management for POS terminal state.
- **Socket.IO**: Real-time features (fraud alerts, chat, terminal heartbeat).
- **shadcn/ui**: All UI components use shadcn/ui primitives.

## Code Standards

### TypeScript

- Strict mode enabled (`strict: true` in tsconfig)
- Zero TypeScript errors required before merge
- Use explicit return types on exported functions
- Prefer `interface` over `type` for object shapes
- Use `z.infer<typeof schema>` for tRPC input types

### File Naming

- Pages: `PascalCase.tsx` (e.g., `AgentPerformanceScoring.tsx`)
- Components: `PascalCase.tsx` (e.g., `DashboardLayout.tsx`)
- Routers: `camelCase.ts` (e.g., `sprint23Router.ts`)
- Lib modules: `camelCase.ts` (e.g., `sprint23Features.ts`)
- Tests: `*.test.ts` (e.g., `sprint23.test.ts`)

### Router Guidelines

- Keep router files under 150 lines; split into `server/routers/<feature>.ts`
- Use `protectedProcedure` for authenticated endpoints
- Use `publicProcedure` only for health checks and public data
- Always validate inputs with Zod schemas
- Return typed responses (never `any`)

### Frontend Guidelines

- Use `DashboardLayout` wrapper for all admin/dashboard pages
- Handle loading, error, and empty states in every page
- Use `trpc.*.useQuery` for reads, `trpc.*.useMutation` for writes
- Invalidate queries on mutation success
- Use `toast` from sonner for user feedback

## Git Workflow

### Branch Naming

```
feature/sprint-XX-feature-name
fix/issue-description
hotfix/critical-fix
```

### Commit Messages

Follow conventional commits:

```
feat(sprint23): add agent performance scoring dashboard
fix(auth): resolve JWT expiry race condition
test(sprint23): add 16 vitest tests for new features
docs: update CONTRIBUTING.md with deployment process
infra: add nginx reverse proxy configuration
```

### Pull Request Requirements

1. Zero TypeScript errors (`npx tsc --noEmit`)
2. All existing tests pass (`pnpm test`)
3. New features include vitest tests
4. Security audit passes (`node scripts/security-audit.mjs`)
5. Smoke tests pass (`node scripts/smoke-test.mjs`)

## Testing Requirements

### Unit Tests (Vitest)

- All new tRPC routers must have corresponding test files
- Test both success and error paths
- Mock external dependencies (DB, Redis, SMS providers)
- Minimum 80% code coverage for new features

```bash
# Run all tests
pnpm test

# Run specific test file
npx vitest run server/sprint23.test.ts

# Run with coverage
npx vitest run --coverage
```

### E2E Tests (Playwright)

- Critical user flows must have E2E coverage
- Tests run in CI via GitHub Actions
- Use page object pattern for maintainability

### Smoke Tests

- All new API endpoints must be added to `scripts/smoke-test.mjs`
- Smoke tests verify endpoint reachability and basic response shape

## Security Guidelines

### Mandatory Practices

1. **Input Sanitization**: All user inputs sanitized via middleware
2. **SQL Injection**: Use Drizzle ORM parameterized queries only
3. **XSS Prevention**: Never use `dangerouslySetInnerHTML`
4. **CSRF Protection**: Double-submit cookie pattern enabled
5. **Rate Limiting**: Per-endpoint rate limits configured
6. **Authentication**: JWT with httpOnly, secure, sameSite cookies
7. **Authorization**: Role-based access control on all procedures
8. **Secrets**: Never hardcode secrets; use environment variables
9. **Logging**: Structured security logging with data masking
10. **Account Lockout**: 5 failed attempts triggers 15-minute lockout

### Security Audit

Run the security audit before every release:

```bash
node scripts/security-audit.mjs
```

Target score: **100/100 EXCELLENT**

## Deployment Process

### Pre-Deployment Checklist

1. All tests passing (unit + E2E + smoke)
2. Security audit score 100/100
3. TypeScript compilation clean
4. Database migrations applied
5. Environment variables configured
6. Docker images built and tested

### Docker Deployment

```bash
# Build production image
docker compose -f docker-compose.yml build

# Deploy with zero-downtime
docker compose up -d --remove-orphans
```

### Kubernetes Deployment

```bash
# Apply manifests
kubectl apply -f k8s/

# Verify rollout
kubectl rollout status deployment/54link-agent-banking
```

### Database Backup

```bash
# Manual backup
node scripts/db-backup.mjs

# Automated: runs daily at 02:00 WAT via cron
```

## CBN Regulatory Compliance

All features must comply with Central Bank of Nigeria (CBN) regulations:

- Transaction limits per CBN circular
- KYC tiering (Tier 1: ₦50,000/day, Tier 2: ₦200,000/day, Tier 3: ₦5,000,000/day)
- Monthly Activity Reports (MAR)
- Quarterly Fraud Reports
- Suspicious Activity Reports (SAR)
- NDPR/GDPR data protection compliance

## Questions?

Contact the development team at engineering@54link.com or open an issue on GitHub.
