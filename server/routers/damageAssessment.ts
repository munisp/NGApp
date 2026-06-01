/**
 * damageAssessment.ts — War Damage Assessment tRPC Router (v21.0)
 *
 * Provides CRUD + AI-powered triage for post-conflict O&G infrastructure
 * damage assessments. Covers wellheads, pipelines, separators, pump stations,
 * storage tanks, control rooms, and other field assets.
 *
 * Triage scoring formula:
 *   score = (classificationWeight × 40) + (productionLossWeight × 35) + (hseWeight × 25)
 *   → 0–100, higher = more urgent
 */

import { z } from "zod";
import { protectedProcedure, router, adminProcedure} from "../_core/trpc";
import { getPool } from "../db";
import { invokeLLM } from "../_core/llm";
import { TRPCError } from "@trpc/server";
import type { Pool } from "pg";
import { withCache, cacheKey, cacheInvalidateRouter, TTL } from "../cache";

// ── DB helper ────────────────────────────────────────────────────────────────

async function pool(): Promise<Pool> {
  const p = await getPool();
  if (!p) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return p;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateAssessmentId(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `DA-${year}-${rand}`;
}

function generateTicketId(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `RT-${year}-${rand}`;
}

/** Compute a 0–100 triage urgency score */
function computeTriageScore(params: {
  classification: string;
  productionLossBpd: number;
  hseRisk: boolean;
  environmentalRisk: boolean;
}): { score: number; priority: string } {
  const classWeights: Record<string, number> = {
    DESTROYED: 1.0,
    SEVERELY_DAMAGED: 0.8,
    MODERATELY_DAMAGED: 0.5,
    MINOR_DAMAGE: 0.2,
    INTACT: 0.0,
    UNKNOWN: 0.4,
  };
  const classScore = (classWeights[params.classification] ?? 0.4) * 40;
  const prodScore = Math.min(params.productionLossBpd / 5000, 1.0) * 35;
  const hseScore = (params.hseRisk ? 15 : 0) + (params.environmentalRisk ? 10 : 0);
  const total = Math.round(classScore + prodScore + hseScore);

  let priority: string;
  if (total >= 75) priority = "CRITICAL";
  else if (total >= 55) priority = "HIGH";
  else if (total >= 35) priority = "MEDIUM";
  else if (total >= 15) priority = "LOW";
  else priority = "DEFERRED";

  return { score: total, priority };
}

/** Build a prompt for LLM triage analysis */
function buildTriagePrompt(a: {
  assetName: string; assetType: string; fieldName?: string | null; country: string;
  classification: string; cause?: string | null;
  productionLossBpd: number; productionLossGasMmscfd: number;
  estimatedDowntimeDays?: number | null; estimatedRepairCostUsd?: number | null;
  hseRisk: boolean; environmentalRisk: boolean; accessSafe: boolean;
  description?: string | null; triageScore: number;
}): string {
  return `You are an expert oil & gas infrastructure damage assessment engineer specializing in post-conflict field recovery in the Middle East.

Analyze the following war-damage assessment and provide:
1. A concise executive summary (2–3 sentences) of the damage situation and urgency.
2. Three specific, actionable repair recommendations in order of priority.
3. Key safety and environmental concerns that must be addressed before mobilizing repair crews.
4. Estimated timeline to restore production (optimistic / realistic / pessimistic scenarios).

DAMAGE ASSESSMENT DATA:
- Asset: ${a.assetName} (${a.assetType})
- Field: ${a.fieldName ?? "Unknown"}, ${a.country}
- Damage Classification: ${a.classification}
- Cause: ${a.cause ?? "Unknown"}
- Production Loss: ${a.productionLossBpd.toFixed(0)} BPD oil, ${a.productionLossGasMmscfd.toFixed(2)} MMscfd gas
- Estimated Downtime: ${a.estimatedDowntimeDays ?? "Unknown"} days
- Estimated Repair Cost: $${(a.estimatedRepairCostUsd ?? 0).toLocaleString()}
- HSE Risk: ${a.hseRisk ? "YES — site poses immediate safety hazard" : "No immediate HSE risk identified"}
- Environmental Risk: ${a.environmentalRisk ? "YES — potential spill/contamination risk" : "No environmental risk identified"}
- Site Access: ${a.accessSafe ? "Safe for crew access" : "NOT SAFE — security/structural hazard"}
- Triage Score: ${a.triageScore}/100
- Description: ${a.description ?? "No additional description provided"}

Respond in JSON format:
{
  "summary": "...",
  "recommendations": [
    { "priority": "HIGH|MEDIUM|LOW", "action": "...", "rationale": "...", "timeframe": "..." }
  ],
  "safetyConcerns": ["...", "..."],
  "timeline": { "optimistic": "X weeks", "realistic": "Y weeks", "pessimistic": "Z weeks" }
}`;
}

// ── Router ────────────────────────────────────────────────────────────────────

export const damageAssessmentRouter = router({

  /** List all damage assessments with optional filters */
  list: protectedProcedure
    .input(z.object({
      country: z.string().optional(),
      fieldName: z.string().optional(),
      classification: z.string().optional(),
      repairStatus: z.string().optional(),
      priority: z.string().optional(),
      wellId: z.string().optional(),
      limit: z.number().min(1).max(200).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ input }) => {
      const key = cacheKey("damageAssessment", "list", { country: input?.country, field: input?.fieldName, class: input?.classification, status: input?.repairStatus, pri: input?.priority, well: input?.wellId, limit: input?.limit, offset: input?.offset });
      return withCache(key, TTL.DAMAGE_ASSESSMENT, async () => {
        const p = await pool();
        const rows = await p.query(
          `SELECT da.*,
                  COUNT(de.id)::int AS evidence_count,
                  COUNT(rt.id)::int AS ticket_count
           FROM damage_assessments da
           LEFT JOIN damage_evidence de ON de.assessment_id = da.id
           LEFT JOIN repair_tickets rt ON rt.assessment_id = da.id
           WHERE ($1::text IS NULL OR da.country = $1)
             AND ($2::text IS NULL OR da.field_name ILIKE '%' || $2 || '%')
             AND ($3::text IS NULL OR da.classification = $3)
             AND ($4::text IS NULL OR da.repair_status = $4)
             AND ($5::text IS NULL OR da.repair_priority = $5)
             AND ($6::text IS NULL OR da.well_id = $6)
           GROUP BY da.id
           ORDER BY da.triage_score DESC NULLS LAST, da.created_at DESC
           LIMIT $7 OFFSET $8`,
          [
            input?.country ?? null,
            input?.fieldName ?? null,
            input?.classification ?? null,
            input?.repairStatus ?? null,
            input?.priority ?? null,
            input?.wellId ?? null,
            input?.limit ?? 50,
            input?.offset ?? 0,
          ]
        );
        return rows.rows as Record<string, unknown>[];
      });
    }),

  /** Get a single assessment with evidence and repair tickets */
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const p = await pool();
      const [assessment, evidence, tickets] = await Promise.all([
        p.query(`SELECT * FROM damage_assessments WHERE id = $1`, [input.id]),
        p.query(`SELECT * FROM damage_evidence WHERE assessment_id = $1 ORDER BY created_at DESC`, [input.id]),
        p.query(`SELECT * FROM repair_tickets WHERE assessment_id = $1 ORDER BY priority, created_at`, [input.id]),
      ]);
      if (assessment.rows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Assessment not found" });
      }
      return {
        assessment: assessment.rows[0] as Record<string, unknown>,
        evidence: evidence.rows as Record<string, unknown>[],
        tickets: tickets.rows as Record<string, unknown>[],
      };
    }),

  /** Create a new damage assessment with automatic triage scoring */
  create: protectedProcedure
    .input(z.object({
      wellId: z.string().optional(),
      assetType: z.string(),
      assetName: z.string().min(2).max(256),
      assetTag: z.string().optional(),
      fieldName: z.string().optional(),
      country: z.string().default("Iraq"),
      coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
      classification: z.string().default("UNKNOWN"),
      cause: z.string().optional(),
      incidentDate: z.string().optional(),
      assessedBy: z.string().optional(),
      productionLossBpd: z.number().min(0).default(0),
      productionLossGasMmscfd: z.number().min(0).default(0),
      estimatedDowntimeDays: z.number().optional(),
      estimatedRepairCostUsd: z.number().optional(),
      estimatedReplacementCostUsd: z.number().optional(),
      description: z.string().optional(),
      hseRisk: z.boolean().default(false),
      environmentalRisk: z.boolean().default(false),
      accessSafe: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const { score, priority } = computeTriageScore({
        classification: input.classification,
        productionLossBpd: input.productionLossBpd,
        hseRisk: input.hseRisk,
        environmentalRisk: input.environmentalRisk,
      });

      const p = await pool();
      const assessmentId = generateAssessmentId();
      const result = await p.query(
        `INSERT INTO damage_assessments (
          assessment_id, well_id, asset_type, asset_name, asset_tag, field_name, country,
          coordinates, classification, cause, incident_date, assessed_by,
          production_loss_bpd, production_loss_gas_mmscfd, estimated_downtime_days,
          estimated_repair_cost_usd, estimated_replacement_cost_usd,
          triage_score, repair_priority, description,
          hse_risk, environmental_risk, access_safe,
          repair_status, created_by, updated_by
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,'PENDING_ASSESSMENT',$24,$24
        ) RETURNING *`,
        [
          assessmentId,
          input.wellId ?? null,
          input.assetType,
          input.assetName,
          input.assetTag ?? null,
          input.fieldName ?? null,
          input.country,
          input.coordinates ? JSON.stringify(input.coordinates) : null,
          input.classification,
          input.cause ?? null,
          input.incidentDate ? new Date(input.incidentDate) : null,
          input.assessedBy ?? ctx.user.name ?? null,
          input.productionLossBpd,
          input.productionLossGasMmscfd,
          input.estimatedDowntimeDays ?? null,
          input.estimatedRepairCostUsd ?? null,
          input.estimatedReplacementCostUsd ?? null,
          score,
          priority,
          input.description ?? null,
          input.hseRisk,
          input.environmentalRisk,
          input.accessSafe,
          ctx.user.name ?? "system",
        ]
      );
      return result.rows[0] as Record<string, unknown>;
    }),

  /** Update an existing assessment */
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      classification: z.string().optional(),
      cause: z.string().optional(),
      productionLossBpd: z.number().optional(),
      productionLossGasMmscfd: z.number().optional(),
      estimatedDowntimeDays: z.number().optional(),
      estimatedRepairCostUsd: z.number().optional(),
      estimatedReplacementCostUsd: z.number().optional(),
      description: z.string().optional(),
      hseRisk: z.boolean().optional(),
      environmentalRisk: z.boolean().optional(),
      accessSafe: z.boolean().optional(),
      repairStatus: z.string().optional(),
      assessedBy: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const p = await pool();
      const existing = await p.query(`SELECT * FROM damage_assessments WHERE id = $1`, [input.id]);
      if (existing.rows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Assessment not found" });
      }
      const row = existing.rows[0] as Record<string, unknown>;
      const { score, priority } = computeTriageScore({
        classification: (input.classification ?? row.classification) as string,
        productionLossBpd: input.productionLossBpd ?? (row.production_loss_bpd as number) ?? 0,
        hseRisk: input.hseRisk ?? (row.hse_risk as boolean) ?? false,
        environmentalRisk: input.environmentalRisk ?? (row.environmental_risk as boolean) ?? false,
      });

      const result = await p.query(
        `UPDATE damage_assessments SET
          classification = COALESCE($2, classification),
          cause = COALESCE($3, cause),
          production_loss_bpd = COALESCE($4, production_loss_bpd),
          production_loss_gas_mmscfd = COALESCE($5, production_loss_gas_mmscfd),
          estimated_downtime_days = COALESCE($6, estimated_downtime_days),
          estimated_repair_cost_usd = COALESCE($7, estimated_repair_cost_usd),
          estimated_replacement_cost_usd = COALESCE($8, estimated_replacement_cost_usd),
          description = COALESCE($9, description),
          hse_risk = COALESCE($10, hse_risk),
          environmental_risk = COALESCE($11, environmental_risk),
          access_safe = COALESCE($12, access_safe),
          repair_status = COALESCE($13, repair_status),
          assessed_by = COALESCE($14, assessed_by),
          triage_score = $15,
          repair_priority = $16,
          updated_by = $17,
          updated_at = NOW()
        WHERE id = $1 RETURNING *`,
        [
          input.id,
          input.classification ?? null,
          input.cause ?? null,
          input.productionLossBpd ?? null,
          input.productionLossGasMmscfd ?? null,
          input.estimatedDowntimeDays ?? null,
          input.estimatedRepairCostUsd ?? null,
          input.estimatedReplacementCostUsd ?? null,
          input.description ?? null,
          input.hseRisk ?? null,
          input.environmentalRisk ?? null,
          input.accessSafe ?? null,
          input.repairStatus ?? null,
          input.assessedBy ?? null,
          score,
          priority,
          ctx.user.name ?? "system",
        ]
      );
      return result.rows[0] as Record<string, unknown>;
    }),

  /** Generate AI triage summary and recommendations via LLM */
  generateAISummary: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const p = await pool();
      const existing = await p.query(`SELECT * FROM damage_assessments WHERE id = $1`, [input.id]);
      if (existing.rows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Assessment not found" });
      }
      const row = existing.rows[0] as Record<string, unknown>;

      const prompt = buildTriagePrompt({
        assetName: row.asset_name as string,
        assetType: row.asset_type as string,
        fieldName: row.field_name as string | null,
        country: row.country as string,
        classification: row.classification as string,
        cause: row.cause as string | null,
        productionLossBpd: (row.production_loss_bpd as number) ?? 0,
        productionLossGasMmscfd: (row.production_loss_gas_mmscfd as number) ?? 0,
        estimatedDowntimeDays: row.estimated_downtime_days as number | null,
        estimatedRepairCostUsd: row.estimated_repair_cost_usd as number | null,
        hseRisk: (row.hse_risk as boolean) ?? false,
        environmentalRisk: (row.environmental_risk as boolean) ?? false,
        accessSafe: (row.access_safe as boolean) ?? false,
        description: row.description as string | null,
        triageScore: (row.triage_score as number) ?? 0,
      });

      type AIResult = {
        summary: string;
        recommendations: { priority: string; action: string; rationale: string; timeframe: string }[];
        safetyConcerns: string[];
        timeline: { optimistic: string; realistic: string; pessimistic: string };
      };

      let aiResult: AIResult | null = null;

      try {
        const llmResponse = await invokeLLM({
          messages: [
            { role: "system", content: "You are an expert oil & gas infrastructure damage assessment engineer. Always respond with valid JSON only." },
            { role: "user", content: prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "damage_triage",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  summary: { type: "string" },
                  recommendations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        priority: { type: "string" },
                        action: { type: "string" },
                        rationale: { type: "string" },
                        timeframe: { type: "string" },
                      },
                      required: ["priority", "action", "rationale", "timeframe"],
                      additionalProperties: false,
                    },
                  },
                  safetyConcerns: { type: "array", items: { type: "string" } },
                  timeline: {
                    type: "object",
                    properties: {
                      optimistic: { type: "string" },
                      realistic: { type: "string" },
                      pessimistic: { type: "string" },
                    },
                    required: ["optimistic", "realistic", "pessimistic"],
                    additionalProperties: false,
                  },
                },
                required: ["summary", "recommendations", "safetyConcerns", "timeline"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = llmResponse?.choices?.[0]?.message?.content;
        if (content) {
          aiResult = typeof content === "string" ? JSON.parse(content) : content;
        }
      } catch (err) {
        console.error("[DamageAssessment] LLM call failed:", err);
      }

      // Deterministic fallback if LLM fails
      if (!aiResult) {
        aiResult = {
          summary: `${row.asset_name} in ${row.field_name ?? row.country} has been classified as ${row.classification} with a triage score of ${row.triage_score}/100. Immediate assessment and mobilization planning is recommended.`,
          recommendations: [
            { priority: "HIGH", action: "Conduct detailed structural inspection", rationale: "Verify extent of damage before committing repair resources", timeframe: "Within 48 hours" },
            { priority: "HIGH", action: "Isolate and secure the damaged asset", rationale: "Prevent secondary damage and ensure crew safety", timeframe: "Immediately" },
            { priority: "MEDIUM", action: "Procure replacement components and mobilize contractor", rationale: "Minimize production downtime", timeframe: "Within 2 weeks" },
          ],
          safetyConcerns: ["Verify structural integrity before crew entry", "Check for hydrocarbon leaks or gas pockets", "Confirm site security clearance"],
          timeline: { optimistic: "4 weeks", realistic: "8 weeks", pessimistic: "16 weeks" },
        };
      }

      // Save AI summary to DB
      await p.query(
        `UPDATE damage_assessments SET ai_summary = $2, ai_recommendations = $3, repair_status = 'ASSESSED', updated_at = NOW() WHERE id = $1`,
        [input.id, aiResult.summary, JSON.stringify(aiResult.recommendations)]
      );

      return { ...aiResult, triageScore: row.triage_score, assessmentId: row.assessment_id };
    }),

  /** Add a repair ticket to an assessment */
  createRepairTicket: protectedProcedure
    .input(z.object({
      assessmentId: z.number(),
      title: z.string().min(3).max(256),
      scope: z.string().optional(),
      contractor: z.string().optional(),
      estimatedCostUsd: z.number().optional(),
      plannedStartDate: z.string().optional(),
      plannedEndDate: z.string().optional(),
      priority: z.string().default("MEDIUM"),
      assignedTo: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const p = await pool();
      const ticketId = generateTicketId();
      const result = await p.query(
        `INSERT INTO repair_tickets (
          ticket_id, assessment_id, title, scope, contractor,
          estimated_cost_usd, planned_start_date, planned_end_date,
          priority, assigned_to, notes, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [
          ticketId,
          input.assessmentId,
          input.title,
          input.scope ?? null,
          input.contractor ?? null,
          input.estimatedCostUsd ?? null,
          input.plannedStartDate ? new Date(input.plannedStartDate) : null,
          input.plannedEndDate ? new Date(input.plannedEndDate) : null,
          input.priority,
          input.assignedTo ?? null,
          input.notes ?? null,
          ctx.user.name ?? "system",
        ]
      );
      return result.rows[0] as Record<string, unknown>;
    }),

  /** Update repair ticket status */
  updateTicketStatus: protectedProcedure
    .input(z.object({
      ticketId: z.number(),
      status: z.string(),
      actualCostUsd: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const p = await pool();
      const result = await p.query(
        `UPDATE repair_tickets SET
          status = $2,
          actual_cost_usd = COALESCE($3, actual_cost_usd),
          notes = COALESCE($4, notes),
          actual_start_date = CASE WHEN $2 = 'IN_PROGRESS' AND actual_start_date IS NULL THEN NOW() ELSE actual_start_date END,
          actual_end_date = CASE WHEN $2 = 'COMPLETED' THEN NOW() ELSE actual_end_date END,
          updated_at = NOW()
        WHERE id = $1 RETURNING *`,
        [input.ticketId, input.status, input.actualCostUsd ?? null, input.notes ?? null]
      );
      return result.rows[0] as Record<string, unknown>;
    }),

  /** Dashboard summary: counts by classification, total production loss, cost estimates */
  getDashboardSummary: protectedProcedure.query(async () => {
    const p = await pool();
    const [counts, totals, byCountry, recentCritical] = await Promise.all([
      p.query(`
        SELECT classification, COUNT(*)::int as count
        FROM damage_assessments
        GROUP BY classification
        ORDER BY count DESC
      `),
      p.query(`
        SELECT
          COUNT(*)::int AS total_assessments,
          COALESCE(SUM(production_loss_bpd), 0) AS total_production_loss_bpd,
          COALESCE(SUM(production_loss_gas_mmscfd), 0) AS total_production_loss_gas,
          COALESCE(SUM(estimated_repair_cost_usd), 0) AS total_repair_cost_usd,
          COUNT(CASE WHEN hse_risk = TRUE THEN 1 END)::int AS hse_risk_count,
          COUNT(CASE WHEN repair_status = 'COMPLETED' THEN 1 END)::int AS completed_count,
          COUNT(CASE WHEN repair_priority = 'CRITICAL' THEN 1 END)::int AS critical_count,
          ROUND(AVG(triage_score)::numeric, 1) AS avg_triage_score
        FROM damage_assessments
      `),
      p.query(`
        SELECT country, COUNT(*)::int as count, COALESCE(SUM(production_loss_bpd), 0) as total_loss_bpd
        FROM damage_assessments
        GROUP BY country
        ORDER BY count DESC
      `),
      p.query(`
        SELECT assessment_id, asset_name, field_name, country, classification, triage_score, repair_priority, repair_status, created_at
        FROM damage_assessments
        WHERE repair_priority IN ('CRITICAL','HIGH')
          AND repair_status NOT IN ('COMPLETED','CANCELLED')
        ORDER BY triage_score DESC
        LIMIT 10
      `),
    ]);

    return {
      byClassification: counts.rows as { classification: string; count: number }[],
      totals: totals.rows[0] as Record<string, unknown>,
      byCountry: byCountry.rows as { country: string; count: number; total_loss_bpd: number }[],
      recentCritical: recentCritical.rows as Record<string, unknown>[],
    };
  }),

  /** Seed demo data for Middle East conflict zones */
  seedDemoData: protectedProcedure.mutation(async ({ ctx }) => {
    const demos = [
      {
        id: generateAssessmentId(), assetType: "WELLHEAD", assetName: "Well RUM-14 Wellhead Assembly",
        fieldName: "Rumaila North", country: "Iraq", coords: { lat: 30.4, lng: 47.5 },
        classification: "SEVERELY_DAMAGED", cause: "BLAST_OVERPRESSURE",
        prodLoss: 2800, gasLoss: 0.8, downtime: 45, repairCost: 1_200_000,
        desc: "Wellhead Christmas tree damaged by blast overpressure. Tubing hanger integrity compromised. Wellhead pressure gauge destroyed. Emergency shut-in valve actuated successfully.",
        hse: true, env: true, access: false,
      },
      {
        id: generateAssessmentId(), assetType: "PIPELINE", assetName: "Rumaila–Basra Export Pipeline KP 14.2",
        fieldName: "Rumaila", country: "Iraq", coords: { lat: 30.2, lng: 47.6 },
        classification: "DESTROYED", cause: "DIRECT_STRIKE",
        prodLoss: 12000, gasLoss: 0, downtime: 90, repairCost: 8_500_000,
        desc: "24-inch export pipeline breached by direct munitions strike. Approximately 40 meters of pipe destroyed. Significant crude oil release to surrounding area. Fire suppressed.",
        hse: true, env: true, access: false,
      },
      {
        id: generateAssessmentId(), assetType: "SEPARATOR", assetName: "Train 3 Three-Phase Separator",
        fieldName: "West Qurna", country: "Iraq", coords: { lat: 30.8, lng: 47.2 },
        classification: "MODERATELY_DAMAGED", cause: "SHRAPNEL",
        prodLoss: 1500, gasLoss: 2.1, downtime: 21, repairCost: 450_000,
        desc: "Shrapnel damage to separator vessel shell and instrumentation. Pressure relief valve inoperable. Level transmitters destroyed. Vessel integrity requires pressure test before restart.",
        hse: true, env: false, access: true,
      },
      {
        id: generateAssessmentId(), assetType: "PUMP_STATION", assetName: "Water Injection Pump Station WI-07",
        fieldName: "Majnoon", country: "Iraq", coords: { lat: 31.5, lng: 47.8 },
        classification: "SEVERELY_DAMAGED", cause: "SABOTAGE",
        prodLoss: 3200, gasLoss: 0, downtime: 30, repairCost: 2_100_000,
        desc: "Pump station control panel and electrical switchgear destroyed. Three of four injection pumps non-operational. Reservoir pressure support compromised, affecting 3,200 BPD of associated production.",
        hse: false, env: false, access: true,
      },
      {
        id: generateAssessmentId(), assetType: "CONTROL_ROOM", assetName: "Field Control Room FCR-Alpha",
        fieldName: "Halfaya", country: "Iraq", coords: { lat: 31.2, lng: 47.4 },
        classification: "DESTROYED", cause: "DIRECT_STRIKE",
        prodLoss: 8500, gasLoss: 1.5, downtime: 60, repairCost: 5_000_000,
        desc: "Field control room completely destroyed. All SCADA servers, HMI stations, and communications equipment lost. Manual operation of wellheads required. 34 wells currently unmonitored.",
        hse: true, env: false, access: false,
      },
      {
        id: generateAssessmentId(), assetType: "STORAGE_TANK", assetName: "Crude Storage Tank T-12 (50,000 bbl)",
        fieldName: "Kirkuk", country: "Iraq", coords: { lat: 35.5, lng: 44.4 },
        classification: "SEVERELY_DAMAGED", cause: "FIRE",
        prodLoss: 0, gasLoss: 0, downtime: 120, repairCost: 3_800_000,
        desc: "50,000 bbl floating-roof crude storage tank severely damaged by fire. Roof collapsed. Approximately 18,000 bbls of crude lost to fire. Tank shell integrity questionable.",
        hse: true, env: true, access: false,
      },
      {
        id: generateAssessmentId(), assetType: "WELLHEAD", assetName: "Well KW-22 Wellhead",
        fieldName: "Kirkuk", country: "Iraq", coords: { lat: 35.4, lng: 44.3 },
        classification: "MINOR_DAMAGE", cause: "SHRAPNEL",
        prodLoss: 180, gasLoss: 0.1, downtime: 5, repairCost: 45_000,
        desc: "Minor shrapnel damage to wellhead casing spool. Surface casing integrity intact. Pressure gauges and flow meter damaged. Well shut-in as precaution pending inspection.",
        hse: false, env: false, access: true,
      },
      {
        id: generateAssessmentId(), assetType: "PIPELINE", assetName: "Kirkuk–Ceyhan Pipeline KP 42.7",
        fieldName: "Kirkuk", country: "Iraq", coords: { lat: 35.6, lng: 43.8 },
        classification: "MODERATELY_DAMAGED", cause: "BLAST_OVERPRESSURE",
        prodLoss: 0, gasLoss: 0, downtime: 14, repairCost: 620_000,
        desc: "36-inch export pipeline dented and coating damaged over 15-meter section. No breach detected. Pig run required to verify internal integrity. Export operations suspended pending inspection.",
        hse: false, env: false, access: true,
      },
      {
        id: generateAssessmentId(), assetType: "COMPRESSOR_STATION", assetName: "Gas Compression Station GCS-3",
        fieldName: "South Pars", country: "Iran", coords: { lat: 27.2, lng: 52.6 },
        classification: "MODERATELY_DAMAGED", cause: "SECONDARY_DAMAGE",
        prodLoss: 0, gasLoss: 4.5, downtime: 28, repairCost: 1_800_000,
        desc: "Secondary blast damage to gas compression station. Two of three compressor units offline. Gas flaring increased significantly. Pipeline pressure below minimum operating requirements.",
        hse: true, env: true, access: true,
      },
      {
        id: generateAssessmentId(), assetType: "WELLHEAD", assetName: "Well GH-07 Wellhead",
        fieldName: "Ghawar", country: "Saudi Arabia", coords: { lat: 25.1, lng: 49.3 },
        classification: "INTACT", cause: null,
        prodLoss: 0, gasLoss: 0, downtime: 0, repairCost: 0,
        desc: "Precautionary inspection completed. No damage detected. Well operating normally. Added to assessment register for completeness.",
        hse: false, env: false, access: true,
      },
    ];

    const p = await pool();
    const inserted: number[] = [];
    for (const d of demos) {
      const { score, priority } = computeTriageScore({
        classification: d.classification,
        productionLossBpd: d.prodLoss,
        hseRisk: d.hse,
        environmentalRisk: d.env,
      });
      try {
        const r = await p.query(
          `INSERT INTO damage_assessments (
            assessment_id, asset_type, asset_name, field_name, country,
            coordinates, classification, cause, production_loss_bpd, production_loss_gas_mmscfd,
            estimated_downtime_days, estimated_repair_cost_usd, triage_score, repair_priority,
            description, hse_risk, environmental_risk, access_safe,
            repair_status, assessed_by, created_by, updated_by
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'ASSESSED',$19,$19,$19)
          ON CONFLICT (assessment_id) DO NOTHING RETURNING id`,
          [
            d.id, d.assetType, d.assetName, d.fieldName, d.country,
            JSON.stringify(d.coords), d.classification, d.cause,
            d.prodLoss, d.gasLoss, d.downtime, d.repairCost,
            score, priority, d.desc, d.hse, d.env, d.access,
            ctx.user.name ?? "demo-seed",
          ]
        );
        if (r.rows.length > 0) inserted.push(r.rows[0].id as number);
      } catch (_) { /* skip duplicates */ }
    }
    return { inserted: inserted.length, message: `Seeded ${inserted.length} demo damage assessments` };
  }),

  // ── OCHA Sitrep Generation (Ollama LLM) ─────────────────────────────────────

  generateOCHAReport: protectedProcedure
    .input(z.object({
      fieldName: z.string(),
      country: z.string().default("Iraq"),
    }))
    .mutation(async ({ input }) => {
      const p = await pool();
      const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://localhost:4003";

      // Aggregate stats from DB
      const stats = await p.query(
        `SELECT
           COUNT(*) FILTER (WHERE damage_classification = 'DESTROYED') AS destroyed,
           COUNT(*) FILTER (WHERE damage_classification = 'SEVERELY_DAMAGED') AS severely_damaged,
           COUNT(*) FILTER (WHERE damage_classification = 'MODERATELY_DAMAGED') AS moderately_damaged,
           COUNT(*) FILTER (WHERE damage_classification = 'MINOR_DAMAGE') AS minor_damage,
           COUNT(*) FILTER (WHERE damage_classification = 'INTACT') AS intact,
           COUNT(*) AS total_assets,
           COALESCE(SUM(production_loss_bpd), 0) AS total_production_loss,
           COALESCE(SUM(estimated_repair_cost_usd), 0) AS total_repair_cost
         FROM damage_assessments
         WHERE field_name ILIKE $1`,
        [`%${input.fieldName}%`]
      );

      const row = stats.rows[0];
      const reportDate = new Date().toISOString().split("T")[0];

      // Key findings from most critical assessments
      const findings = await p.query(
        `SELECT asset_name, damage_classification, description
         FROM damage_assessments
         WHERE field_name ILIKE $1 AND damage_classification IN ('DESTROYED','SEVERELY_DAMAGED')
         ORDER BY triage_score DESC LIMIT 5`,
        [`%${input.fieldName}%`]
      );
      const keyFindings = findings.rows.map(
        (r: Record<string, string>) => `${r.asset_name}: ${r.damage_classification} — ${r.description ?? "No description"}`
      );

      // Call ML service (Ollama LLM)
      try {
        const mlResponse = await fetch(`${ML_SERVICE_URL}/generate-ocha-report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            field_name: input.fieldName,
            country: input.country,
            report_date: reportDate,
            total_assets: parseInt(row.total_assets),
            destroyed: parseInt(row.destroyed),
            severely_damaged: parseInt(row.severely_damaged),
            moderately_damaged: parseInt(row.moderately_damaged),
            minor_damage: parseInt(row.minor_damage),
            intact: parseInt(row.intact),
            estimated_production_loss_bpd: parseFloat(row.total_production_loss),
            estimated_repair_cost_usd: parseFloat(row.total_repair_cost),
            access_status: "RESTRICTED",
            key_findings: keyFindings,
          }),
        });
        if (!mlResponse.ok) throw new Error(`ML service ${mlResponse.status}`);
        const data = await mlResponse.json() as { sitrep: Record<string, unknown>; model: string };
        return {
          sitrep: data.sitrep,
          model: data.model,
          stats: row,
          reportDate,
          fieldName: input.fieldName,
          country: input.country,
        };
      } catch (err) {
        // Fallback: use Manus built-in LLM
        const llmResp = await invokeLLM({
          messages: [
            { role: "system", content: "You are a UN OCHA humanitarian affairs officer. Generate a concise Situation Report for oil & gas infrastructure damage." },
            { role: "user", content: `Field: ${input.fieldName}, ${input.country}. Date: ${reportDate}. Total: ${row.total_assets} assets. Destroyed: ${row.destroyed}. Severely damaged: ${row.severely_damaged}. Production loss: ${row.total_production_loss} bpd. Repair cost: USD ${row.total_repair_cost}. Key findings: ${keyFindings.join("; ")}.` },
          ],
        });
        const narrative = (llmResp as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content ?? "Report generation failed";
        return {
          sitrep: { situation_overview: narrative, sitrep_number: "SITREP-001", classification: "UNCLASSIFIED" },
          model: "manus-builtin-llm",
          stats: row,
          reportDate,
          fieldName: input.fieldName,
          country: input.country,
        };
      }
    }),

  // ── Repair Cost Estimation (Ollama LLM + reference table) ───────────────────

  estimateRepairCost: protectedProcedure
    .input(z.object({
      assetType: z.string(),
      damageSeverity: z.string(),
      country: z.string().default("Iraq"),
      context: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://localhost:4003";
      try {
        const response = await fetch(`${ML_SERVICE_URL}/estimate-repair-cost`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            asset_type: input.assetType,
            damage_severity: input.damageSeverity,
            location_country: input.country,
            additional_context: input.context,
          }),
        });
        if (!response.ok) throw new Error(`ML service ${response.status}`);
        return await response.json();
      } catch {
        // Fallback reference table
        const refCosts: Record<string, Record<string, { labor_days: number; labor_rate: number; materials: number; mobilization: number }>> = {
          WELLHEAD:     { DESTROYED: { labor_days: 45, labor_rate: 1200, materials: 850000,  mobilization: 120000 }, SEVERELY_DAMAGED: { labor_days: 25, labor_rate: 1200, materials: 350000, mobilization: 80000 }, MODERATELY_DAMAGED: { labor_days: 12, labor_rate: 1000, materials: 120000, mobilization: 45000 }, MINOR_DAMAGE: { labor_days: 4, labor_rate: 900, materials: 25000, mobilization: 15000 } },
          PIPELINE:     { DESTROYED: { labor_days: 60, labor_rate: 1100, materials: 1200000, mobilization: 150000 }, SEVERELY_DAMAGED: { labor_days: 30, labor_rate: 1100, materials: 450000, mobilization: 90000 }, MODERATELY_DAMAGED: { labor_days: 14, labor_rate: 950, materials: 180000, mobilization: 55000 }, MINOR_DAMAGE: { labor_days: 5, labor_rate: 850, materials: 40000, mobilization: 20000 } },
          SEPARATOR:    { DESTROYED: { labor_days: 50, labor_rate: 1300, materials: 2500000, mobilization: 180000 }, SEVERELY_DAMAGED: { labor_days: 28, labor_rate: 1300, materials: 800000, mobilization: 100000 }, MODERATELY_DAMAGED: { labor_days: 10, labor_rate: 1100, materials: 250000, mobilization: 60000 }, MINOR_DAMAGE: { labor_days: 3, labor_rate: 1000, materials: 50000, mobilization: 20000 } },
          PUMP_STATION: { DESTROYED: { labor_days: 40, labor_rate: 1200, materials: 1800000, mobilization: 140000 }, SEVERELY_DAMAGED: { labor_days: 22, labor_rate: 1200, materials: 600000, mobilization: 85000 }, MODERATELY_DAMAGED: { labor_days: 10, labor_rate: 1000, materials: 200000, mobilization: 50000 }, MINOR_DAMAGE: { labor_days: 3, labor_rate: 900, materials: 45000, mobilization: 18000 } },
          STORAGE_TANK: { DESTROYED: { labor_days: 35, labor_rate: 1100, materials: 1500000, mobilization: 120000 }, SEVERELY_DAMAGED: { labor_days: 20, labor_rate: 1100, materials: 500000, mobilization: 75000 }, MODERATELY_DAMAGED: { labor_days: 8, labor_rate: 950, materials: 150000, mobilization: 40000 }, MINOR_DAMAGE: { labor_days: 2, labor_rate: 850, materials: 30000, mobilization: 12000 } },
          CONTROL_ROOM: { DESTROYED: { labor_days: 30, labor_rate: 1400, materials: 3000000, mobilization: 100000 }, SEVERELY_DAMAGED: { labor_days: 18, labor_rate: 1400, materials: 900000, mobilization: 70000 }, MODERATELY_DAMAGED: { labor_days: 8, labor_rate: 1200, materials: 300000, mobilization: 45000 }, MINOR_DAMAGE: { labor_days: 2, labor_rate: 1100, materials: 60000, mobilization: 15000 } },
        };
        const ref = refCosts[input.assetType]?.[input.damageSeverity] ?? { labor_days: 20, labor_rate: 1000, materials: 500000, mobilization: 80000 };
        const laborCost = ref.labor_days * ref.labor_rate;
        const subtotal = laborCost + ref.materials + ref.mobilization;
        const total = subtotal * 1.20;
        return {
          labor_days: ref.labor_days,
          labor_cost_usd: laborCost,
          material_cost_usd: ref.materials,
          mobilization_cost_usd: ref.mobilization,
          contingency_pct: 20,
          total_cost_usd: total,
          basis_of_estimate: `Reference cost estimate for ${input.assetType} (${input.damageSeverity}) in ${input.country}. 20% conflict-zone contingency applied.`,
          confidence: "LOW",
        };
      }
    }),

  // ── Contractor Registry ──────────────────────────────────────────────────────

  listContractors: protectedProcedure
    .input(z.object({
      country: z.string().optional(),
      specialization: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const p = await pool();
      let query = "SELECT * FROM contractors WHERE is_active = true";
      const params: string[] = [];
      if (input.country) {
        params.push(input.country);
        query += ` AND $${params.length} = ANY(operating_countries)`;
      }
      if (input.specialization) {
        params.push(input.specialization);
        query += ` AND specialization = $${params.length}`;
      }
      query += " ORDER BY mobilization_days_min ASC";
      const result = await p.query(query, params);
      return { contractors: result.rows };
    }),

  // ── Match Contractors to a Damage Assessment ─────────────────────────────────

  matchContractors: protectedProcedure
    .input(z.object({
      assessmentId: z.number(),
    }))
    .query(async ({ input }) => {
      const p = await pool();
      const assessment = await p.query(
        "SELECT * FROM damage_assessments WHERE id = $1",
        [input.assessmentId]
      );
      if (!assessment.rows.length) throw new TRPCError({ code: "NOT_FOUND", message: "Assessment not found" });
      const a = assessment.rows[0] as Record<string, string>;

      // Match contractors by country and asset type specialization
      const contractors = await p.query(
        `SELECT c.*,
           c.mobilization_days_min AS eta_days,
           c.day_rate_usd * 30 AS estimated_30day_cost
         FROM contractors c
         WHERE c.is_active = true
           AND ($1 = ANY(c.operating_countries) OR 'GLOBAL' = ANY(c.operating_countries))
         ORDER BY c.mobilization_days_min ASC
         LIMIT 8`,
        [a.country ?? "Iraq"]
      );

      return {
        assessment: a,
        contractors: contractors.rows,
        matchedBy: { country: a.country, assetType: a.asset_type },
      };
    }),

  // ── List Damage Images for an Assessment ─────────────────────────────────────

  listImages: protectedProcedure
    .input(z.object({ assessmentId: z.number() }))
    .query(async ({ input }) => {
      const p = await pool();
      const result = await p.query(
        "SELECT * FROM damage_images WHERE assessment_id = $1 ORDER BY created_at DESC",
        [input.assessmentId]
      );
      return { images: result.rows };
    }),

  // ── Assign Contractor to Repair Ticket ───────────────────────────────────────

  assignContractor: protectedProcedure
    .input(z.object({
      ticketId: z.number(),
      contractorId: z.number(),
      assignmentNotes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const p = await pool();

      // Get contractor details
      const contractorRes = await p.query(
        "SELECT * FROM contractors WHERE id = $1",
        [input.contractorId]
      );
      if (contractorRes.rows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Contractor not found" });
      }
      const contractor = contractorRes.rows[0];

      // Get ticket details
      const ticketRes = await p.query(
        `SELECT rt.*, da.asset_name, da.field_name, da.country
         FROM repair_tickets rt
         JOIN damage_assessments da ON da.id = rt.assessment_id
         WHERE rt.id = $1`,
        [input.ticketId]
      );
      if (ticketRes.rows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Repair ticket not found" });
      }
      const ticket = ticketRes.rows[0];

      // Update ticket
      await p.query(
        `UPDATE repair_tickets
         SET assigned_contractor_id = $1,
             contractor = $2,
             assignment_notes = $3,
             assigned_at = NOW(),
             status = CASE WHEN status = 'PENDING_ASSESSMENT' OR status = 'ASSESSED' THEN 'APPROVED'::repair_status ELSE status END,
             updated_at = NOW()
         WHERE id = $4`,
        [
          input.contractorId,
          contractor.company_name,
          input.assignmentNotes ?? null,
          input.ticketId,
        ]
      );

      // Send owner notification
      try {
        const { notifyOwner } = await import("../_core/notification");
        await notifyOwner({
          title: `Contractor Assigned — ${ticket.ticket_id}`,
          content: `**${contractor.company_name}** (${contractor.hq_country}) has been assigned to repair ticket **${ticket.ticket_id}**: ${ticket.title}\n\nAsset: ${ticket.asset_name}, ${ticket.field_name}, ${ticket.country}\nMobilisation: ${contractor.mobilization_days_min}–${contractor.mobilization_days_max} days\nDay rate: $${contractor.day_rate_usd?.toLocaleString()}/day${input.assignmentNotes ? `\n\nNotes: ${input.assignmentNotes}` : ""}`,
        });
      } catch {
        // Non-fatal — notification failure should not block assignment
      }

      return {
        success: true,
        ticketId: input.ticketId,
        contractorId: input.contractorId,
        contractorName: contractor.company_name,
        message: `${contractor.company_name} assigned to ${ticket.ticket_id}`,
      };
    }),

  // ── List Repair Tickets for an Assessment ────────────────────────────────────

  listRepairTickets: protectedProcedure
    .input(z.object({ assessmentId: z.number() }))
    .query(async ({ input }) => {
      const p = await pool();
      const result = await p.query(
        `SELECT rt.*,
                c.company_name AS contractor_company,
                c.hq_country AS contractor_country,
                c.contact_email AS contractor_email
         FROM repair_tickets rt
         LEFT JOIN contractors c ON c.id = rt.assigned_contractor_id
         WHERE rt.assessment_id = $1
         ORDER BY rt.priority, rt.created_at`,
        [input.assessmentId]
      );
      return { tickets: result.rows };
    }),
});

