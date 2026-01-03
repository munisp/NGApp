# Production Readiness Baseline (PRB) v1

## Overview

This document defines the finite scope of "production ready" for the SocialEscrow platform with objective pass/fail criteria. Every requirement maps to a single verification command.

**How to Run:** `make verify` or `./scripts/verify_prb_v1.sh`

## Scope

**In Scope (Production Code):**
- `escrow-api/app/*.py` - Backend API code
- `helm/escrow-platform/**/*.yaml` - Kubernetes/Helm infrastructure

**Out of Scope:**
- `escrow-api/tests/` - Test files
- `escrow-checkout/` - Frontend demo (separate deployment)
- `escrow-wasm/target/` - Build artifacts
- `*.md` files - Documentation
- `.env*` files - Environment templates

## Environment Assumptions

Required tools:
- `bash` (4.0+)
- `grep` with `-P` (PCRE) support or `rg` (ripgrep)
- `python3` (3.9+)

## Requirements

| ID | Requirement | Verification Command | Pass Criteria |
|----|-------------|---------------------|---------------|
| PRB1.1 | Zero hardcoded credentials in infrastructure YAMLs | `grep -rn "password.*=.*['\"][a-zA-Z0-9]" helm/ --include="*.yaml"` | Exit code 1 (no matches) |
| PRB1.2 | Zero hardcoded API keys/secrets in infrastructure YAMLs | `grep -rn "api[_-]?key.*=.*['\"][a-zA-Z0-9]" helm/ --include="*.yaml"` | Exit code 1 (no matches) |
| PRB2.1 | Zero generateMock* functions in production code | `grep -rn "generateMock" escrow-api/app/` | Exit code 1 (no matches) |
| PRB2.2 | Zero mock data generators in production code | `grep -rn "def.*mock.*data\|create.*mock\|fake.*data" escrow-api/app/` | Exit code 1 (no matches) |
| PRB3.1 | Zero "TODO implement" placeholders | `grep -rn "TODO.*implement" escrow-api/app/` | Exit code 1 (no matches) |
| PRB3.2 | Zero FIXME placeholders | `grep -rn "FIXME" escrow-api/app/` | Exit code 1 (no matches) |
| PRB4.1 | All Python files have valid syntax | `python3 -m py_compile escrow-api/app/*.py` | Exit code 0 |
| PRB5.1 | No Dockerfiles exist OR all Dockerfiles build | Check existence, skip if none | Exit code 0 |
| PRB6.1 | Production mode enforces persistence (no silent in-memory fallback) | Runtime check with PRODUCTION_MODE=true | Fails fast if deps missing |
| PRB6.2 | Zero "POC only" markers in production code paths | `grep -rn "POC only" escrow-api/app/` | Exit code 1 (no matches) |
| PRB6.3 | Zero "development only" markers in production code | `grep -rn "development only" escrow-api/app/` | Exit code 1 (no matches) |
| PRB6.4 | Zero "NOT SUITABLE FOR PRODUCTION" markers | `grep -rn "NOT SUITABLE FOR PRODUCTION" escrow-api/app/` | Exit code 1 (no matches) |

## Pass/Fail Criteria

- **PASS**: All 12 requirements return expected exit codes
- **FAIL**: Any requirement returns unexpected exit code

## Exit Codes

- `0` - All PRB v1 requirements satisfied
- `1` - One or more PRB v1 requirements violated
- `2` - Tooling/environment error (missing dependencies)

## Verification Output Format

```
PRB v1 Verification
===================
PRB1.1 [PASS] Zero hardcoded credentials in YAML
PRB1.2 [PASS] Zero hardcoded API keys in YAML
PRB2.1 [PASS] Zero generateMock functions
...
===================
RESULT: PASS (12/12)
```

Or on failure:
```
PRB3.1 [FAIL] Zero "TODO implement" placeholders
  Matches:
    escrow-api/app/foo.py:123: # TODO implement this
===================
RESULT: FAIL (11/12)
```
