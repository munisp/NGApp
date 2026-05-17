import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
const devices = [
  { id: "DEV-001", agentId: "AGT-001", model: "PAX A920 Pro", serial: "PAX920P-2024-001", fingerprint: "fp_a1b2c3d4e5", status: "verified", lastSeen: "2026-04-21T11:30:00Z", location: "Lagos - Ikeja", trustScore: 98, anomalies: 0 },
  { id: "DEV-002", agentId: "AGT-002", model: "Ingenico Move/5000", serial: "ING5K-2024-002", fingerprint: "fp_f6g7h8i9j0", status: "verified", lastSeen: "2026-04-21T11:25:00Z", location: "Abuja - Wuse", trustScore: 95, anomalies: 1 },
  { id: "DEV-003", agentId: "AGT-005", model: "Sunmi P2", serial: "SUNP2-2024-003", fingerprint: "fp_k1l2m3n4o5", status: "flagged", lastSeen: "2026-04-21T10:00:00Z", location: "Enugu - New Haven", trustScore: 62, anomalies: 5 },
  { id: "DEV-004", agentId: "AGT-003", model: "PAX A920 Pro", serial: "PAX920P-2024-004", fingerprint: "fp_p6q7r8s9t0", status: "verified", lastSeen: "2026-04-21T11:28:00Z", location: "Kano - Nassarawa", trustScore: 97, anomalies: 0 },
];
export const agentDeviceFingerprintRouter = router({
  getStats: protectedProcedure.query(() => ({ totalDevices: devices.length, verifiedDevices: devices.filter(d => d.status === "verified").length, flaggedDevices: devices.filter(d => d.status === "flagged").length, avgTrustScore: devices.reduce((s: any, d: any) => s + d.trustScore, 0) / devices.length, totalAnomalies: devices.reduce((s: any, d: any) => s + d.anomalies, 0), clonedDeviceAlerts: 1, lastScanTime: "2 minutes ago" })),
  listDevices: protectedProcedure.query(() => ({ devices, total: devices.length })),
  getDevice: protectedProcedure.input(z.object({ deviceId: z.string() })).query(({ input }) => devices.find(d => d.id === input.deviceId) || null),
  verifyDevice: protectedProcedure.input(z.object({ deviceId: z.string(), fingerprint: z.string() })).mutation(({ input }) => ({ deviceId: input.deviceId, verified: true, trustScore: 95, verifiedAt: new Date().toISOString() })),
  reportAnomaly: protectedProcedure.input(z.object({ deviceId: z.string(), type: z.string(), description: z.string() })).mutation(({ input }) => ({ alertId: `ALT-${Date.now()}`, ...input, severity: "high", assignedTo: "Security Team" })),
});
