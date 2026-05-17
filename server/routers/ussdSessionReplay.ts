import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

// USSD Session Replay Router — Sprint 78
// Provides keystroke-by-keystroke session replay for admin debugging

interface USSDKeystroke {
  step: number;
  timestamp: number;
  input: string;
  screenText: string;
  menuLevel: number;
  responseTimeMs: number;
}

interface USSDSessionRecord {
  sessionId: string;
  phoneNumber: string;
  carrier: string;
  serviceCode: string;
  agentId: string | null;
  startedAt: number;
  endedAt: number | null;
  status: "completed" | "dropped" | "timeout" | "error" | "active";
  keystrokes: USSDKeystroke[];
  totalDurationMs: number;
  dropOffScreen: string | null;
  completionRate: number;
}

const seedSessions: USSDSessionRecord[] = [
  {
    sessionId: "SESS-001",
    phoneNumber: "+2348012345678",
    carrier: "MTN_NG",
    serviceCode: "*384#",
    agentId: "AGT-001",
    startedAt: Date.now() - 3600000,
    endedAt: Date.now() - 3580000,
    status: "completed",
    keystrokes: [
      { step: 1, timestamp: Date.now() - 3600000, input: "*384#", screenText: "Welcome to 54Link\n1. Cash In\n2. Cash Out\n3. Transfer\n4. Balance", menuLevel: 0, responseTimeMs: 450 },
      { step: 2, timestamp: Date.now() - 3595000, input: "1", screenText: "Cash In\nEnter Amount:", menuLevel: 1, responseTimeMs: 320 },
      { step: 3, timestamp: Date.now() - 3590000, input: "50000", screenText: "Confirm Cash In ₦50,000\n1. Confirm\n2. Cancel", menuLevel: 2, responseTimeMs: 280 },
      { step: 4, timestamp: Date.now() - 3585000, input: "1", screenText: "Transaction Successful!\nRef: TX-ABC123\nBalance: ₦150,000", menuLevel: 3, responseTimeMs: 1200 },
    ],
    totalDurationMs: 15000,
    dropOffScreen: null,
    completionRate: 1.0,
  },
  {
    sessionId: "SESS-002",
    phoneNumber: "+2348099887766",
    carrier: "Airtel_NG",
    serviceCode: "*384#",
    agentId: "AGT-002",
    startedAt: Date.now() - 1800000,
    endedAt: null,
    status: "dropped",
    keystrokes: [
      { step: 1, timestamp: Date.now() - 1800000, input: "*384#", screenText: "Welcome to 54Link\n1. Cash In\n2. Cash Out\n3. Transfer\n4. Balance", menuLevel: 0, responseTimeMs: 450 },
      { step: 2, timestamp: Date.now() - 1795000, input: "2", screenText: "Cash Out\nEnter Amount:", menuLevel: 1, responseTimeMs: 380 },
      { step: 3, timestamp: Date.now() - 1790000, input: "100000", screenText: "Confirm Cash Out ₦100,000\n1. Confirm\n2. Cancel", menuLevel: 2, responseTimeMs: 290 },
    ],
    totalDurationMs: 10000,
    dropOffScreen: "Confirm Cash Out ₦100,000",
    completionRate: 0.75,
  },
  {
    sessionId: "SESS-003",
    phoneNumber: "+254712345678",
    carrier: "Safaricom_KE",
    serviceCode: "*384#",
    agentId: "AGT-003",
    startedAt: Date.now() - 900000,
    endedAt: Date.now() - 885000,
    status: "completed",
    keystrokes: [
      { step: 1, timestamp: Date.now() - 900000, input: "*384#", screenText: "Welcome to 54Link\n1. Cash In\n2. Cash Out\n3. Transfer\n4. Balance", menuLevel: 0, responseTimeMs: 520 },
      { step: 2, timestamp: Date.now() - 895000, input: "3", screenText: "Transfer\nEnter Recipient Phone:", menuLevel: 1, responseTimeMs: 340 },
      { step: 3, timestamp: Date.now() - 890000, input: "+254798765432", screenText: "Enter Amount:", menuLevel: 2, responseTimeMs: 300 },
      { step: 4, timestamp: Date.now() - 885000, input: "5000", screenText: "Confirm Transfer KES 5,000 to +254798765432\n1. Confirm\n2. Cancel", menuLevel: 3, responseTimeMs: 260 },
      { step: 5, timestamp: Date.now() - 880000, input: "1", screenText: "Transfer Successful!\nRef: TX-DEF456", menuLevel: 4, responseTimeMs: 980 },
    ],
    totalDurationMs: 20000,
    dropOffScreen: null,
    completionRate: 1.0,
  },
  {
    sessionId: "SESS-004",
    phoneNumber: "+2348055555555",
    carrier: "Glo_NG",
    serviceCode: "*384#",
    agentId: null,
    startedAt: Date.now() - 600000,
    endedAt: null,
    status: "timeout",
    keystrokes: [
      { step: 1, timestamp: Date.now() - 600000, input: "*384#", screenText: "Welcome to 54Link\n1. Cash In\n2. Cash Out\n3. Transfer\n4. Balance", menuLevel: 0, responseTimeMs: 450 },
      { step: 2, timestamp: Date.now() - 595000, input: "4", screenText: "Balance Check\nAgent Code:", menuLevel: 1, responseTimeMs: 350 },
    ],
    totalDurationMs: 30000,
    dropOffScreen: "Balance Check\nAgent Code:",
    completionRate: 0.5,
  },
  {
    sessionId: "SESS-005",
    phoneNumber: "+233201234567",
    carrier: "MTN_GH",
    serviceCode: "*384#",
    agentId: "AGT-005",
    startedAt: Date.now() - 300000,
    endedAt: Date.now() - 295000,
    status: "error",
    keystrokes: [
      { step: 1, timestamp: Date.now() - 300000, input: "*384#", screenText: "Welcome to 54Link\n1. Cash In\n2. Cash Out\n3. Transfer\n4. Balance", menuLevel: 0, responseTimeMs: 480 },
      { step: 2, timestamp: Date.now() - 295000, input: "1", screenText: "Cash In\nEnter Amount:", menuLevel: 1, responseTimeMs: 310 },
      { step: 3, timestamp: Date.now() - 290000, input: "abc", screenText: "Error: Invalid amount. Please enter a number.", menuLevel: 2, responseTimeMs: 150 },
    ],
    totalDurationMs: 10000,
    dropOffScreen: "Error: Invalid amount",
    completionRate: 0.5,
  },
];

