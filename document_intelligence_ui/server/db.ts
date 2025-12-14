import { eq, desc, and, isNull, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

import { Document, documents, InsertDocument, InsertOcrResult, OcrResult, ocrResults } from "../drizzle/schema";

/**
 * Create a new document record
 */
export async function createDocument(doc: InsertDocument): Promise<Document> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(documents).values(doc);
  const insertedId = Number(result[0].insertId);
  
  const inserted = await db.select().from(documents).where(eq(documents.id, insertedId)).limit(1);
  if (inserted.length === 0) throw new Error("Failed to retrieve inserted document");
  
  return inserted[0];
}

/**
 * Get documents by user ID
 */
export async function getDocumentsByUserId(userId: number): Promise<Document[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(documents).where(eq(documents.userId, userId)).orderBy(desc(documents.createdAt));
}

/**
 * Get a single document by ID
 */
export async function getDocumentById(id: number): Promise<Document | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Update document status
 */
export async function updateDocumentStatus(
  id: number,
  status: "pending" | "processing" | "completed" | "failed"
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(documents).set({ status }).where(eq(documents.id, id));
}

/**
 * Create OCR result for a document
 */
export async function createOcrResult(result: InsertOcrResult): Promise<OcrResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const insertResult = await db.insert(ocrResults).values(result);
  const insertedId = Number(insertResult[0].insertId);
  
  const inserted = await db.select().from(ocrResults).where(eq(ocrResults.id, insertedId)).limit(1);
  if (inserted.length === 0) throw new Error("Failed to retrieve inserted OCR result");
  
  return inserted[0];
}

/**
 * Get OCR result by document ID
 */
export async function getOcrResultByDocumentId(documentId: number): Promise<OcrResult | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(ocrResults).where(eq(ocrResults.documentId, documentId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

import { Batch, batches, InsertBatch } from "../drizzle/schema";

/**
 * Create a new batch record
 */
export async function createBatch(batch: InsertBatch): Promise<Batch> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(batches).values(batch);
  const insertedId = Number(result[0].insertId);
  
  const inserted = await db.select().from(batches).where(eq(batches.id, insertedId)).limit(1);
  if (inserted.length === 0) throw new Error("Failed to retrieve inserted batch");
  
  return inserted[0];
}

/**
 * Get batches by user ID
 */
export async function getBatchesByUserId(userId: number): Promise<Batch[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(batches).where(eq(batches.userId, userId)).orderBy(desc(batches.createdAt));
}

/**
 * Get a single batch by ID
 */
export async function getBatchById(id: number): Promise<Batch | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(batches).where(eq(batches.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Update batch progress
 */
export async function updateBatchProgress(
  id: number,
  updates: {
    completedFiles?: number;
    failedFiles?: number;
    status?: "pending" | "processing" | "completed" | "failed" | "cancelled";
  }
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(batches).set(updates).where(eq(batches.id, id));
}

/**
 * Get documents by batch ID
 */
export async function getDocumentsByBatchId(batchId: number): Promise<Document[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(documents).where(eq(documents.batchId, batchId)).orderBy(desc(documents.createdAt));
}

/**
 * Get batch statistics
 */
export async function getBatchStatistics(batchId: number): Promise<{
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}> {
  const db = await getDb();
  if (!db) return { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 };
  
  const docs = await getDocumentsByBatchId(batchId);
  
  return {
    total: docs.length,
    pending: docs.filter(d => d.status === "pending").length,
    processing: docs.filter(d => d.status === "processing").length,
    completed: docs.filter(d => d.status === "completed").length,
    failed: docs.filter(d => d.status === "failed").length,
  };
}

// ===== Notification Functions =====

import { notifications, InsertNotification, Notification } from "../drizzle/schema";

export async function createNotification(notification: InsertNotification): Promise<Notification | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create notification: database not available");
    return null;
  }

  try {
    const result = await db.insert(notifications).values(notification);
    const insertId = Number(result[0].insertId);
    
    // Fetch the created notification
    const created = await db.select().from(notifications).where(eq(notifications.id, insertId)).limit(1);
    return created[0] || null;
  } catch (error) {
    console.error("[Database] Failed to create notification:", error);
    return null;
  }
}

export async function getUserNotifications(
  userId: number,
  options?: {
    unreadOnly?: boolean;
    category?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ notifications: Notification[]; total: number }> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get notifications: database not available");
    return { notifications: [], total: 0 };
  }

  try {
    const conditions = [
      or(
        eq(notifications.userId, userId),
        isNull(notifications.userId) // System-wide notifications
      )
    ];

    if (options?.unreadOnly) {
      conditions.push(eq(notifications.isRead, 0));
    }

    if (options?.category) {
      conditions.push(eq(notifications.category, options.category as any));
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(...conditions));
    
    const total = Number(countResult[0]?.count || 0);

    // Get notifications
    let query = db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt));

    if (options?.limit) {
      query = query.limit(options.limit) as any;
    }

    if (options?.offset) {
      query = query.offset(options.offset) as any;
    }

    const results = await query;

    return { notifications: results, total };
  } catch (error) {
    console.error("[Database] Failed to get notifications:", error);
    return { notifications: [], total: 0 };
  }
}

export async function markNotificationAsRead(notificationId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot mark notification as read: database not available");
    return false;
  }

  try {
    await db
      .update(notifications)
      .set({ isRead: 1, readAt: new Date() })
      .where(eq(notifications.id, notificationId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to mark notification as read:", error);
    return false;
  }
}

export async function markAllNotificationsAsRead(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot mark all notifications as read: database not available");
    return false;
  }

  try {
    await db
      .update(notifications)
      .set({ isRead: 1, readAt: new Date() })
      .where(
        and(
          or(
            eq(notifications.userId, userId),
            isNull(notifications.userId)
          ),
          eq(notifications.isRead, 0)
        )
      );
    return true;
  } catch (error) {
    console.error("[Database] Failed to mark all notifications as read:", error);
    return false;
  }
}

export async function deleteNotification(notificationId: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot delete notification: database not available");
    return false;
  }

  try {
    await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.id, notificationId),
          or(
            eq(notifications.userId, userId),
            isNull(notifications.userId)
          )
        )
      );
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete notification:", error);
    return false;
  }
}

export async function getUnreadNotificationCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) {
    return 0;
  }

  try {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          or(
            eq(notifications.userId, userId),
            isNull(notifications.userId)
          ),
          eq(notifications.isRead, 0)
        )
      );
    
    return Number(result[0]?.count || 0);
  } catch (error) {
    console.error("[Database] Failed to get unread count:", error);
    return 0;
  }
}

export async function cleanupExpiredNotifications(): Promise<number> {
  const db = await getDb();
  if (!db) {
    return 0;
  }

  try {
    const result = await db
      .delete(notifications)
      .where(
        and(
          sql`${notifications.expiresAt} IS NOT NULL`,
          sql`${notifications.expiresAt} < NOW()`
        )
      );
    
    return result[0].affectedRows || 0;
  } catch (error) {
    console.error("[Database] Failed to cleanup expired notifications:", error);
    return 0;
  }
}
