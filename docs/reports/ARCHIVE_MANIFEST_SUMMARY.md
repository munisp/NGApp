# Archive Manifest Summary

This file tracks all components that MUST be present in every production archive.
**Generated automatically — commit this file after adding new components.**

## How to Verify an Archive

```bash
# 1. Generate expected manifest
bash scripts/generate-archive-manifest.sh

# 2. List archive contents
tar tzf archive.tar.gz | sed 's|^\./||' | sed 's|/.*|/|' | sort -u > /tmp/archive-dirs.txt

# 3. Compare
diff <(grep -v '^#' ARCHIVE_MANIFEST.txt | grep '/$' | sed 's| #.*||; s|^\./||' | sort -u) /tmp/archive-dirs.txt
```

## Required Components

| Component | Files | Size | Critical? |
|-----------|-------|------|-----------|
| `.github/` | 6 | 64K | Yes |
| `.manus/` | 33 | 156K | Yes |
| `admin-dashboard/` | 29944 | 665M | Yes |
| `client/` | 160 | 2.4M | Yes |
| `compliance/` | 3 | 48K | Yes |
| `config/` | 8 | 80K | Yes |
| `deploy/` | 15 | 152K | Yes |
| `dist/` | 153 | 5.3M | No (rebuildable) |
| `docs/` | 95 | 1.4M | Yes |
| `drizzle/` | 84 | 3.9M | Yes |
| `infra/` | 1 | 12K | Yes |
| `k8s/` | 13 | 120K | Yes |
| `kubernetes/` | 3 | 24K | Yes |
| `load-testing/` | 6 | 48K | Yes |
| `load-tests/` | 6 | 76K | Yes |
| `middleware/` | 14 | 200K | Yes |
| `mobile/` | 23 | 216K | Yes |
| `mobile-app/` | 6 | 68K | Yes |
| `monitoring/` | 11 | 108K | Yes |
| `nginx/` | 3 | 28K | Yes |
| `node_modules/` | 62683 | 709M | No (rebuildable) |
| `orchestrator/` | 36 | 608K | Yes |
| `patches/` | 1 | 8.0K | Yes |
| `payment-core/` | 3545 | 810M | Yes |
| `payment-switch/` | 94981 | 1.7G | Yes |
| `public/` | 1 | 16K | Yes |
| `scripts/` | 6 | 56K | Yes |
| `sdks/` | 19 | 208K | Yes |
| `security/` | 1 | 20K | Yes |
| `server/` | 147 | 1.9M | Yes |
| `shared/` | 3 | 20K | Yes |
| `tests/` | 1 | 12K | Yes |

## Root Files

- `.env` (4.0K)
- `.env.example` (8.0K)
- `.env.staging.example` (4.0K)
- `.gitignore` (4.0K)
- `.gitkeep` (0)
- `.prettierignore` (4.0K)
- `.prettierrc` (4.0K)
- `ARCHIVE_MANIFEST.txt` (4.0K)
- `ARCHIVE_MANIFEST_SUMMARY.md` (4.0K)
- `CODE_EXAMPLES.md` (16K)
- `COMPREHENSIVE_AUDIT_REPORT.md` (12K)
- `COMPREHENSIVE_PROGRESS_REPORT.md` (20K)
- `CRITICAL_TASKS_REMAINING.md` (16K)
- `CRITICAL_TASKS_REMAINING_UPDATED.md` (16K)
- `DEPLOYMENT.md` (8.0K)
- `DEPLOYMENT_AUDIT_REPORT.md` (8.0K)
- `Dockerfile` (4.0K)
- `FINAL_IMPLEMENTATION_SUMMARY.md` (16K)
- `MERCHANT_DOCUMENTATION.md` (12K)
- `MISSING_FEATURES_ANALYSIS.md` (12K)
- `PROJECT_SUMMARY.md` (16K)
- `QUICK_START.md` (12K)
- `README.md` (16K)
- `README_UNIFIED.md` (16K)
- `VERIFICATION_CHECKLIST.md` (12K)
- `apply_migration.mjs` (4.0K)
- `check_users.mjs` (4.0K)
- `components.json` (4.0K)
- `docker-compose.dev.yaml` (8.0K)
- `docker-compose.middleware.yml` (20K)
- `docker-compose.staging.yml` (8.0K)
- `docker-compose.unified.yml` (20K)
- `docker-compose.yml` (8.0K)
- `docker-swarm-stack.yml` (8.0K)
- `drizzle.config.ts` (4.0K)
- `init-templates.mjs` (4.0K)
- `outbound-participant-dashboard.png` (72K)
- `outbound-remittance-submitted.png` (48K)
- `package.json` (8.0K)
- `pnpm-lock.yaml` (452K)
- `screenshot-cbn-fx-rates.png` (184K)
- `screenshot-corridor-routing.png` (168K)
- `screenshot-dfsp-registry.png` (160K)
- `screenshot-fee-calculator.png` (104K)
- `screenshot-payment-rails-status.png` (212K)
- `screenshot-rails-crud.png` (212K)
- `todo.md` (104K)
- `tsconfig.json` (4.0K)
- `vite.config.ts` (4.0K)
- `vitest.config.ts` (4.0K)

**Total: 192061 files, 3.8G**
