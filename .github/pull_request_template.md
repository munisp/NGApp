## Summary

<!-- Brief description of what this PR changes -->

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update
- [ ] Refactor / code quality

## Checklist

- [ ] `pnpm test` passes (Vitest: 11/11)
- [ ] `npx tsc --noEmit` shows 0 errors
- [ ] New tRPC procedures have input validation (Zod)
- [ ] DB schema changes have a migration (`pnpm db:push`)
- [ ] New pages are registered in `App.tsx` and `DashboardLayout.tsx`
- [ ] No `console.log` stubs left in production paths
- [ ] No mock data used as primary data source (only as fallback when DB is empty)
- [ ] Sensitive operations use `protectedProcedure` or `adminProcedure`

## Testing

<!-- Describe how you tested this change -->

## Screenshots (if UI change)

<!-- Add before/after screenshots if applicable -->
