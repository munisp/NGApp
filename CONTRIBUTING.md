# Contributing to 54Bank Platform

Thank you for contributing to the 54Bank Core Banking Platform.

## Development Setup

```bash
pnpm install
pnpm dev
```

## Branch Naming

- `feat/<description>` — New features
- `fix/<description>` — Bug fixes
- `chore/<description>` — Maintenance

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat(scope): description` — New feature
- `fix(scope): description` — Bug fix
- `docs(scope): description` — Documentation
- `test(scope): description` — Tests
- `chore(scope): description` — Maintenance

## Code Standards

- **TypeScript**: Strict mode, no `any`
- **Go**: `gofmt`, `golint`, `go vet`
- **Rust**: `cargo fmt`, `cargo clippy`
- **Python**: `ruff`, type hints required

## Testing

```bash
pnpm test          # Unit tests (vitest)
pnpm run check     # TypeScript type checking
```

## Pull Requests

1. Create a feature branch from `main`
2. Make focused, minimal changes
3. Ensure all CI checks pass (7/7)
4. Request review from a maintainer

## Architecture

- **219 polyglot microservices** (Go, Rust, Python)
- **14-middleware integration** per service
- **Express** API gateway with seed data + Drizzle ORM
- **PWA** (React) + **Flutter** mobile clients

## Questions?

Open an issue or contact the platform team.