export const ussdSessionReplayRouter = router({
  listSessions: protectedProcedure
    .input(z.object({
      status: z.enum(["all", "completed", "dropped", "timeout", "error", "active"]).optional(),
      carrier: z.string().optional(),
      limit: z.number().min(1).max(100).optional(),
    }).optional())
    .query(({ input }) => {
      let sessions = [...seedSessions];
      if (input?.status && input.status !== "all") {
        sessions = sessions.filter(s => s.status === input.status);
      }
      if (input?.carrier) {
        sessions = sessions.filter(s => s.carrier === input.carrier);
      }
      const limit = input?.limit ?? 50;
      return {
        sessions: sessions.slice(0, limit).map(s => ({
          ...s,
          keystrokes: undefined,
          keystrokeCount: s.keystrokes.length,
        })),
        total: sessions.length,
      };
    }),

  getSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(({ input }) => {
      const session = seedSessions.find(s => s.sessionId === input.sessionId);
      if (!session) throw new Error("Session not found");
      return session;
    }),

  replaySession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(({ input }) => {
      const session = seedSessions.find(s => s.sessionId === input.sessionId);
      if (!session) throw new Error("Session not found");
      return {
        sessionId: session.sessionId,
        carrier: session.carrier,
        status: session.status,
        keystrokes: session.keystrokes,
        totalSteps: session.keystrokes.length,
        totalDurationMs: session.totalDurationMs,
      };
    }),

  getAnalytics: protectedProcedure.query(() => {
    const total = seedSessions.length;
    const completed = seedSessions.filter(s => s.status === "completed").length;
    const dropped = seedSessions.filter(s => s.status === "dropped").length;
    const timeout = seedSessions.filter(s => s.status === "timeout").length;
    const errors = seedSessions.filter(s => s.status === "error").length;
    const avgDuration = seedSessions.reduce((sum: any, s: any) => sum + s.totalDurationMs, 0) / total;
    const avgCompletion = seedSessions.reduce((sum: any, s: any) => sum + s.completionRate, 0) / total;
    const carrierBreakdown = seedSessions.reduce((acc: any, s: any) => {
      acc[s.carrier] = (acc[s.carrier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return {
      totalSessions: total,
      completed,
      dropped,
      timeout,
      errors,
      completionRate: Math.round(avgCompletion * 100),
      avgDurationMs: Math.round(avgDuration),
      carrierBreakdown,
      dropOffScreens: seedSessions.filter(s => s.dropOffScreen).map(s => ({
        sessionId: s.sessionId,
        screen: s.dropOffScreen,
        carrier: s.carrier,
      })),
    };
  }),
  list: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      return {} as any;
    }),
});
