# Router Patterns — 54Link POS Platform

## CRUD Router

Standard pattern for entity management routers:

- `list` — paginated query with filters
- `getById` — single entity lookup
- `create` — input validated with Zod schema
- `update` — partial update with validation
- `delete` — soft delete with audit trail

All CRUD routers use `protectedProcedure` with Permify authorization.

## Transaction Processing

Pattern for financial transaction handlers:

- Validate input against CBN limits
- Check agent float sufficiency
- Create transaction record in PostgreSQL
- Post double-entry to TigerBeetle
- Calculate commission and update agent balance
- Emit Kafka event for downstream processing
- Return transaction ref and receipt data

## Fraud Scoring

Pattern for real-time fraud detection:

- Extract transaction features (amount, frequency, location, time)
- Call ML scoring endpoint (Python microservice)
- If score > threshold → flag for review
- Emit alert event to Kafka
- Update fraud_alerts table
- Return score in transaction response

## MDM Device Heartbeat

Pattern for device health monitoring:

- Accept heartbeat from POS terminal (publicProcedure)
- Update device lastSeenAt and status
- Check for pending commands
- Return command queue to device

## Admin Guard

Pattern for admin-only procedures:

```typescript
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx });
});
```
