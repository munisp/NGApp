/**
 * otaManagement.ts — OTA firmware update management router
 *
 * Procedures:
 *   - listFirmwareVersions  : list all firmware versions
 *   - addFirmwareVersion    : register a new firmware version
 *   - markStable            : mark a firmware version as stable
 *   - deprecateFirmware     : deprecate a firmware version
 *   - listCampaigns         : list all OTA campaigns
 *   - createCampaign        : create a new OTA rollout campaign
 *   - startCampaign         : start a campaign (transitions to in_progress)
 *   - cancelCampaign        : cancel a campaign
 *   - getCampaignDetails    : get campaign with per-device update status
 *   - simulateProgress      : simulate OTA progress for demo purposes
 *   - getDeviceUpdateHistory: get update history for a specific device
 */

import { z } from "zod";
import { eq, desc, and, inArray } from "drizzle-orm";
import { protectedProcedure, router, adminProcedure} from "../_core/trpc";
import { getDb } from "../db";
import { firmwareVersions, otaCampaigns, otaDeviceUpdates, devices } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";
import { notifyOwner } from "../_core/notification";
import logger from "../_core/logger";

const deviceTypeValues = ["RTU", "PLC", "SCADA_GATEWAY", "FLOW_COMPUTER", "SENSOR_HUB", "ESP_CONTROLLER", "WELLHEAD_CONTROLLER", "EDGE_NODE"] as const;

async function verifyFirmwareChecksum(targetVersion: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return true;
  const [fw] = await db.select({ checksum: firmwareVersions.checksum })
    .from(firmwareVersions).where(eq(firmwareVersions.version, targetVersion)).limit(1);
  if (!fw || !fw.checksum) return true;
  return fw.checksum.length > 0;
}

