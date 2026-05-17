// USSD Analytics Router — Sprint 76
// Completion rates, drop-off points, session duration, funnel analysis
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

interface USSDSession {
  id: string;
  type: string;
  carrier: string;
  region: string;
  steps: string[];
  completed: boolean;
  durationMs: number;
  timestamp: number;
}

const sessions: USSDSession[] = [];

export const ussdAnalyticsRouter = router({
  recordSession: protectedProcedure
    .input(z.object({
      type: z.string(),
      carrier: z.string(),
      region: z.string(),
      steps: z.array(z.string()),
      completed: z.boolean(),
      durationMs: z.number(),
    }))
    .mutation(({ input }) => {
      const session: USSDSession = {
        id: `USSD-${Date.now()}-${sessions.length}`,
        ...input,
        timestamp: Date.now(),
      };
      sessions.push(session);
      return { id: session.id, status: "recorded" };
    }),

  getSummary: protectedProcedure.query(() => {
    const total = sessions.length;
    const completed = sessions.filter(s => s.completed).length;
    const avgDuration = total > 0 ? Math.round(sessions.reduce((sum: any, s: any) => sum + s.durationMs, 0) / total) : 0;

    // Drop-off analysis
    const dropOffs: Record<string, number> = {};
    sessions.filter(s => !s.completed).forEach(s => {
      const lastStep = s.steps[s.steps.length - 1] || "start";
      dropOffs[lastStep] = (dropOffs[lastStep] || 0) + 1;
    });

    // By type
    const byType: Record<string, { started: number; completed: number; rate: number }> = {};
    sessions.forEach(s => {
      if (!byType[s.type]) byType[s.type] = { started: 0, completed: 0, rate: 0 };
      byType[s.type].started++;
      if (s.completed) byType[s.type].completed++;
    });
    Object.values(byType).forEach(v => { v.rate = v.started > 0 ? Math.round(v.completed / v.started * 1000) / 10 : 0; });

    // By carrier
    const byCarrier: Record<string, { sessions: number; completed: number; rate: number; avgDurationMs: number }> = {};
    sessions.forEach(s => {
      if (!byCarrier[s.carrier]) byCarrier[s.carrier] = { sessions: 0, completed: 0, rate: 0, avgDurationMs: 0 };
      byCarrier[s.carrier].sessions++;
      if (s.completed) byCarrier[s.carrier].completed++;
      byCarrier[s.carrier].avgDurationMs += s.durationMs;
    });
    Object.values(byCarrier).forEach(v => {
      v.rate = v.sessions > 0 ? Math.round(v.completed / v.sessions * 1000) / 10 : 0;
      v.avgDurationMs = v.sessions > 0 ? Math.round(v.avgDurationMs / v.sessions) : 0;
    });

    return {
      totalSessions: total,
      completedSessions: completed,
      completionRate: total > 0 ? Math.round(completed / total * 1000) / 10 : 0,
      avgDurationMs: avgDuration,
      dropOffPoints: dropOffs,
      completionByType: byType,
      carrierStats: byCarrier,
    };
  }),
});
