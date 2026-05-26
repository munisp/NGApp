/**
 * aiCopilot.ts — Streaming LLM chat with O&G domain context and tool-calling for well data
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { aiCopilotChats, wells, telemetryReadings, alarms, productionForecasts } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { invokeLLM, type Message } from "../_core/llm";

const OG_SYSTEM_PROMPT = `You are an expert Oil & Gas Production Engineer AI Co-Pilot with deep knowledge in:
- Well performance analysis (IPR/VLP, nodal analysis, ESP optimization)
- Production surveillance and decline curve analysis (Arps exponential/hyperbolic/harmonic)
- Reservoir engineering (material balance, pressure transient analysis, EOR)
- Wellbore integrity (casing inspection, pressure testing, corrosion)
- Geomechanics (1D MEM, mud weight window, wellbore stability)
- Gas well liquid loading (Turner critical velocity, plunger lift, velocity strings)
- Heavy oil recovery (SAGD, CSS, steam injection, viscosity management)
- Sand production (Mohr-Coulomb onset, gravel pack design, sand management)
- Produced water management (water balance, treatment, injection, regulatory compliance)
- Facility operations (FPSO, subsea, compression, separation)
- HSE and regulatory compliance (API, ISO, BSEE, EPA)

When answering:
1. Be precise and cite industry standards or references when applicable
2. Use field units (bbl, psi, °F, ft) unless metric is requested
3. Provide actionable recommendations with specific parameter values
4. Flag safety-critical issues prominently
5. When well data is available in context, use it to give specific answers

You have access to real-time well data from the platform. When the user asks about specific wells, use the provided data.`;

export const aiCopilotRouter = router({
  // Get chat history for a session
  history: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(aiCopilotChats)
        .where(and(
          eq(aiCopilotChats.userId, ctx.user.openId),
          eq(aiCopilotChats.sessionId, input.sessionId)
        ))
        .orderBy(aiCopilotChats.createdAt);
    }),

  // List sessions for user
  sessions: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select({
      sessionId: aiCopilotChats.sessionId,
      createdAt: aiCopilotChats.createdAt,
      content: aiCopilotChats.content,
    }).from(aiCopilotChats)
      .where(and(
        eq(aiCopilotChats.userId, ctx.user.openId),
        eq(aiCopilotChats.role, "user")
      ))
      .orderBy(desc(aiCopilotChats.createdAt));

    // Group by session, take first message as title
    const sessions = new Map<string, { sessionId: string; title: string; createdAt: Date }>();
    for (const row of rows) {
      if (!sessions.has(row.sessionId)) {
        sessions.set(row.sessionId, {
          sessionId: row.sessionId,
          title: row.content.slice(0, 80),
          createdAt: row.createdAt,
        });
      }
    }
    return Array.from(sessions.values()).slice(0, 20);
  }),

  // Send message and get AI response
  chat: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      message: z.string().min(1).max(4000),
      contextWellId: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Build well context if wellId provided
      let wellContext = "";
      if (input.contextWellId) {
        const wellRows = await db.select().from(wells)
          .where(eq(wells.wellId, input.contextWellId)).limit(1);
        const well = wellRows[0];
        if (well) {
          const latestTelemetry = await db.select().from(telemetryReadings)
            .where(eq(telemetryReadings.wellId, input.contextWellId))
            .orderBy(desc(telemetryReadings.recordedAt)).limit(1);
          const activeAlarms = await db.select().from(alarms)
            .where(and(
              eq(alarms.wellId, input.contextWellId),
              eq(alarms.state, "UNACKNOWLEDGED")
            )).limit(5);

          wellContext = `\n\n=== WELL DATA CONTEXT: ${well.name} (${well.wellId}) ===
Field: ${well.field} | Status: ${well.status} | Type: ${well.wellType}
Depth: ${well.depth ?? "N/A"} ft | Reservoir Pressure: ${well.reservoirPressurePsi ?? "N/A"} psi
Qmax: ${well.qMaxBpd ?? "N/A"} BOPD | Water Cut: ${well.waterCutFraction ? (well.waterCutFraction * 100).toFixed(1) + "%" : "N/A"}
GOR: ${well.gorScfPerBbl ?? "N/A"} scf/bbl | Skin Factor: ${well.skinFactor ?? "N/A"}
${latestTelemetry[0] ? `\nLatest Telemetry (${latestTelemetry[0].recordedAt}):
  Tubing Pressure: ${latestTelemetry[0].tubingPressure ?? "N/A"} psi
  Flow Rate: ${latestTelemetry[0].flowRate ?? "N/A"} BOPD
  ESP Frequency: ${latestTelemetry[0].espFrequency ?? "N/A"} Hz
  Water Cut: ${latestTelemetry[0].waterCut ?? "N/A"}` : ""}
${activeAlarms.length > 0 ? `\nActive Alarms (${activeAlarms.length}):
${activeAlarms.map(a => `  - [SEV ${a.severity}] ${a.description}: ${a.value} ${a.unit ?? ""}`).join("\n")}` : "\nNo active alarms."}
=== END WELL CONTEXT ===`;
        }
      }

      // Get conversation history
      const history = await db.select().from(aiCopilotChats)
        .where(and(
          eq(aiCopilotChats.userId, ctx.user.openId),
          eq(aiCopilotChats.sessionId, input.sessionId)
        ))
        .orderBy(aiCopilotChats.createdAt)
        .limit(20);

      // Build messages array
      const messages: Message[] = [
        { role: "system", content: OG_SYSTEM_PROMPT + wellContext },
        ...history.map(h => ({
          role: h.role as "user" | "assistant",
          content: h.content as string,
        })),
        { role: "user", content: input.message as string },
      ];

      // Save user message
      await db.insert(aiCopilotChats).values({
        userId: ctx.user.openId,
        sessionId: input.sessionId,
        role: "user",
        content: input.message,
        contextWellId: input.contextWellId,
      });

      // Call LLM
      const response = await invokeLLM({ messages });
      const rawContent = response?.choices?.[0]?.message?.content;
      const assistantContent: string = typeof rawContent === "string"
        ? rawContent
        : Array.isArray(rawContent)
        ? rawContent.map((c: any) => c.text ?? "").join("")
        : "I apologize, I was unable to generate a response. Please try again.";

      // Save assistant response
      await db.insert(aiCopilotChats).values({
        userId: ctx.user.openId,
        sessionId: input.sessionId,
        role: "assistant",
        content: assistantContent,
        contextWellId: input.contextWellId,
      });

      return {
        sessionId: input.sessionId,
        response: assistantContent,
        wellContext: input.contextWellId ? `Well ${input.contextWellId} data included in context` : null,
      };
    }),

  // Delete a session
  deleteSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(aiCopilotChats)
        .where(and(
          eq(aiCopilotChats.userId, ctx.user.openId),
          eq(aiCopilotChats.sessionId, input.sessionId)
        ));
      return { success: true };
    }),

  // Quick well diagnostics using LLM
  diagnose: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      symptoms: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const wellRows = await db.select().from(wells)
        .where(eq(wells.wellId, input.wellId)).limit(1);
      const well = wellRows[0];
      if (!well) throw new Error("Well not found");

      const latestTelemetry = await db.select().from(telemetryReadings)
        .where(eq(telemetryReadings.wellId, input.wellId))
        .orderBy(desc(telemetryReadings.recordedAt)).limit(1);

      const prompt = `Diagnose the following well issue and provide specific recommendations:

Well: ${well.name} (${well.wellType}, ${well.status})
Field: ${well.field}
Depth: ${well.depth ?? "N/A"} ft
Reservoir Pressure: ${well.reservoirPressurePsi ?? "N/A"} psi
Current Flow Rate: ${latestTelemetry[0]?.flowRate ?? "N/A"} BOPD
Tubing Pressure: ${latestTelemetry[0]?.tubingPressure ?? "N/A"} psi
ESP Frequency: ${latestTelemetry[0]?.espFrequency ?? "N/A"} Hz
Water Cut: ${well.waterCutFraction ? (well.waterCutFraction * 100).toFixed(1) + "%" : "N/A"}

Reported Symptoms: ${input.symptoms}

Provide:
1. Most likely root cause (with confidence %)
2. Differential diagnoses (top 3)
3. Recommended immediate actions
4. Recommended diagnostic tests
5. Estimated production impact`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: OG_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
      });

      return {
        wellId: input.wellId,
        wellName: well.name,
        diagnosis: response?.choices?.[0]?.message?.content ?? "Diagnosis unavailable",
      };
    }),
});
