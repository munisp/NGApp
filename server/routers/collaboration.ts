/**
 * Collaboration Router
 * - Room stats (who is in which well room)
 * - ML failure prediction based on physics history
 */

import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getCollabRoomStats, getCollabRoom } from "../collaboration";
import { invokeLLM } from "../_core/llm";

// ── Schemas ───────────────────────────────────────────────────────────────────

const PhysicsHistoryEntrySchema = z.object({
  tab: z.string(),
  timestamp: z.number(),
  params: z.record(z.string(), z.union([z.number(), z.string()])),
  result: z.record(z.string(), z.unknown()),
});

const FailurePredictionSchema = z.object({
  riskLevel: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"] as const),
  riskScore: z.number().min(0).max(100),
  primaryConcern: z.string(),
  findings: z.array(z.object({
    category: z.string(),
    severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const),
    description: z.string(),
    recommendation: z.string(),
  })),
  predictedFailureModes: z.array(z.string()),
  maintenanceWindow: z.string(),
  confidence: z.number().min(0).max(100),
});

export type FailurePrediction = z.infer<typeof FailurePredictionSchema>;

// ── Router ────────────────────────────────────────────────────────────────────

export const collaborationRouter = router({
  /**
   * Get all active collaboration rooms and their user counts
   */
  roomStats: publicProcedure.query(() => {
    return getCollabRoomStats();
  }),

  /**
   * Get a specific room's state
   */
  roomState: publicProcedure
    .input(z.object({ wellId: z.string() }))
    .query(({ input }) => {
      return getCollabRoom(input.wellId);
    }),

  /**
   * ML Failure Prediction
   * Analyzes physics history data using LLM to predict equipment failure risks
   */
  predictFailure: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      history: z.array(PhysicsHistoryEntrySchema).max(50),
    }))
    .mutation(async ({ input }) => {
      const { wellId, history } = input;

      if (history.length === 0) {
        return {
          riskLevel: "UNKNOWN" as const,
          riskScore: 0,
          primaryConcern: "Insufficient data",
          findings: [],
          predictedFailureModes: [],
          maintenanceWindow: "N/A",
          confidence: 0,
          wellId,
          analyzedAt: Date.now(),
        };
      }

      // Build a compact summary of the physics history for the LLM
      const summary = history.slice(-20).map(entry => ({
        tab: entry.tab,
        time: new Date(entry.timestamp).toISOString(),
        keyParams: entry.params,
        keyResults: Object.fromEntries(
          Object.entries(entry.result ?? {}).slice(0, 6)
        ),
      }));

      const prompt = `You are an expert petroleum engineer and predictive maintenance specialist analyzing well ${wellId}.

Analyze the following physics calculation history and predict equipment failure risks:

${JSON.stringify(summary, null, 2)}

Based on this data, assess:
1. Liquid loading risk (Turner analysis) — if critical_velocity > actual_velocity, loading is occurring
2. Sand production risk (sand onset) — high sanding_index or HIGH/CRITICAL sand_risk
3. Wellbore integrity (geomechanics) — narrow mud weight window indicates instability
4. Production decline rate (Arps decline) — rapid decline suggests reservoir depletion or damage
5. ESP/pump efficiency (nodal analysis) — low efficiency or large drawdown indicates pump issues

Return a JSON object matching this exact schema:
{
  "riskLevel": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN",
  "riskScore": number (0-100, where 100 = imminent failure),
  "primaryConcern": "string describing the most urgent issue",
  "findings": [
    {
      "category": "Liquid Loading" | "Sand Production" | "Wellbore Integrity" | "Production Decline" | "ESP/Pump" | "Other",
      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "description": "specific observation from the data",
      "recommendation": "specific action to take"
    }
  ],
  "predictedFailureModes": ["list", "of", "failure", "modes"],
  "maintenanceWindow": "e.g. '7 days', '30 days', 'Immediate', 'Routine (90 days)'",
  "confidence": number (0-100, based on data quality and quantity)
}`;

      try {
        const response = await invokeLLM({
          messages: [
            {
              role: "system" as const,
              content: "You are a petroleum engineering AI that analyzes well physics data and predicts equipment failures. Always respond with valid JSON only.",
            },
            { role: "user" as const, content: prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "failure_prediction",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  riskLevel: { type: "string", enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"] },
                  riskScore: { type: "number" },
                  primaryConcern: { type: "string" },
                  findings: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        category: { type: "string" },
                        severity: { type: "string", enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"] },
                        description: { type: "string" },
                        recommendation: { type: "string" },
                      },
                      required: ["category", "severity", "description", "recommendation"],
                      additionalProperties: false,
                    },
                  },
                  predictedFailureModes: { type: "array", items: { type: "string" } },
                  maintenanceWindow: { type: "string" },
                  confidence: { type: "number" },
                },
                required: ["riskLevel", "riskScore", "primaryConcern", "findings", "predictedFailureModes", "maintenanceWindow", "confidence"],
                additionalProperties: false,
              },
            },
          },
        });

        const rawContent = response?.choices?.[0]?.message?.content;
        const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
        if (!content) throw new Error("Empty LLM response");
        const parsed = JSON.parse(content);;
        const validated = FailurePredictionSchema.parse(parsed);

        return {
          ...validated,
          wellId,
          analyzedAt: Date.now(),
        };
      } catch (err) {
        console.error("[ML Prediction] LLM error:", err);
        // Fallback: rule-based prediction from the most recent data
        return buildRuleBasedPrediction(wellId, history);
      }
    }),
});

