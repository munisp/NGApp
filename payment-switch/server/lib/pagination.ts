import { z } from "zod";

/**
 * Cursor-based pagination schema and utilities.
 * Use instead of offset-based pagination for consistent performance
 * on large datasets (O(1) vs O(n) for offset).
 */
export const cursorPaginationInput = z.object({
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(25),
  direction: z.enum(["forward", "backward"]).default("forward"),
});

export type CursorPaginationInput = z.infer<typeof cursorPaginationInput>;

export interface CursorPaginationResult<T> {
  items: T[];
  nextCursor: string | null;
  prevCursor: string | null;
  hasMore: boolean;
  total?: number;
}

/**
 * Encode a cursor from a record's unique identifier + timestamp.
 */
export function encodeCursor(id: string | number, timestamp?: Date): string {
  const ts = timestamp ? timestamp.getTime() : Date.now();
  return Buffer.from(`${id}:${ts}`).toString("base64url");
}

/**
 * Decode a cursor back into id and timestamp.
 */
export function decodeCursor(cursor: string): { id: string; timestamp: number } {
  const decoded = Buffer.from(cursor, "base64url").toString("utf-8");
  const [id, ts] = decoded.split(":");
  return { id: id!, timestamp: parseInt(ts!, 10) };
}

/**
 * Build a cursor-paginated result from a query result set.
 */
export function buildCursorResult<T extends { id: number | string; createdAt?: Date }>(
  items: T[],
  limit: number,
  total?: number
): CursorPaginationResult<T> {
  const hasMore = items.length > limit;
  const pageItems = hasMore ? items.slice(0, limit) : items;
  const lastItem = pageItems[pageItems.length - 1];
  const firstItem = pageItems[0];

  return {
    items: pageItems,
    nextCursor: hasMore && lastItem ? encodeCursor(String(lastItem.id), lastItem.createdAt) : null,
    prevCursor: firstItem ? encodeCursor(String(firstItem.id), firstItem.createdAt) : null,
    hasMore,
    total,
  };
}
