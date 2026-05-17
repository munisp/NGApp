import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

export const mobileApiLayerRouter = router({
  dashboard: protectedProcedure.query(() => ({
    registeredDevices: 4500, activeDevices: 3200, offlineCapable: 2800,
    pushNotificationsSent24h: 12500, syncOperations24h: 45000,
    platforms: [{ name: "Android", devices: 3800, percentage: 84.4 }, { name: "iOS", devices: 700, percentage: 15.6 }],
    appVersions: [{ version: "3.2.1", devices: 2500, percentage: 55.6 }, { version: "3.1.0", devices: 1200, percentage: 26.7 }, { version: "3.0.0", devices: 500, percentage: 11.1 }, { version: "2.x", devices: 300, percentage: 6.7 }],
    offlineQueue: { pendingSync: 234, avgSyncTime: 2.3, conflictsResolved: 12 },
    deviceHealth: { healthy: 3000, degraded: 150, offline: 50, batteryLow: 200 },
  })),
  registerDevice: protectedProcedure.input(z.object({ deviceId: z.string(), platform: z.enum(["android", "ios"]), appVersion: z.string(), pushToken: z.string().optional() })).mutation(({ input }) => ({
    deviceId: input.deviceId, registered: true, capabilities: ["offline_sync", "push_notifications", "biometric_auth"],
  })),
  syncData: protectedProcedure.input(z.object({ deviceId: z.string(), lastSyncTimestamp: z.number(), pendingOperations: z.array(z.object({ type: z.string(), data: z.record(z.string(), z.any()) })).default([]) })).mutation(({ input }) => ({
    syncedAt: Date.now(), newRecords: 15, updatedRecords: 8, conflicts: 0,
    pendingProcessed: input.pendingOperations.length,
  })),
  sendPush: protectedProcedure.input(z.object({ deviceIds: z.array(z.string()), title: z.string(), body: z.string(), data: z.record(z.string(), z.string()).optional() })).mutation(({ input }) => ({
    sent: input.deviceIds.length, delivered: input.deviceIds.length - 1, failed: 1,
  })),
});
