import { TRPCError } from "@trpc/server";
/**
 * silCertification router — IEC 61511 / TÜV SIL Certification Roadmap
 *
 * Manages SIL assessments, control clause tracking, and gap analysis
 * for functional safety certification of the OG-RMM platform.
 *
 * Standard references:
 *   - IEC 61511-1:2016 — Functional Safety: Safety Instrumented Systems
 *   - IEC 61511-2:2016 — Guidelines for the application of IEC 61511-1
 *   - IEC 61511-3:2016 — Guidance for the determination of required SIL
 *   - TÜV SÜD Functional Safety Assessment methodology
 */

import { z } from "zod";
import { desc, eq, and } from "drizzle-orm";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  silAssessments,
  silControls,
  silGaps,
} from "../../drizzle/schema";

// ─── IEC 61511 CONTROL LIBRARY ────────────────────────────────────────────────
// 45 key clauses from IEC 61511-1:2016 mapped to SIL applicability

const IEC_61511_CONTROLS = [
  // Management of Functional Safety
  { clauseRef: "§5.1", controlTitle: "Safety Management System", category: "Management", silApplicability: "All", controlDescription: "Establish and maintain a safety management system covering the full SIS lifecycle." },
  { clauseRef: "§5.2", controlTitle: "Competency Management", category: "Management", silApplicability: "All", controlDescription: "Define and verify competency requirements for all personnel involved in SIS activities." },
  { clauseRef: "§5.3", controlTitle: "Safety Planning", category: "Management", silApplicability: "All", controlDescription: "Produce a safety plan covering all lifecycle phases and activities." },
  { clauseRef: "§5.4", controlTitle: "Documentation and Configuration Management", category: "Management", silApplicability: "All", controlDescription: "Establish document control and configuration management for all SIS artefacts." },
  { clauseRef: "§5.5", controlTitle: "Management of Change", category: "Management", silApplicability: "All", controlDescription: "Implement a formal management of change process for all SIS modifications." },
  { clauseRef: "§5.6", controlTitle: "Functional Safety Audit", category: "Management", silApplicability: "SIL 2-4", controlDescription: "Conduct independent functional safety audits at defined lifecycle stages." },
  { clauseRef: "§5.7", controlTitle: "Functional Safety Assessment", category: "Management", silApplicability: "SIL 1-4", controlDescription: "Perform formal functional safety assessments by a competent assessor." },

  // Hazard and Risk Assessment
  { clauseRef: "§8.2", controlTitle: "Hazard Identification (HAZOP/LOPA)", category: "Risk Assessment", silApplicability: "All", controlDescription: "Conduct systematic hazard identification using HAZOP or equivalent methodology." },
  { clauseRef: "§8.3", controlTitle: "Risk Assessment and Tolerable Risk", category: "Risk Assessment", silApplicability: "All", controlDescription: "Define tolerable risk criteria and assess risk against them." },
  { clauseRef: "§8.4", controlTitle: "SIL Determination (LOPA/Risk Graph)", category: "Risk Assessment", silApplicability: "All", controlDescription: "Determine required SIL for each Safety Instrumented Function (SIF) using LOPA or risk graph." },

  // Safety Requirements Specification
  { clauseRef: "§9.2", controlTitle: "Safety Requirements Specification (SRS)", category: "Design", silApplicability: "All", controlDescription: "Produce a complete SRS for each SIF including process demand, SIL, response time, and diagnostics." },
  { clauseRef: "§9.3", controlTitle: "SIS Architecture Definition", category: "Design", silApplicability: "All", controlDescription: "Define SIS architecture including redundancy, voting, and diagnostic coverage." },
  { clauseRef: "§9.4", controlTitle: "Hardware Fault Tolerance (HFT)", category: "Design", silApplicability: "SIL 1-4", controlDescription: "Verify hardware fault tolerance meets IEC 61511 Table 5 requirements for target SIL." },

  // SIS Design and Engineering
  { clauseRef: "§10.2", controlTitle: "Sensor Selection and Qualification", category: "Design", silApplicability: "All", controlDescription: "Select and qualify sensors with appropriate SIL capability and diagnostic coverage." },
  { clauseRef: "§10.3", controlTitle: "Logic Solver Selection and Qualification", category: "Design", silApplicability: "All", controlDescription: "Select and qualify logic solver (SIS controller) with SIL-rated hardware and software." },
  { clauseRef: "§10.4", controlTitle: "Final Element Selection and Qualification", category: "Design", silApplicability: "All", controlDescription: "Select and qualify final elements (valves, actuators) with appropriate SIL capability." },
  { clauseRef: "§10.5", controlTitle: "Common Cause Failure (CCF) Analysis", category: "Design", silApplicability: "SIL 2-4", controlDescription: "Perform CCF analysis using IEC 61511 Annex D methodology (β-factor model)." },
  { clauseRef: "§10.6", controlTitle: "Systematic Capability Assessment", category: "Design", silApplicability: "All", controlDescription: "Verify systematic capability (SC) of all SIS components meets or exceeds target SIL." },
  { clauseRef: "§10.7", controlTitle: "PFD Calculation (Quantitative)", category: "Design", silApplicability: "All", controlDescription: "Calculate PFDavg for each SIF using Markov analysis or simplified equations." },
  { clauseRef: "§10.8", controlTitle: "Proof Test Interval Definition", category: "Design", silApplicability: "All", controlDescription: "Define proof test intervals and procedures to maintain target SIL over operational life." },

  // SIS Software
  { clauseRef: "§11.2", controlTitle: "Application Software Safety Requirements", category: "Software", silApplicability: "All", controlDescription: "Define software safety requirements including response time, data integrity, and error handling." },
  { clauseRef: "§11.3", controlTitle: "Software Design and Development", category: "Software", silApplicability: "All", controlDescription: "Develop SIS application software using structured methods with version control and review." },
  { clauseRef: "§11.4", controlTitle: "Software Module Testing", category: "Software", silApplicability: "All", controlDescription: "Perform module-level testing of all SIS software functions with documented test cases." },
  { clauseRef: "§11.5", controlTitle: "Software Integration Testing", category: "Software", silApplicability: "All", controlDescription: "Perform integration testing of SIS software with hardware-in-the-loop (HIL) testing." },

  // Factory Acceptance Testing
  { clauseRef: "§12.2", controlTitle: "Factory Acceptance Test (FAT)", category: "Verification", silApplicability: "All", controlDescription: "Conduct FAT for all SIS components against SRS requirements with witnessed testing." },
  { clauseRef: "§12.3", controlTitle: "FAT Documentation and Traceability", category: "Verification", silApplicability: "All", controlDescription: "Document FAT results with full traceability to SRS requirements." },

  // Installation and Commissioning
  { clauseRef: "§13.2", controlTitle: "SIS Installation Verification", category: "Commissioning", silApplicability: "All", controlDescription: "Verify SIS installation against design drawings and specifications." },
  { clauseRef: "§13.3", controlTitle: "Pre-Startup Safety Review (PSSR)", category: "Commissioning", silApplicability: "All", controlDescription: "Conduct PSSR before SIS startup to verify readiness for operation." },
  { clauseRef: "§13.4", controlTitle: "Site Acceptance Test (SAT)", category: "Commissioning", silApplicability: "All", controlDescription: "Perform SAT including end-to-end functional testing of all SIFs in the field." },

  // Operation and Maintenance
  { clauseRef: "§14.2", controlTitle: "Operations and Maintenance Procedures", category: "Operations", silApplicability: "All", controlDescription: "Establish O&M procedures for SIS including bypass management and proof testing." },
  { clauseRef: "§14.3", controlTitle: "Proof Test Execution and Recording", category: "Operations", silApplicability: "All", controlDescription: "Execute proof tests per defined intervals and record results for SIL verification." },
  { clauseRef: "§14.4", controlTitle: "SIS Bypass Management", category: "Operations", silApplicability: "All", controlDescription: "Implement formal bypass management with compensating measures and time limits." },
  { clauseRef: "§14.5", controlTitle: "Demand Rate Monitoring", category: "Operations", silApplicability: "SIL 2-4", controlDescription: "Monitor actual SIF demand rate against design assumptions; review if exceeded." },
  { clauseRef: "§14.6", controlTitle: "Failure Data Collection and Analysis", category: "Operations", silApplicability: "All", controlDescription: "Collect and analyse SIS failure data to verify PFD assumptions and improve reliability." },

  // Modification
  { clauseRef: "§16.2", controlTitle: "SIS Modification Impact Assessment", category: "Modification", silApplicability: "All", controlDescription: "Assess safety impact of all SIS modifications before implementation." },
  { clauseRef: "§16.3", controlTitle: "Re-validation After Modification", category: "Modification", silApplicability: "All", controlDescription: "Re-validate affected SIFs after modification to confirm SIL is maintained." },

  // Decommissioning
  { clauseRef: "§17.2", controlTitle: "Decommissioning Safety Assessment", category: "Decommissioning", silApplicability: "All", controlDescription: "Assess safety implications before decommissioning any SIS component or function." },

  // OG-RMM Specific (Platform-level controls)
  { clauseRef: "OG-RMM-01", controlTitle: "Alarm Management (ISA-18.2)", category: "Platform", silApplicability: "All", controlDescription: "OG-RMM alarm management module compliance with ISA-18.2 for SIS-related alarms." },
  { clauseRef: "OG-RMM-02", controlTitle: "Actuator Command Authorization", category: "Platform", silApplicability: "SIL 1-4", controlDescription: "RBAC-enforced actuator command authorization with audit trail for SIS-connected actuators." },
  { clauseRef: "OG-RMM-03", controlTitle: "Cybersecurity for SIS (IEC 62443)", category: "Platform", silApplicability: "All", controlDescription: "Cybersecurity controls for SIS network segments per IEC 62443-3-3 Security Level 2." },
  { clauseRef: "OG-RMM-04", controlTitle: "Data Integrity and Historian", category: "Platform", silApplicability: "All", controlDescription: "Time-series data integrity for SIS parameters in InfluxDB/PI historian with checksums." },
  { clauseRef: "OG-RMM-05", controlTitle: "Proof Test Scheduling Integration", category: "Platform", silApplicability: "All", controlDescription: "Integration of proof test schedules with Calibration and Workover modules." },
  { clauseRef: "OG-RMM-06", controlTitle: "SIS Bypass Tracking", category: "Platform", silApplicability: "All", controlDescription: "Permit-to-Work integration for SIS bypass authorization and compensating measure tracking." },
  { clauseRef: "OG-RMM-07", controlTitle: "Functional Safety KPI Dashboard", category: "Platform", silApplicability: "All", controlDescription: "Real-time SIL KPI dashboard: PFD trend, demand rate, proof test compliance, gap closure rate." },
  { clauseRef: "OG-RMM-08", controlTitle: "TÜV Assessment Readiness Report", category: "Platform", silApplicability: "SIL 1-4", controlDescription: "Automated generation of TÜV-ready assessment report with evidence traceability matrix." },
];