// ── Rule-based fallback prediction ───────────────────────────────────────────

function buildRuleBasedPrediction(wellId: string, history: z.infer<typeof PhysicsHistoryEntrySchema>[]) {
  const findings: FailurePrediction["findings"] = [];
  let maxRisk = 0;

  for (const entry of history.slice(-5)) {
    const r = entry.result as Record<string, unknown>;

    // Turner loading check
    if (entry.tab === "turner") {
      const status = r.loading_status as string;
      if (status === "LOADING") {
        findings.push({
          category: "Liquid Loading",
          severity: "HIGH",
          description: "Well is in liquid loading regime — actual velocity below Turner critical velocity",
          recommendation: "Consider velocity string, plunger lift, or gas lift optimization",
        });
        maxRisk = Math.max(maxRisk, 75);
      }
    }

    // Sand onset check
    if (entry.tab === "sand") {
      const risk = r.sand_risk as string;
      if (risk === "CRITICAL" || risk === "HIGH") {
        findings.push({
          category: "Sand Production",
          severity: risk as "CRITICAL" | "HIGH",
          description: `Sand risk is ${risk} — sanding index indicates formation failure risk`,
          recommendation: "Reduce drawdown, install sand screens, or perform gravel pack",
        });
        maxRisk = Math.max(maxRisk, risk === "CRITICAL" ? 90 : 70);
      }
    }

    // Geomechanics check
    if (entry.tab === "geo") {
      const mwLower = r.mw_lower_ppg as number;
      const mwUpper = r.mw_upper_ppg as number;
      if (mwLower && mwUpper && (mwUpper - mwLower) < 0.5) {
        findings.push({
          category: "Wellbore Integrity",
          severity: "HIGH",
          description: "Narrow mud weight window — high risk of wellbore instability",
          recommendation: "Optimize mud weight and monitor for lost circulation",
        });
        maxRisk = Math.max(maxRisk, 70);
      }
    }
  }

  const riskScore = maxRisk;
  const riskLevel: FailurePrediction["riskLevel"] =
    riskScore >= 85 ? "CRITICAL" :
    riskScore >= 65 ? "HIGH" :
    riskScore >= 40 ? "MEDIUM" :
    riskScore > 0 ? "LOW" : "UNKNOWN";

  return {
    riskLevel,
    riskScore,
    primaryConcern: findings[0]?.description ?? "No significant risks detected",
    findings,
    predictedFailureModes: findings.map(f => f.category),
    maintenanceWindow: riskScore >= 85 ? "Immediate" : riskScore >= 65 ? "7 days" : riskScore >= 40 ? "30 days" : "Routine (90 days)",
    confidence: Math.min(history.length * 5, 60),
    wellId,
    analyzedAt: Date.now(),
  };
}