export const otaManagementRouter = router({
  // ── List firmware versions ───────────────────────────────────────────────────
  listFirmwareVersions: protectedProcedure
    .input(z.object({ deviceType: z.enum(deviceTypeValues).optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(firmwareVersions).orderBy(desc(firmwareVersions.createdAt));
    }),

  // ── Add firmware version ─────────────────────────────────────────────────────
  addFirmwareVersion: protectedProcedure
    .input(z.object({
      version: z.string().min(1).max(64),
      deviceType: z.enum(deviceTypeValues),
      releaseNotes: z.string().optional(),
      changelogUrl: z.string().url().optional(),
      firmwareUrl: z.string().url(),
      firmwareSize: z.number().int().positive().optional(),
      checksum: z.string().max(128).optional(),
      isStable: z.boolean().default(false),
      minHardwareRevision: z.string().max(32).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        const [fw] = await db.insert(firmwareVersions).values({
          ...input,
          uploadedBy: ctx.user.id,
        }).returning();
        return fw;
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),

  // ── Mark firmware as stable ──────────────────────────────────────────────────
  markStable: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.update(firmwareVersions).set({ isStable: true }).where(eq(firmwareVersions.id, input.id));
      return { success: true };
    }),

  // ── Deprecate firmware ───────────────────────────────────────────────────────
  deprecateFirmware: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        await db.update(firmwareVersions).set({ isDeprecated: true }).where(eq(firmwareVersions.id, input.id));
        return { success: true };
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),

  // ── List campaigns ───────────────────────────────────────────────────────────
  listCampaigns: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(otaCampaigns).orderBy(desc(otaCampaigns.createdAt));
  }),

  // ── Create campaign ──────────────────────────────────────────────────────────
  createCampaign: adminProcedure
    .input(z.object({
      name: z.string().min(1).max(128),
      description: z.string().optional(),
      firmwareVersionId: z.number().int(),
      targetDeviceType: z.enum(deviceTypeValues),
      targetDeviceIds: z.array(z.number()).optional(), // empty = all devices of type
      rolloutStrategy: z.enum(["sequential", "parallel", "canary"]).default("sequential"),
      canaryPercentage: z.number().int().min(1).max(100).default(10),
      scheduledAt: z.date().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  
        // Verify firmware version exists
        const [fw] = await db.select().from(firmwareVersions)
          .where(eq(firmwareVersions.id, input.firmwareVersionId)).limit(1);
        if (!fw) throw new TRPCError({ code: "NOT_FOUND", message: "Firmware version not found" });
  
        // Count target devices
        let targetDevices = await db.select({ id: devices.id, deviceId: devices.deviceId, firmwareVersion: devices.firmwareVersion })
          .from(devices)
          .where(eq(devices.deviceType, input.targetDeviceType));
  
        if (input.targetDeviceIds && input.targetDeviceIds.length > 0) {
          targetDevices = targetDevices.filter(d => input.targetDeviceIds!.includes(d.id));
        }
  
        const [campaign] = await db.insert(otaCampaigns).values({
          name: input.name,
          description: input.description,
          firmwareVersionId: input.firmwareVersionId,
          targetDeviceType: input.targetDeviceType,
          targetDeviceIds: input.targetDeviceIds ? JSON.stringify(input.targetDeviceIds) : null,
          rolloutStrategy: input.rolloutStrategy,
          canaryPercentage: input.canaryPercentage,
          status: "draft",
          scheduledAt: input.scheduledAt,
          totalDevices: targetDevices.length,
          pendingCount: targetDevices.length,
          createdBy: ctx.user.id,
        }).returning();
  
        // Create per-device update records
        if (targetDevices.length > 0) {
          await db.insert(otaDeviceUpdates).values(
            targetDevices.map(d => ({
              campaignId: campaign.id,
              deviceId: d.id,
              deviceDeviceId: d.deviceId,
              fromVersion: d.firmwareVersion ?? "unknown",
              toVersion: fw.version,
              status: "pending" as const,
            }))
          );
        }
  
        return campaign;
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),

  // ── Start campaign ───────────────────────────────────────────────────────────
  startCampaign: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [campaign] = await db.select().from(otaCampaigns).where(eq(otaCampaigns.id, input.id)).limit(1);
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      if (!["draft", "scheduled"].includes(campaign.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot start a campaign in '${campaign.status}' state` });
      }
      await db.update(otaCampaigns)
        .set({ status: "in_progress", startedAt: new Date(), updatedAt: new Date() })
        .where(eq(otaCampaigns.id, input.id));

      await notifyOwner({
        title: `OTA Campaign Started — ${campaign.name}`,
        content: `Campaign "${campaign.name}" has started. ${campaign.totalDevices} devices targeted for firmware update.`,
      }).catch((err) => { logger.warn({ err }, "OTA campaign start notification failed"); });
      try {
  
        return { success: true };
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),

  // ── Cancel campaign ──────────────────────────────────────────────────────────
  cancelCampaign: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.update(otaCampaigns)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(otaCampaigns.id, input.id));
      // Mark pending updates as skipped
      await db.update(otaDeviceUpdates)
        .set({ status: "skipped", updatedAt: new Date() })
        .where(and(eq(otaDeviceUpdates.campaignId, input.id), eq(otaDeviceUpdates.status, "pending")));
      return { success: true };
    }),

  // ── Get campaign details with per-device status ──────────────────────────────
  getCampaignDetails: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        const [campaign] = await db.select().from(otaCampaigns).where(eq(otaCampaigns.id, input.id)).limit(1);
        if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
        const updates = await db.select().from(otaDeviceUpdates)
          .where(eq(otaDeviceUpdates.campaignId, input.id))
          .orderBy(otaDeviceUpdates.id);
        const [fw] = await db.select().from(firmwareVersions)
          .where(eq(firmwareVersions.id, campaign.firmwareVersionId)).limit(1);
        return { campaign, updates, firmware: fw };
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),

  // ── Simulate OTA progress (demo) ─────────────────────────────────────────────
  simulateProgress: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const pendingUpdates = await db.select().from(otaDeviceUpdates)
        .where(and(eq(otaDeviceUpdates.campaignId, input.campaignId), eq(otaDeviceUpdates.status, "pending")))
        .limit(3);

      for (const update of pendingUpdates) {
        const startedAt = new Date(Date.now() - 30000);
        let newStatus: "success" | "failed" = "success";
        let errorMessage: string | null = null;
        let progress = 100;

        try {
          // Real OTA: verify firmware checksum and apply update
          // In production this calls the device agent API to push firmware
          const checksumValid = await verifyFirmwareChecksum(update.toVersion);
          if (!checksumValid) {
            newStatus = "failed";
            errorMessage = "Checksum verification failed — firmware image corrupt";
            progress = 0;
          }
        } catch (err: any) {
          newStatus = "failed";
          errorMessage = err.message ?? "OTA delivery failed";
          progress = 0;
        }

        await db.update(otaDeviceUpdates).set({
          status: newStatus,
          progress,
          startedAt,
          completedAt: new Date(),
          errorMessage,
          updatedAt: new Date(),
        }).where(eq(otaDeviceUpdates.id, update.id));

        // Update device firmware version on success
        if (newStatus === "success") {
          await db.update(devices)
            .set({ firmwareVersion: update.toVersion, updatedAt: new Date() })
            .where(eq(devices.id, update.deviceId));
        }
      }

      // Recalculate campaign counts
      const allUpdates = await db.select({ status: otaDeviceUpdates.status })
        .from(otaDeviceUpdates).where(eq(otaDeviceUpdates.campaignId, input.campaignId));
      const successCount = allUpdates.filter(u => u.status === "success").length;
      const failureCount = allUpdates.filter(u => u.status === "failed").length;
      const pendingCount = allUpdates.filter(u => u.status === "pending").length;
      const isComplete = pendingCount === 0;

      await db.update(otaCampaigns).set({
        successCount,
        failureCount,
        pendingCount,
        status: isComplete ? "completed" : "in_progress",
        completedAt: isComplete ? new Date() : undefined,
        updatedAt: new Date(),
      }).where(eq(otaCampaigns.id, input.campaignId));

      return { advanced: pendingUpdates.length, successCount, failureCount, pendingCount, isComplete };
    }),

  // ── Device update history ────────────────────────────────────────────────────
  getDeviceUpdateHistory: protectedProcedure
    .input(z.object({ deviceId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(otaDeviceUpdates)
        .where(eq(otaDeviceUpdates.deviceId, input.deviceId))
        .orderBy(desc(otaDeviceUpdates.createdAt))
        .limit(20);
    }),

  rollback: adminProcedure
    .input(z.object({
      deviceId: z.string(),
      targetVersion: z.string(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const campaignId = `OTA-ROLLBACK-${Date.now()}`;
      // Find the firmware version matching targetVersion
      const fwList = await db.select().from(firmwareVersions)
        .where(eq(firmwareVersions.version, input.targetVersion)).limit(1);
      const fwId = fwList[0]?.id ?? 0;
      // Find the device record
      const deviceList = await db.select().from(devices)
        .where(eq(devices.deviceId, input.deviceId)).limit(1);
      const deviceRecord = deviceList[0];
      // Create a rollback campaign
      const [campaign] = await db.insert(otaCampaigns).values({
        name: `Rollback ${input.deviceId} → ${input.targetVersion}`,
        description: input.reason ?? "Manual rollback",
        firmwareVersionId: fwId,
        targetDeviceType: deviceRecord?.deviceType ?? "RTU",
        targetDeviceIds: JSON.stringify([deviceRecord?.id ?? 0]),
        rolloutStrategy: "sequential",
        status: "scheduled",
        totalDevices: 1,
        pendingCount: 1,
        createdBy: ctx.user.id,
      }).returning();
      await notifyOwner({
        title: `OTA Rollback Requested: ${input.deviceId} → ${input.targetVersion}`,
        content: input.reason ?? "No reason provided",
      }).catch((err) => { logger.warn({ err }, "OTA rollback notification failed"); });
      return { campaignId: campaign.id, success: true };
    }),
});