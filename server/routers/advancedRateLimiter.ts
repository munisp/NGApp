import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

export const advancedRateLimiterRouter = router({
  dashboard: protectedProcedure.query(() => ({
    totalRules: 24, activeRules: 22, blockedRequests24h: 1847, allowedRequests24h: 458230,
    algorithms: [{ name: "Token Bucket", rules: 8, description: "Smooth rate limiting with burst allowance" }, { name: "Sliding Window", rules: 10, description: "Precise rate counting over rolling window" }, { name: "Fixed Window", rules: 4, description: "Simple counter per time window" }, { name: "Leaky Bucket", rules: 2, description: "Constant output rate regardless of input" }],
    topBlocked: [{ ip: "41.58.xxx.xxx", requests: 342, rule: "API abuse", blockedAt: Date.now() - 3600000 }, { ip: "105.112.xxx.xxx", requests: 218, rule: "Brute force", blockedAt: Date.now() - 7200000 }],
    rules: [
      { id: "rl-1", name: "Transaction API", endpoint: "/api/trpc/transaction.*", algorithm: "token_bucket", limit: 100, window: 60, burst: 20, scope: "per_user", status: "active" },
      { id: "rl-2", name: "Auth Endpoints", endpoint: "/api/trpc/auth.*", algorithm: "sliding_window", limit: 10, window: 300, burst: 0, scope: "per_ip", status: "active" },
      { id: "rl-3", name: "Report Generation", endpoint: "/api/trpc/report.*", algorithm: "fixed_window", limit: 5, window: 3600, burst: 0, scope: "per_user", status: "active" },
      { id: "rl-4", name: "Bulk Operations", endpoint: "/api/trpc/bulk.*", algorithm: "leaky_bucket", limit: 2, window: 60, burst: 0, scope: "per_user", status: "active" },
    ],
  })),
  createRule: protectedProcedure.input(z.object({ name: z.string(), endpoint: z.string(), algorithm: z.enum(["token_bucket", "sliding_window", "fixed_window", "leaky_bucket"]), limit: z.number(), window: z.number(), burst: z.number().default(0), scope: z.enum(["per_user", "per_ip", "per_endpoint", "global"]) })).mutation(({ input }) => ({ id: `rl-${Date.now()}`, ...input, status: "active", createdAt: Date.now() })),
  toggleRule: protectedProcedure.input(z.object({ ruleId: z.string(), enabled: z.boolean() })).mutation(({ input }) => ({ ruleId: input.ruleId, status: input.enabled ? "active" : "disabled" })),
  getBlockedIps: protectedProcedure.query(() => ({ blocked: [{ ip: "41.58.xxx.xxx", reason: "API abuse", blockedAt: Date.now() - 3600000, expiresAt: Date.now() + 3600000, requestCount: 342 }], total: 15 })),
});
