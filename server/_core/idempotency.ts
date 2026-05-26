/**
 * Idempotency key middleware for mutation endpoints.
 * Prevents duplicate operations on network retries.
 *
 * Usage: Clients send `X-Idempotency-Key: <uuid>` header on POST/PUT/PATCH.
 * If the key was seen before and completed, returns the cached response.
 */
import type { Request, Response, NextFunction } from "express";
import { getDb } from "../db";
import { idempotencyKeys } from "../../drizzle/schema";
import { eq, and, gt } from "drizzle-orm";
import logger from "./logger";

const IDEMPOTENCY_HEADER = "x-idempotency-key";

export async function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Only check idempotency on mutation methods
  if (!["POST", "PUT", "PATCH"].includes(req.method)) {
    next();
    return;
  }

  const key = req.headers[IDEMPOTENCY_HEADER] as string | undefined;
  if (!key) {
    next();
    return;
  }

  const db = await getDb();
  if (!db) {
    next();
    return;
  }

  try {
    const now = new Date();
    const existing = await db
      .select()
      .from(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.key, key),
          gt(idempotencyKeys.expiresAt, now)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const record = existing[0];
      if (record.status === "completed" && record.responseBody) {
        logger.info({ key, route: record.route }, "Idempotent request — returning cached response");
        res.status(record.responseStatus ?? 200);
        res.setHeader("X-Idempotent-Replay", "true");
        res.json(JSON.parse(record.responseBody));
        return;
      }
      if (record.status === "processing") {
        res.status(409).json({ error: "Request with this idempotency key is already being processed" });
        return;
      }
    }

    // Record the key as processing
    const userId = (req as unknown as Record<string, string>).requestId ?? "unknown";
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    await db.insert(idempotencyKeys).values({
      key,
      userId,
      route: req.originalUrl,
      status: "processing",
      expiresAt,
    }).onConflictDoNothing();

    // Intercept the response to cache it
    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      // Fire-and-forget: store the response
      db.update(idempotencyKeys)
        .set({
          status: "completed",
          responseStatus: res.statusCode,
          responseBody: JSON.stringify(body),
        })
        .where(eq(idempotencyKeys.key, key))
        .catch((err) => logger.error({ err, key }, "Failed to cache idempotent response"));
      return originalJson(body);
    };

    next();
  } catch (err) {
    logger.error({ err, key }, "Idempotency check failed");
    next();
  }
}
