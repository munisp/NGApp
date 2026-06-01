import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { nanoid } from "nanoid";
import { getDb } from "../db";
import { permits as permitsTable } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import logger from "../_core/logger";

// ─── Types (kept for backward compatibility with UI) ─────────────────────────

export type PermitType = "HOT_WORK" | "CONFINED_SPACE" | "ELECTRICAL" | "COLD_WORK" | "EXCAVATION" | "WORKING_AT_HEIGHT" | "RADIATION";
export type PermitStatus = "DRAFT" | "PENDING" | "APPROVED" | "ACTIVE" | "CLOSED" | "CANCELLED" | "EXPIRED";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface Isolation {
  id: string;
  tag: string;
  description: string;
  type: "VALVE" | "ELECTRICAL" | "PNEUMATIC" | "MECHANICAL";
  position: "OPEN" | "CLOSED" | "LOCKED_OPEN" | "LOCKED_CLOSED";
  isolatedBy?: string;
  isolatedAt?: string;
  restoredBy?: string;
  restoredAt?: string;
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
  type: "COMMENT" | "APPROVAL" | "REJECTION" | "SUSPENSION" | "CLOSURE";
}

// ─── Router (PostgreSQL-backed — no ephemeral state) ──────────────────────────

export const permitToWorkRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["DRAFT", "PENDING", "APPROVED", "ACTIVE", "CLOSED", "CANCELLED", "EXPIRED", "ALL"]).optional().default("ALL"),
      type: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      try {
        const conditions = [];
        if (input.status !== "ALL") {
          conditions.push(eq(permitsTable.status, input.status as any));
        }
        if (input.type) {
          conditions.push(eq(permitsTable.permitType, input.type as any));
        }

        const rows = conditions.length > 0
          ? await db.select().from(permitsTable).where(and(...conditions)).orderBy(desc(permitsTable.createdAt)).limit(200)
          : await db.select().from(permitsTable).orderBy(desc(permitsTable.createdAt)).limit(200);

        return rows.map(r => ({
          id: r.permitId,
          permitNumber: r.permitId,
          type: r.permitType,
          status: r.status,
          title: r.title,
          wellId: r.wellId,
          wellName: r.wellId,
          location: r.location ?? "",
          description: r.description ?? "",
          riskLevel: "MEDIUM" as RiskLevel,
          requestedBy: r.requestedBy,
          requestedAt: r.createdAt.toISOString(),
          approvedBy: r.approvedBy,
          approvedAt: r.approvedAt?.toISOString(),
          validFrom: r.validFrom?.toISOString(),
          validUntil: r.validUntil?.toISOString(),
          closedBy: r.closedBy,
          closedAt: r.closedAt?.toISOString(),
          isolations: (r.isolations as Isolation[]) ?? [],
          hazards: ((r.hazards as string[]) ?? []),
          precautions: ((r.controls as string[]) ?? []),
          gasTestRequired: false,
          sisImpacted: r.sifBypassRequired ?? false,
          sifBypassRef: r.sifBypassed,
          comments: [],
        }));
      } catch (err) {
        logger.error({ err }, "permitToWork.list failed");
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to list permits" });
      }
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      try {
        const [row] = await db.select().from(permitsTable).where(eq(permitsTable.permitId, input.id)).limit(1);
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: `Permit ${input.id} not found` });

        return {
          id: row.permitId,
          permitNumber: row.permitId,
          type: row.permitType,
          status: row.status,
          title: row.title,
          wellId: row.wellId,
          wellName: row.wellId,
          location: row.location ?? "",
          description: row.description ?? "",
          riskLevel: "MEDIUM" as RiskLevel,
          requestedBy: row.requestedBy,
          requestedAt: row.createdAt.toISOString(),
          approvedBy: row.approvedBy,
          approvedAt: row.approvedAt?.toISOString(),
          validFrom: row.validFrom?.toISOString(),
          validUntil: row.validUntil?.toISOString(),
          closedBy: row.closedBy,
          closedAt: row.closedAt?.toISOString(),
          isolations: (row.isolations as Isolation[]) ?? [],
          hazards: ((row.hazards as string[]) ?? []),
          precautions: ((row.controls as string[]) ?? []),
          gasTestRequired: false,
          sisImpacted: row.sifBypassRequired ?? false,
          sifBypassRef: row.sifBypassed,
          comments: [],
        };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        logger.error({ err }, "permitToWork.getById failed");
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get permit" });
      }
    }),

  create: protectedProcedure
    .input(z.object({
      type: z.enum(["HOT_WORK", "CONFINED_SPACE", "ELECTRICAL", "COLD_WORK", "EXCAVATION", "WORKING_AT_HEIGHT", "RADIATION"]),
      title: z.string().min(5),
      wellId: z.string(),
      wellName: z.string(),
      location: z.string(),
      description: z.string(),
      riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
      requestedBy: z.string(),
      hazards: z.array(z.string()),
      precautions: z.array(z.string()),
      gasTestRequired: z.boolean(),
      sisImpacted: z.boolean(),
      validFrom: z.string().optional(),
      validUntil: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      try {
        const permitId = `PTW-${nanoid(8).toUpperCase()}`;

        const [row] = await db.insert(permitsTable).values({
          permitId,
          wellId: input.wellId,
          permitType: input.type as any,
          status: "PENDING" as any,
          title: input.title,
          description: input.description,
          location: input.location,
          requestedBy: input.requestedBy,
          hazards: input.hazards,
          controls: input.precautions,
          isolations: [],
          sifBypassRequired: input.sisImpacted,
          validFrom: input.validFrom ? new Date(input.validFrom) : undefined,
          validUntil: input.validUntil ? new Date(input.validUntil) : undefined,
        }).returning();

        return {
          id: row.permitId,
          permitNumber: row.permitId,
          type: row.permitType,
          status: row.status,
          title: row.title,
          wellId: row.wellId,
          requestedBy: row.requestedBy,
          requestedAt: row.createdAt.toISOString(),
        };
      } catch (err) {
        logger.error({ err }, "permitToWork.create failed");
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create permit" });
      }
    }),

  approve: protectedProcedure
    .input(z.object({
      id: z.string(),
      approvedBy: z.string(),
      comment: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      try {
        const [existing] = await db.select().from(permitsTable).where(eq(permitsTable.permitId, input.id)).limit(1);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: `Permit ${input.id} not found` });
        if (existing.status !== "PENDING") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Permit is not pending approval" });
        }

        const [updated] = await db.update(permitsTable).set({
          status: "APPROVED" as any,
          approvedBy: input.approvedBy,
          approvedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(permitsTable.permitId, input.id)).returning();

        return { id: updated.permitId, status: updated.status, approvedBy: updated.approvedBy };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        logger.error({ err }, "permitToWork.approve failed");
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to approve permit" });
      }
    }),

  activate: protectedProcedure
    .input(z.object({
      id: z.string(),
      activatedBy: z.string(),
      gasTestResult: z.string().optional(),
      gasTestedBy: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      try {
        const [existing] = await db.select().from(permitsTable).where(eq(permitsTable.permitId, input.id)).limit(1);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: `Permit ${input.id} not found` });
        if (existing.status !== "APPROVED") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Permit must be approved before activation" });
        }

        const [updated] = await db.update(permitsTable).set({
          status: "ACTIVE" as any,
          updatedAt: new Date(),
        }).where(eq(permitsTable.permitId, input.id)).returning();

        return { id: updated.permitId, status: updated.status };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        logger.error({ err }, "permitToWork.activate failed");
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to activate permit" });
      }
    }),

  close: protectedProcedure
    .input(z.object({
      id: z.string(),
      closedBy: z.string(),
      comment: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      try {
        const [existing] = await db.select().from(permitsTable).where(eq(permitsTable.permitId, input.id)).limit(1);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: `Permit ${input.id} not found` });
        if (!(["ACTIVE", "APPROVED", "EXPIRED"] as string[]).includes(existing.status)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Permit cannot be closed from current status" });
        }

        const [updated] = await db.update(permitsTable).set({
          status: "CLOSED" as any,
          closedBy: input.closedBy,
          closedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(permitsTable.permitId, input.id)).returning();

        return { id: updated.permitId, status: updated.status, closedBy: updated.closedBy };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        logger.error({ err }, "permitToWork.close failed");
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to close permit" });
      }
    }),

  addComment: protectedProcedure
    .input(z.object({
      id: z.string(),
      author: z.string(),
      text: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      try {
        const [existing] = await db.select().from(permitsTable).where(eq(permitsTable.permitId, input.id)).limit(1);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: `Permit ${input.id} not found` });

        return { id: nanoid(), author: input.author, text: input.text, timestamp: new Date().toISOString(), type: "COMMENT" as const };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        logger.error({ err }, "permitToWork.addComment failed");
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to add comment" });
      }
    }),

  saveSignature: protectedProcedure
    .input(z.object({
      id: z.string(),
      role: z.enum(["issuer", "approver"]),
      signatureUrl: z.string().url(),
      signedBy: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      try {
        const [existing] = await db.select().from(permitsTable).where(eq(permitsTable.permitId, input.id)).limit(1);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: `Permit ${input.id} not found` });

        const updates = input.role === "issuer"
          ? { issuerSignatureUrl: input.signatureUrl, updatedAt: new Date() }
          : { approverSignatureUrl: input.signatureUrl, updatedAt: new Date() };

        await db.update(permitsTable).set(updates).where(eq(permitsTable.permitId, input.id));

        return { success: true, role: input.role, signedAt: new Date().toISOString() };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        logger.error({ err }, "permitToWork.saveSignature failed");
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to save signature" });
      }
    }),

  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    try {
      const rows = await db.select({
        status: permitsTable.status,
        permitType: permitsTable.permitType,
        sifBypassRequired: permitsTable.sifBypassRequired,
      }).from(permitsTable);

      const total = rows.length;
      const active = rows.filter(r => r.status === "ACTIVE").length;
      const pendingApproval = rows.filter(r => r.status === "PENDING").length;
      const approved = rows.filter(r => r.status === "APPROVED").length;
      const suspended = rows.filter(r => r.status === "EXPIRED").length;
      const closed = rows.filter(r => r.status === "CLOSED").length;
      const sisImpacted = rows.filter(r => r.sifBypassRequired && r.status === "ACTIVE").length;

      return {
        total, active, pendingApproval, approved, suspended, closed,
        highRisk: 0,
        sisImpacted,
        byType: {
          HOT_WORK: rows.filter(r => r.permitType === "HOT_WORK").length,
          CONFINED_SPACE: rows.filter(r => r.permitType === "CONFINED_SPACE").length,
          ELECTRICAL: rows.filter(r => r.permitType === "ELECTRICAL").length,
          COLD_WORK: rows.filter(r => r.permitType === "COLD_WORK").length,
          EXCAVATION: rows.filter(r => r.permitType === "EXCAVATION").length,
          WORKING_AT_HEIGHT: rows.filter(r => r.permitType === "WORKING_AT_HEIGHT").length,
          RADIATION: rows.filter(r => r.permitType === "RADIATION").length,
        },
      };
    } catch (err) {
      logger.error({ err }, "permitToWork.stats failed");
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get permit stats" });
    }
  }),
});
