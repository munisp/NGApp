import { z } from "zod";
import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { digitalTwinModels, fpsoTwinSessions, type DigitalTwinModel } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";

export const digitalTwinRouter = router({
  // ── Models ────────────────────────────────────────────────────────────
  listModels: protectedProcedure
    .input(z.object({
      assetType: z.string().optional(),
      wellId: z.string().optional(),
      isActive: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(digitalTwinModels).orderBy(digitalTwinModels.name);
      let filtered: DigitalTwinModel[] = rows;
      if (input?.assetType) { const a = input.assetType; filtered = filtered.filter((r: DigitalTwinModel) => r.assetType === a); }
      if (input?.wellId) { const w = input.wellId; filtered = filtered.filter((r: DigitalTwinModel) => r.wellId === w); }
      if (input?.isActive !== undefined) { const a = input.isActive; filtered = filtered.filter((r: DigitalTwinModel) => r.isActive === a); }
      return filtered;
    }),

  getModel: protectedProcedure
    .input(z.object({ modelId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.select().from(digitalTwinModels).where(eq(digitalTwinModels.modelId, input.modelId));
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  createModel: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      assetType: z.string().min(1),
      wellId: z.string().optional(),
      facilityId: z.string().optional(),
      gltfUrl: z.string().optional(),
      thumbnailUrl: z.string().optional(),
      positionLat: z.number().optional(),
      positionLon: z.number().optional(),
      sceneConfig: z.string().optional(),
      sensorBindings: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const modelId = `DT-${nanoid(8).toUpperCase()}`;
      const [row] = await db.insert(digitalTwinModels).values({
        ...input,
        modelId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      return row;
    }),

  updateModel: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      gltfUrl: z.string().optional(),
      thumbnailUrl: z.string().optional(),
      sceneConfig: z.string().optional(),
      sensorBindings: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      const [row] = await db.update(digitalTwinModels)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(digitalTwinModels.id, id))
        .returning();
      return row;
    }),

  // ── FPSO Pixel Streaming Sessions ─────────────────────────────────────
  listFpsoSessions: protectedProcedure
    .input(z.object({ fpsoId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(fpsoTwinSessions).orderBy(desc(fpsoTwinSessions.startedAt)).limit(50);
      if (input?.fpsoId) { const f = input.fpsoId; return rows.filter(r => r.fpsoId === f); }
      return rows;
    }),

  startFpsoSession: protectedProcedure
    .input(z.object({
      fpsoId: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const sessionId = `FPSO-${nanoid(12).toUpperCase()}`;
      // In production: allocate GPU node and get streaming URL
      const streamUrl = `wss://pixel-stream.og-rmm.internal/session/${sessionId}`;
      const [row] = await db.insert(fpsoTwinSessions).values({
        sessionId,
        fpsoId: input.fpsoId,
        userId: ctx.user.openId,
        streamUrl,
        status: "ready",
        startedAt: new Date(),
      }).returning();
      return row;
    }),

  endFpsoSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const endedAt = new Date();
      const [session] = await db.select().from(fpsoTwinSessions).where(eq(fpsoTwinSessions.sessionId, input.sessionId));
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      const durationSec = session.startedAt ? Math.round((endedAt.getTime() - new Date(session.startedAt).getTime()) / 1000) : 0;
      const [row] = await db.update(fpsoTwinSessions)
        .set({ status: "ended", endedAt, durationSec })
        .where(eq(fpsoTwinSessions.sessionId, input.sessionId))
        .returning();
      return row;
    }),

  // ── Sensor telemetry binding ───────────────────────────────────────────
  getSensorBindings: protectedProcedure
    .input(z.object({ modelId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [model] = await db.select().from(digitalTwinModels).where(eq(digitalTwinModels.modelId, input.modelId));
      if (!model) throw new TRPCError({ code: "NOT_FOUND" });
      try {
        return model.sensorBindings ? JSON.parse(model.sensorBindings) : {};
      } catch {
        return {};
      }
    }),

  updateSensorBindings: adminProcedure
    .input(z.object({
      modelId: z.string(),
      bindings: z.record(z.string(), z.string()),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.update(digitalTwinModels)
        .set({ sensorBindings: JSON.stringify(input.bindings), updatedAt: new Date() })
        .where(eq(digitalTwinModels.modelId, input.modelId))
        .returning();
      return row;
    }),

  // ── Seed default models ────────────────────────────────────────────────
  seedDefaultModels: adminProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const defaults = [
      { modelId: "DT-WELL001", name: "Well ALPHA-001 Digital Twin", assetType: "wellhead", wellId: "WELL-001", positionLat: 29.7604, positionLon: -95.3698 },
      { modelId: "DT-FPSO001", name: "FPSO Titan Digital Twin", assetType: "fpso", facilityId: "FPSO-001", positionLat: 28.0, positionLon: -90.5 },
      { modelId: "DT-COMP001", name: "Compressor Station Alpha", assetType: "compressor", facilityId: "COMP-001", positionLat: 30.2, positionLon: -93.1 },
    ];
    for (const d of defaults) {
      await db.insert(digitalTwinModels).values({
        ...d,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).onConflictDoNothing();
    }
    return { seeded: defaults.length };
  }),
});