// ─── SEED HELPER ──────────────────────────────────────────────────────────────

async function seedDefaultAssessment(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const existing = await db.select({ id: silAssessments.id }).from(silAssessments).limit(1);
  if (existing.length > 0) return;

  // Create default assessment
  const [assessment] = await db.insert(silAssessments).values({
    title: "OG-RMM Platform SIL Certification Roadmap",
    description: "IEC 61511-1:2016 compliance assessment for the OG-RMM alarm management, actuator control, and SIS monitoring modules. Target: TÜV SÜD Functional Safety Certificate for SIL 1/2 operations.",
    scope: "Alarm Management (ISA-18.2), Actuator Control (ESD/HIPPS), SIS Monitoring, Historian Data Integrity",
    targetSilLevel: "SIL_2",
    phase: "DESIGN",
    assessorOrg: "TÜV SÜD (Planned)",
    status: "IN_PROGRESS",
    pfdAvg: 0.0087,
    pfhAvg: 0.0000024,
    rrf: 115,
    notes: "Initial self-assessment. External TÜV SÜD assessment planned for Q3. PFD/PFH values are preliminary estimates pending LOPA completion.",
  }).returning({ id: silAssessments.id });

  // Seed controls from IEC 61511 library
  const statusMap: Record<number, "COMPLIANT" | "IN_PROGRESS" | "NOT_STARTED" | "NON_COMPLIANT"> = {
    0: "COMPLIANT", 1: "COMPLIANT", 2: "COMPLIANT", 3: "COMPLIANT",
    4: "IN_PROGRESS", 5: "IN_PROGRESS", 6: "NOT_STARTED",
    7: "COMPLIANT", 8: "IN_PROGRESS", 9: "NOT_STARTED",
    10: "IN_PROGRESS", 11: "IN_PROGRESS", 12: "NOT_STARTED",
    13: "COMPLIANT", 14: "COMPLIANT", 15: "COMPLIANT",
    16: "NOT_STARTED", 17: "IN_PROGRESS", 18: "NOT_STARTED", 19: "NOT_STARTED",
    20: "COMPLIANT", 21: "COMPLIANT", 22: "COMPLIANT", 23: "NOT_STARTED",
    24: "NOT_STARTED", 25: "NOT_STARTED",
    26: "NOT_STARTED", 27: "NOT_STARTED", 28: "NOT_STARTED",
    29: "IN_PROGRESS", 30: "NOT_STARTED", 31: "COMPLIANT", 32: "NOT_STARTED", 33: "NOT_STARTED",
    34: "NOT_STARTED", 35: "NOT_STARTED", 36: "NOT_STARTED",
    37: "COMPLIANT", 38: "COMPLIANT", 39: "IN_PROGRESS",
    40: "COMPLIANT", 41: "IN_PROGRESS", 42: "IN_PROGRESS",
    43: "NOT_STARTED", 44: "NOT_STARTED",
  };

  const gapDescriptions: Record<number, string> = {
    5: "Independent functional safety audit not yet scheduled. Requires external TÜV SÜD assessor engagement.",
    6: "Formal FSA by external assessor not yet performed. Planned for Q3.",
    9: "SIL determination via LOPA not yet completed for all SIFs. HAZOP completed; LOPA in progress.",
    12: "HFT verification pending hardware selection finalization.",
    16: "CCF analysis (β-factor) not started. Required for SIL 2 target.",
    18: "PFD calculation pending LOPA completion and hardware data sheets.",
    19: "Proof test intervals not yet defined. Requires PFD calculation completion.",
    23: "HIL testing not yet performed. Requires test rig setup.",
    24: "FAT not yet scheduled. Requires hardware procurement completion.",
    25: "FAT documentation template not yet created.",
    26: "Installation not yet started (pre-deployment phase).",
    27: "PSSR procedure not yet defined.",
    28: "SAT procedure not yet defined.",
    32: "Demand rate monitoring not yet implemented in OG-RMM.",
    33: "Failure data collection process not yet formalized.",
    34: "Modification impact assessment procedure not yet documented.",
    35: "Re-validation procedure not yet defined.",
    36: "Decommissioning procedure not yet applicable.",
    43: "TÜV-ready report generation not yet implemented.",
    44: "Automated TÜV report export not yet implemented.",
  };

  for (let i = 0; i < IEC_61511_CONTROLS.length; i++) {
    const ctrl = IEC_61511_CONTROLS[i];
    const status = statusMap[i] ?? "NOT_STARTED";
    const hasGap = ["NOT_STARTED", "NON_COMPLIANT"].includes(status);

    await db.insert(silControls).values({
      assessmentId: assessment.id,
      ...ctrl,
      status,
      gapDescription: hasGap ? (gapDescriptions[i] ?? `${ctrl.controlTitle} not yet implemented or verified.`) : null,
      remediationAction: hasGap ? `Complete ${ctrl.controlTitle} per IEC 61511-1:2016 ${ctrl.clauseRef} requirements.` : null,
    });
  }

  // Seed top-level gaps
  await db.insert(silGaps).values([
    {
      assessmentId: assessment.id,
      gapTitle: "LOPA Not Completed for All SIFs",
      severity: "CRITICAL",
      description: "Layer of Protection Analysis (LOPA) has not been completed for all Safety Instrumented Functions. This is a prerequisite for SIL determination and PFD calculation.",
      impactedSilLevel: "SIL_2",
      remediationPlan: "Engage process safety engineer to complete LOPA for all 12 identified SIFs. Use LOPA worksheets per IEC 61511-3 Annex A.",
      owner: "Process Safety Lead",
      targetDate: new Date(Date.now() + 60 * 24 * 3600 * 1000),
      status: "IN_PROGRESS",
    },
    {
      assessmentId: assessment.id,
      gapTitle: "External TÜV FSA Not Scheduled",
      severity: "HIGH",
      description: "A Functional Safety Assessment (FSA) by an independent competent assessor (TÜV SÜD or equivalent) has not been scheduled. Required for SIL 1+ certification.",
      impactedSilLevel: "SIL_1",
      remediationPlan: "Issue RFQ to TÜV SÜD, Exida, and Bureau Veritas for FSA scope and timeline. Target Q3 assessment.",
      owner: "Functional Safety Manager",
      targetDate: new Date(Date.now() + 90 * 24 * 3600 * 1000),
      status: "OPEN",
    },
    {
      assessmentId: assessment.id,
      gapTitle: "Hardware Fault Tolerance (HFT) Not Verified",
      severity: "HIGH",
      description: "Hardware fault tolerance for SIL 2 target has not been formally verified against IEC 61511 Table 5. Requires hardware selection and systematic capability data from vendors.",
      impactedSilLevel: "SIL_2",
      remediationPlan: "Obtain SIL certificates and systematic capability data from sensor, logic solver, and final element vendors. Verify HFT in SRS.",
      owner: "Instrumentation Engineer",
      targetDate: new Date(Date.now() + 45 * 24 * 3600 * 1000),
      status: "IN_PROGRESS",
    },
    {
      assessmentId: assessment.id,
      gapTitle: "Common Cause Failure (CCF) Analysis Missing",
      severity: "HIGH",
      description: "CCF analysis using the β-factor model (IEC 61511 Annex D) has not been performed. Required for all redundant SIS architectures targeting SIL 2.",
      impactedSilLevel: "SIL_2",
      remediationPlan: "Perform CCF analysis for all 1oo2 and 2oo3 voting architectures using IEC 61511 Annex D checklist.",
      owner: "Reliability Engineer",
      targetDate: new Date(Date.now() + 75 * 24 * 3600 * 1000),
      status: "OPEN",
    },
    {
      assessmentId: assessment.id,
      gapTitle: "Proof Test Procedures Not Defined",
      severity: "MEDIUM",
      description: "Proof test procedures and intervals have not been defined for any SIF. Required to maintain SIL over operational life and demonstrate ongoing compliance.",
      impactedSilLevel: "SIL_1",
      remediationPlan: "Define proof test procedures for each SIF based on PFD calculation results. Integrate with OG-RMM Calibration and Workover modules for scheduling.",
      owner: "Operations Engineer",
      targetDate: new Date(Date.now() + 120 * 24 * 3600 * 1000),
      status: "OPEN",
    },
  ]);
}

