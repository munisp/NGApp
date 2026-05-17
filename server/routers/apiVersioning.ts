import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

export const apiVersioningRouter = router({
  dashboard: protectedProcedure.query(() => ({
    currentVersion: "v2.1.0", supportedVersions: ["v1.0", "v1.5", "v2.0", "v2.1"],
    deprecatedVersions: [{ version: "v1.0", deprecatedAt: Date.now() - 90 * 86400000, sunsetDate: Date.now() + 90 * 86400000, activeClients: 12 }],
    versionUsage: [{ version: "v2.1", percentage: 68, clients: 340 }, { version: "v2.0", percentage: 25, clients: 125 }, { version: "v1.5", percentage: 5, clients: 25 }, { version: "v1.0", percentage: 2, clients: 12 }],
    migrationGuides: [{ from: "v1.0", to: "v1.5", breakingChanges: 3, guide: "/docs/migration/v1-to-v1.5" }, { from: "v1.5", to: "v2.0", breakingChanges: 7, guide: "/docs/migration/v1.5-to-v2" }, { from: "v2.0", to: "v2.1", breakingChanges: 1, guide: "/docs/migration/v2-to-v2.1" }],
    changelog: [{ version: "v2.1.0", date: Date.now() - 7 * 86400000, changes: ["Added GraphQL federation", "Enhanced fraud detection", "New agent hierarchy endpoints"] }, { version: "v2.0.0", date: Date.now() - 60 * 86400000, changes: ["Breaking: New auth flow", "Added real-time WebSocket", "Multi-tenancy support"] }],
  })),
  getVersion: protectedProcedure.input(z.object({ version: z.string() })).query(({ input }) => ({
    version: input.version, status: input.version === "v1.0" ? "deprecated" : "active",
    endpoints: 133, docsUrl: `/api/docs/${input.version}`,
  })),
  setDeprecation: protectedProcedure.input(z.object({ version: z.string(), sunsetDate: z.number() })).mutation(({ input }) => ({
    version: input.version, deprecated: true, sunsetDate: input.sunsetDate,
  })),
});
