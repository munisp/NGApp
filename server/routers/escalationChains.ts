import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

// ─── Types ───────────────────────────────────────────────────────────────────
interface EscalationLevel {
  level: number;
  recipientType: "email" | "sms" | "push" | "webhook";
  recipient: string;
  timeoutMinutes: number;
}

interface EscalationChain {
  id: string;
  name: string;
  description: string;
  triggerSource: "threshold_alert" | "fraud_alert" | "system_alert" | "custom";
  severity: "critical" | "high" | "medium" | "low";
  levels: EscalationLevel[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EscalationEvent {
  id: string;
  chainId: string;
  alertId: string;
  alertTitle: string;
  currentLevel: number;
  maxLevel: number;
  status: "escalating" | "acknowledged" | "resolved" | "expired";
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  startedAt: string;
  lastEscalatedAt: string;
  history: Array<{
    level: number;
    channel: string;
    recipient: string;
    sentAt: string;
    status: "sent" | "delivered" | "failed";
  }>;
}

// ─── In-Memory Store ─────────────────────────────────────────────────────────
const chains: EscalationChain[] = [
  {
    id: "esc_001",
    name: "Critical Fraud Alert Chain",
    description: "Escalates critical fraud alerts through L1 → L2 → L3 support",
    triggerSource: "fraud_alert",
    severity: "critical",
    levels: [
      { level: 1, recipientType: "push", recipient: "fraud-team", timeoutMinutes: 5 },
      { level: 2, recipientType: "sms", recipient: "+2348001234567", timeoutMinutes: 10 },
      { level: 3, recipientType: "email", recipient: "cto@54link.com", timeoutMinutes: 15 },
    ],
    enabled: true,
    createdAt: "2026-04-01T00:00:00Z",
    updatedAt: "2026-04-01T00:00:00Z",
  },
  {
    id: "esc_002",
    name: "Threshold Breach Chain",
    description: "Escalates unacknowledged threshold alerts to management",
    triggerSource: "threshold_alert",
    severity: "high",
    levels: [
      { level: 1, recipientType: "email", recipient: "ops@54link.com", timeoutMinutes: 10 },
      { level: 2, recipientType: "sms", recipient: "+2348009876543", timeoutMinutes: 15 },
      { level: 3, recipientType: "webhook", recipient: "https://hooks.54link.com/escalation", timeoutMinutes: 30 },
    ],
    enabled: true,
    createdAt: "2026-04-01T00:00:00Z",
    updatedAt: "2026-04-01T00:00:00Z",
  },
  {
    id: "esc_003",
    name: "System Downtime Chain",
    description: "Escalates system health alerts through on-call rotation",
    triggerSource: "system_alert",
    severity: "critical",
    levels: [
      { level: 1, recipientType: "push", recipient: "on-call-primary", timeoutMinutes: 3 },
      { level: 2, recipientType: "sms", recipient: "+2348005551234", timeoutMinutes: 5 },
      { level: 3, recipientType: "email", recipient: "engineering@54link.com", timeoutMinutes: 10 },
      { level: 4, recipientType: "sms", recipient: "+2348001110000", timeoutMinutes: 15 },
    ],
    enabled: true,
    createdAt: "2026-04-01T00:00:00Z",
    updatedAt: "2026-04-01T00:00:00Z",
  },
];

const activeEvents: EscalationEvent[] = [
  {
    id: "evt_esc_001",
    chainId: "esc_001",
    alertId: "fraud_alert_789",
    alertTitle: "Suspicious high-value transaction cluster detected",
    currentLevel: 2,
    maxLevel: 3,
    status: "escalating",
    acknowledgedBy: null,
    acknowledgedAt: null,
    startedAt: "2026-04-16T20:00:00Z",
    lastEscalatedAt: "2026-04-16T20:10:00Z",
    history: [
      { level: 1, channel: "push", recipient: "fraud-team", sentAt: "2026-04-16T20:00:00Z", status: "delivered" },
      { level: 2, channel: "sms", recipient: "+2348001234567", sentAt: "2026-04-16T20:10:00Z", status: "sent" },
    ],
  },
];

let chainIdCounter = 4;
let eventIdCounter = 2;

// ─── Escalation Engine ──────────────────────────────────────────────────────
function dispatchEscalation(level: EscalationLevel, alertTitle: string): { status: string; message: string } {
  const channelMap: Record<string, string> = {
    email: `[EscalationEngine] EMAIL → ${level.recipient}: 🚨 ESCALATION L${level.level}: ${alertTitle}`,
    sms: `[EscalationEngine] SMS → ${level.recipient}: [ESCALATION L${level.level}] ${alertTitle.slice(0, 80)}`,
    push: `[EscalationEngine] PUSH → ${level.recipient}: 🚨 ESCALATION L${level.level}: ${alertTitle}`,
    webhook: `[EscalationEngine] WEBHOOK → ${level.recipient}: {"type":"escalation","level":${level.level}}`,
  };
  console.log(channelMap[level.recipientType] || `[EscalationEngine] UNKNOWN channel: ${level.recipientType}`);
  return { status: "sent", message: `Dispatched to ${level.recipientType}: ${level.recipient}` };
}

function checkAndEscalate(): { escalated: number; acknowledged: number } {
  let escalated = 0;
  let acknowledged = 0;
  const now = new Date();

  for (const event of activeEvents) {
    if (event.status !== "escalating") continue;
    const chain = chains.find((c: any) => c.id === event.chainId);
    if (!chain || !chain.enabled) continue;

    const currentLevelConfig = chain.levels.find((l: any) => l.level === event.currentLevel);
    if (!currentLevelConfig) continue;

    const lastEscalated = new Date(event.lastEscalatedAt);
    const elapsedMinutes = (now.getTime() - lastEscalated.getTime()) / 60000;

    if (elapsedMinutes >= currentLevelConfig.timeoutMinutes) {
      const nextLevel = chain.levels.find((l: any) => l.level === event.currentLevel + 1);
      if (nextLevel) {
        const result = dispatchEscalation(nextLevel, event.alertTitle);
        event.currentLevel = nextLevel.level;
        event.lastEscalatedAt = now.toISOString();
        event.history.push({
          level: nextLevel.level,
          channel: nextLevel.recipientType,
          recipient: nextLevel.recipient,
          sentAt: now.toISOString(),
          status: result.status as "sent" | "delivered" | "failed",
        });
        escalated++;
      } else {
        event.status = "expired";
      }
    }
  }
  return { escalated, acknowledged };
}

// ─── Router ──────────────────────────────────────────────────────────────────
export const escalationChainsRouter = router({
  listChains: protectedProcedure.query(() => {
    return { chains, total: chains.length };
  }),

  getChain: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const chain = chains.find((c: any) => c.id === input.id);
      if (!chain) throw new Error("Chain not found");
      return chain;
    }),

  createChain: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string(),
      triggerSource: z.enum(["threshold_alert", "fraud_alert", "system_alert", "custom"]),
      severity: z.enum(["critical", "high", "medium", "low"]),
      levels: z.array(z.object({
        level: z.number(),
        recipientType: z.enum(["email", "sms", "push", "webhook"]),
        recipient: z.string(),
        timeoutMinutes: z.number().min(1).max(1440),
      })),
    }))
    .mutation(({ input }) => {
      const chain: EscalationChain = {
        id: `esc_${String(chainIdCounter++).padStart(3, "0")}`,
        ...input,
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      chains.push(chain);
      return chain;
    }),

  toggleChain: protectedProcedure
    .input(z.object({ id: z.string(), enabled: z.boolean() }))
    .mutation(({ input }) => {
      const chain = chains.find((c: any) => c.id === input.id);
      if (!chain) throw new Error("Chain not found");
      chain.enabled = input.enabled;
      chain.updatedAt = new Date().toISOString();
      return chain;
    }),

  deleteChain: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const idx = chains.findIndex((c) => c.id === input.id);
      if (idx === -1) throw new Error("Chain not found");
      chains.splice(idx, 1);
      return { success: true } as any;
    }),

  // Active escalation events
  listEvents: protectedProcedure
    .input(z.object({
      status: z.enum(["escalating", "acknowledged", "resolved", "expired", "all"]).optional(),
    }).optional())
    .query(({ input }) => {
      const status = input?.status || "all";
      const filtered = status === "all" ? activeEvents : activeEvents.filter((e: any) => e.status === status);
      return { events: filtered, total: filtered.length };
    }),

  acknowledgeEvent: protectedProcedure
    .input(z.object({ eventId: z.string(), acknowledgedBy: z.string() }))
    .mutation(({ input }) => {
      const event = activeEvents.find((e: any) => e.id === input.eventId);
      if (!event) throw new Error("Event not found");
      event.status = "acknowledged";
      event.acknowledgedBy = input.acknowledgedBy;
      event.acknowledgedAt = new Date().toISOString();
      return event;
    }),

  resolveEvent: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .mutation(({ input }) => {
      const event = activeEvents.find((e: any) => e.id === input.eventId);
      if (!event) throw new Error("Event not found");
      event.status = "resolved";
      return event;
    }),

  // Trigger a new escalation
  triggerEscalation: protectedProcedure
    .input(z.object({
      chainId: z.string(),
      alertId: z.string(),
      alertTitle: z.string(),
    }))
    .mutation(({ input }) => {
      const chain = chains.find((c: any) => c.id === input.chainId);
      if (!chain) throw new Error("Chain not found");
      if (!chain.enabled) throw new Error("Chain is disabled");

      const firstLevel = chain.levels[0];
      if (!firstLevel) throw new Error("Chain has no levels");

      const result = dispatchEscalation(firstLevel, input.alertTitle);
      const event: EscalationEvent = {
        id: `evt_esc_${String(eventIdCounter++).padStart(3, "0")}`,
        chainId: input.chainId,
        alertId: input.alertId,
        alertTitle: input.alertTitle,
        currentLevel: 1,
        maxLevel: chain.levels.length,
        status: "escalating",
        acknowledgedBy: null,
        acknowledgedAt: null,
        startedAt: new Date().toISOString(),
        lastEscalatedAt: new Date().toISOString(),
        history: [{
          level: 1,
          channel: firstLevel.recipientType,
          recipient: firstLevel.recipient,
          sentAt: new Date().toISOString(),
          status: result.status as "sent" | "delivered" | "failed",
        }],
      };
      activeEvents.push(event);
      return event;
    }),

  // Run escalation check (normally called by cron)
  runEscalationCheck: protectedProcedure.mutation(() => {
    return checkAndEscalate();
  }),
});

// Export for testing
export { checkAndEscalate, dispatchEscalation, chains as _chains, activeEvents as _activeEvents };