// ─── ROUTER ───────────────────────────────────────────────────────────────────

export const silCertificationRouter = router({
  /**
   * List all SIL assessments.
   */
  listAssessments: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    await seedDefaultAssessment(db);
    return db.select().from(silAssessments).orderBy(desc(silAssessments.createdAt));
  }),

  /**
   * Get a single assessment with its controls and gaps.
   */
  getAssessment: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) return null;
        await seedDefaultAssessment(db);
  
        const [assessment] = await db.select().from(silAssessments).where(eq(silAssessments.id, input.id));
        if (!assessment) return null;
  
        const controls = await db.select().from(silControls)
          .where(eq(silControls.assessmentId, input.id))
          .orderBy(silControls.clauseRef);
  
        const gaps = await db.select().from(silGaps)
          .where(eq(silGaps.assessmentId, input.id))
          .orderBy(desc(silGaps.severity));
  
        // Compute compliance stats
        const total = controls.length;
        const compliant = controls.filter(c => c.status === "COMPLIANT").length;
        const inProgress = controls.filter(c => c.status === "IN_PROGRESS").length;
        const notStarted = controls.filter(c => c.status === "NOT_STARTED").length;
        const nonCompliant = controls.filter(c => c.status === "NON_COMPLIANT").length;
        const complianceRate = total > 0 ? Math.round((compliant / total) * 100) : 0;
  
        return {
          ...assessment,
          controls,
          gaps,
          stats: { total, compliant, inProgress, notStarted, nonCompliant, complianceRate },
        };
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),

  /**
   * Update a control's status and evidence.
   */
  updateControl: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLIANT", "NON_COMPLIANT", "WAIVED"]),
      evidence: z.string().optional(),
      evidenceUrl: z.string().optional(),
      gapDescription: z.string().optional(),
      remediationAction: z.string().optional(),
      remediationOwner: z.string().optional(),
      remediationDueDate: z.date().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...updates } = input;
      await db.update(silControls).set({
        ...updates,
        updatedAt: new Date(),
      }).where(eq(silControls.id, id));
      return { success: true };
    }),

  /**
   * Update a gap's status.
   */
  updateGap: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["OPEN", "IN_PROGRESS", "CLOSED", "ACCEPTED_RISK"]),
      remediationPlan: z.string().optional(),
      owner: z.string().optional(),
      targetDate: z.date().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const { id, ...updates } = input;
        const closedAt = updates.status === "CLOSED" ? new Date() : undefined;
        await db.update(silGaps).set({
          ...updates,
          ...(closedAt ? { closedAt } : {}),
        }).where(eq(silGaps.id, id));
        return { success: true };
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),

  /**
   * Get compliance summary across all assessments.
   */
  summary: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    await seedDefaultAssessment(db);

    const assessments = await db.select().from(silAssessments);
    const controls = await db.select().from(silControls);
    const gaps = await db.select().from(silGaps);

    const total = controls.length;
    const compliant = controls.filter(c => c.status === "COMPLIANT").length;
    const openGaps = gaps.filter(g => g.status === "OPEN" || g.status === "IN_PROGRESS").length;
    const criticalGaps = gaps.filter(g => g.severity === "CRITICAL" && g.status !== "CLOSED").length;

    return {
      assessmentCount: assessments.length,
      totalControls: total,
      compliantControls: compliant,
      complianceRate: total > 0 ? Math.round((compliant / total) * 100) : 0,
      openGaps,
      criticalGaps,
      targetSilLevel: assessments[0]?.targetSilLevel ?? "SIL_1",
    };
  }),

  /**
   * Get the full IEC 61511 control library (for reference).
   */
  controlLibrary: protectedProcedure.query(() => {
    return IEC_61511_CONTROLS;
  }),

  /**
   * Seed a well-specific SIL 2 assessment with real SIF loops.
   * Covers HIPPS, ESD, BPCS Override, F&G, and EDP loops.
   * Idempotent — skips if an assessment for this well already exists.
   */
  seedWellLoops: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      wellName: z.string().optional(),
      field: z.string().optional(),
      targetSilLevel: z.enum(["SIL_1", "SIL_2", "SIL_3", "SIL_4"]).default("SIL_2"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const title = `${input.wellName ?? input.wellId} — SIL ${input.targetSilLevel.replace("SIL_", "")} Loop Assessment`;

      // Idempotency check
      const existing = await db.select({ id: silAssessments.id })
        .from(silAssessments)
        .where(eq(silAssessments.title, title))
        .limit(1);
      if (existing.length > 0) {
        return { assessmentId: existing[0].id, created: false, message: "Assessment already exists for this well" };
      }

      const silNum = input.targetSilLevel.replace("SIL_", "");
      const pfdMap: Record<string, number> = { "1": 0.05, "2": 0.005, "3": 0.0005, "4": 0.00005 };
      const pfhMap: Record<string, number> = { "1": 0.000050, "2": 0.0000050, "3": 0.00000050, "4": 0.000000050 };
      const rrfMap: Record<string, number> = { "1": 20, "2": 200, "3": 2000, "4": 20000 };

      const [assessment] = await db.insert(silAssessments).values({
        title,
        description: `IEC 61511-1:2016 SIL ${silNum} assessment for well ${input.wellId}. Covers five Safety Instrumented Functions: HIPPS, ESD, BPCS Override, F&G Detection, and Emergency Depressurisation.`,
        scope: `Well: ${input.wellId}${input.field ? ` | Field: ${input.field}` : ""}. SIFs: HIPPS, ESD, BPCS Override, F&G, EDP.`,
        targetSilLevel: input.targetSilLevel,
        phase: "DESIGN",
        assessorOrg: "TÜV SÜD (Planned)",
        status: "IN_PROGRESS",
        pfdAvg: pfdMap[silNum] ?? 0.005,
        pfhAvg: pfhMap[silNum] ?? 0.0000050,
        rrf: rrfMap[silNum] ?? 200,
        notes: `Auto-seeded from well ${input.wellId}. Five SIF loops pre-populated. PFD/PFH values are initial estimates — LOPA required to confirm.`,
      }).returning({ id: silAssessments.id });

      const assessmentId = assessment.id;

      type CtrlStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLIANT" | "NON_COMPLIANT";
      interface LoopControl { clauseRef: string; title: string; category: string; status: CtrlStatus; gap: string; }
      interface SIFLoop { loopId: string; loopName: string; description: string; controls: LoopControl[]; }

      const SIF_LOOPS: SIFLoop[] = [
        {
          loopId: "HIPPS", loopName: "High Integrity Pressure Protection System",
          description: "Prevents wellbore overpressure. Initiates on PAHH. SIL 2 target per ADNOC DEP-PR-01.",
          controls: [
            { clauseRef: "§9.4", title: "HIPPS SIL Determination (LOPA)", category: "Risk Assessment", status: "IN_PROGRESS", gap: "LOPA not yet completed for HIPPS loop. Demand rate and consequence severity require formal quantification." },
            { clauseRef: "§10.2", title: "HIPPS Sensor Redundancy (1oo2D)", category: "Design", status: "NOT_STARTED", gap: "Pressure transmitter redundancy architecture (1oo2D) not yet specified for this well." },
            { clauseRef: "§10.3", title: "HIPPS Logic Solver Specification", category: "Design", status: "NOT_STARTED", gap: "SIL-rated logic solver not yet selected for this well." },
            { clauseRef: "§10.8", title: "HIPPS Proof Test Interval", category: "Design", status: "NOT_STARTED", gap: "Proof test interval not defined. Requires PFD calculation." },
            { clauseRef: "§12.2", title: "HIPPS Factory Acceptance Test", category: "Verification", status: "NOT_STARTED", gap: "FAT procedure not yet created for HIPPS subsystem." },
          ],
        },
        {
          loopId: "ESD", loopName: "Emergency Shutdown System",
          description: "Initiates safe shutdown on critical deviations (PAHH, TAHH, LAHH). Closes ESD valve within 2s. SIL 2.",
          controls: [
            { clauseRef: "§9.4", title: "ESD SIL Determination (LOPA)", category: "Risk Assessment", status: "IN_PROGRESS", gap: "LOPA in progress. Demand rate estimated; consequence model pending." },
            { clauseRef: "§10.4", title: "ESD Valve Actuator Specification", category: "Design", status: "IN_PROGRESS", gap: "ESD valve actuator SIL rating not yet confirmed. Vendor data sheets requested." },
            { clauseRef: "§10.5", title: "ESD Common Cause Failure (CCF) Analysis", category: "Design", status: "NOT_STARTED", gap: "Beta-factor CCF analysis not started. Required for SIL 2 per IEC 61511 §10.7.5." },
            { clauseRef: "§14.2", title: "ESD Operations Procedures", category: "Operations", status: "NOT_STARTED", gap: "ESD bypass management procedure not yet documented for this well." },
            { clauseRef: "§14.3", title: "ESD Proof Test Procedure", category: "Operations", status: "NOT_STARTED", gap: "Proof test procedure not yet defined. Target interval: 12 months." },
          ],
        },
        {
          loopId: "BPCS", loopName: "Basic Process Control System Override",
          description: "SIS override of BPCS on BPCS failure. Ensures independent protection layer. SIL 1 target.",
          controls: [
            { clauseRef: "§9.5", title: "BPCS/SIS Independence Verification", category: "Design", status: "IN_PROGRESS", gap: "Independence between BPCS and SIS not yet formally verified. Shared sensor review in progress." },
            { clauseRef: "§10.3", title: "BPCS Override Logic Design", category: "Design", status: "NOT_STARTED", gap: "Override logic specification not yet documented." },
            { clauseRef: "§11.5", title: "BPCS Override Integration Testing", category: "Verification", status: "NOT_STARTED", gap: "HIL integration test not yet performed." },
          ],
        },
        {
          loopId: "FG", loopName: "Fire & Gas Detection System",
          description: "Detects HC gas release and fire. Initiates ESD and deluge on 2oo3 detection. SIL 2 target per NFPA 72.",
          controls: [
            { clauseRef: "§9.4", title: "F&G SIL Determination", category: "Risk Assessment", status: "NOT_STARTED", gap: "SIL determination not yet performed. Requires consequence analysis for gas cloud ignition." },
            { clauseRef: "§10.2", title: "F&G Detector Voting Architecture (2oo3)", category: "Design", status: "NOT_STARTED", gap: "Detector voting architecture not yet specified. 2oo3 recommended for SIL 2." },
            { clauseRef: "§10.8", title: "F&G Detector Proof Test Interval", category: "Design", status: "NOT_STARTED", gap: "Detector proof test interval not defined. Typical: 6 months for catalytic bead sensors." },
            { clauseRef: "§14.2", title: "F&G Alarm Response Procedure", category: "Operations", status: "NOT_STARTED", gap: "Alarm response procedure for F&G not yet documented." },
          ],
        },
        {
          loopId: "EDP", loopName: "Emergency Depressurisation System",
          description: "Rapidly depressurises wellbore on fire or ESD demand. Prevents vessel rupture. SIL 2 per API 521.",
          controls: [
            { clauseRef: "§9.4", title: "EDP SIL Determination", category: "Risk Assessment", status: "NOT_STARTED", gap: "SIL determination not yet performed. Requires thermal radiation consequence modelling." },
            { clauseRef: "§10.4", title: "EDP Blowdown Valve Specification", category: "Design", status: "NOT_STARTED", gap: "Blowdown valve SIL rating and response time not yet specified." },
            { clauseRef: "§10.8", title: "EDP Proof Test Interval", category: "Design", status: "NOT_STARTED", gap: "Proof test interval not defined. API 521 recommends annual full-stroke testing." },
            { clauseRef: "§14.2", title: "EDP Operational Procedure", category: "Operations", status: "NOT_STARTED", gap: "EDP operational procedure not yet documented. Required before commissioning." },
          ],
        },
      ];

      let controlsInserted = 0;
      const gapsToInsert: Array<typeof silGaps.$inferInsert> = [];

      for (const loop of SIF_LOOPS) {
        for (const ctrl of loop.controls) {
          const [inserted] = await db.insert(silControls).values({
            assessmentId,
            clauseRef: ctrl.clauseRef,
            controlTitle: `[${loop.loopId}] ${ctrl.title}`,
            controlDescription: `${loop.loopName}: ${loop.description}`,
            category: ctrl.category,
            silApplicability: input.targetSilLevel,
            status: ctrl.status,
            gapDescription: ctrl.gap,
            remediationAction: `Engage TÜV SÜD functional safety engineer to complete ${ctrl.title.toLowerCase()} for ${loop.loopId} loop on well ${input.wellId}.`,
            remediationOwner: "Process Safety Engineer",
          }).returning({ id: silControls.id });

          controlsInserted++;

          if (ctrl.status !== "COMPLIANT") {
            gapsToInsert.push({
              assessmentId,
              controlId: inserted.id,
              gapTitle: `${loop.loopId}: ${ctrl.title}`,
              severity: ctrl.status === "NOT_STARTED" ? "HIGH" : "MEDIUM",
              description: ctrl.gap,
              impactedSilLevel: input.targetSilLevel,
              remediationPlan: `Complete ${ctrl.title} for ${loop.loopId} loop. Assign to Process Safety Engineer. Target: Q3.`,
              owner: "Process Safety Engineer",
              status: ctrl.status === "IN_PROGRESS" ? "IN_PROGRESS" : "OPEN",
            });
          }
        }
      }

      if (gapsToInsert.length > 0) {
        await db.insert(silGaps).values(gapsToInsert);
      }

      return {
        assessmentId,
        created: true,
        wellId: input.wellId,
        loopsSeeded: SIF_LOOPS.map(l => l.loopId),
        controlsInserted,
        gapsCreated: gapsToInsert.length,
        message: `SIL ${silNum} assessment created for well ${input.wellId} with ${controlsInserted} controls across ${SIF_LOOPS.length} SIF loops.`,
      };
    }),

  /**
   * List all well-specific SIL assessments (excludes the default platform assessment).
   */
  listWellAssessments: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const all = await db.select().from(silAssessments).orderBy(desc(silAssessments.createdAt));
    return all.filter(a => !a.title.startsWith("OG-RMM Platform SIL Certification Roadmap"));
  }),
});