// ── Alert Thresholds Router ───────────────────────────────────────────────────

export const alertThresholdsRouter = router({
  getThresholds: protectedProcedure
    .input(z.object({ wellId: z.number() }))
    .query(async ({ input }) => {
      const p = await pool();
      const result = await p.query(
        "SELECT * FROM alert_thresholds WHERE well_id = $1 ORDER BY sensor_type",
        [input.wellId]
      );
      return { thresholds: result.rows };
    }),

  setThreshold: protectedProcedure
    .input(z.object({
      wellId: z.number(),
      sensorType: z.string(),
      minValue: z.number().nullable().optional(),
      maxValue: z.number().nullable().optional(),
      severity: z.enum(["WARNING", "CRITICAL", "INFO"]).default("WARNING"),
      enabled: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      const p = await pool();
      await p.query(
        `INSERT INTO alert_thresholds (well_id, sensor_type, min_value, max_value, severity, enabled, created_by, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (well_id, sensor_type)
         DO UPDATE SET
           min_value = EXCLUDED.min_value,
           max_value = EXCLUDED.max_value,
           severity = EXCLUDED.severity,
           enabled = EXCLUDED.enabled,
           updated_at = NOW()`,
        [
          input.wellId,
          input.sensorType,
          input.minValue ?? null,
          input.maxValue ?? null,
          input.severity,
          input.enabled,
          ctx.user?.name ?? "system",
        ]
      );
      return { success: true };
    }),

  deleteThreshold: adminProcedure
    .input(z.object({ wellId: z.number(), sensorType: z.string() }))
    .mutation(async ({ input }) => {
      const p = await pool();
      await p.query(
        "DELETE FROM alert_thresholds WHERE well_id = $1 AND sensor_type = $2",
        [input.wellId, input.sensorType]
      );
      return { success: true };
    }),

  checkThresholds: protectedProcedure
    .input(z.object({ wellId: z.number(), readings: z.record(z.string(), z.number()) }))
    .query(async ({ input }) => {
      const p = await pool();
      const result = await p.query(
        "SELECT * FROM alert_thresholds WHERE well_id = $1 AND enabled = TRUE",
        [input.wellId]
      );
      const violations: Array<{ sensorType: string; value: number; threshold: string; severity: string }> = [];
      for (const threshold of result.rows) {
        const value = input.readings[threshold.sensor_type];
        if (value === undefined || value === null) continue;
        const minVal = threshold.min_value as number | null;
        const maxVal = threshold.max_value as number | null;
        if (minVal !== null && (value as number) < minVal) {
          violations.push({ sensorType: threshold.sensor_type as string, value: value as number, threshold: `< ${minVal}`, severity: threshold.severity as string });
        }
        if (maxVal !== null && (value as number) > maxVal) {
          violations.push({ sensorType: threshold.sensor_type as string, value: value as number, threshold: `> ${maxVal}`, severity: threshold.severity as string });
        }
      }
      return { violations, checked: result.rows.length };
    }),
});
