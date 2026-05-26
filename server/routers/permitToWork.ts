import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router, protectedProcedure} from "../_core/trpc";
import { nanoid } from "nanoid";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PermitType = "HOT_WORK" | "CONFINED_SPACE" | "ELECTRICAL_ISOLATION" | "COLD_WORK" | "EXCAVATION" | "WORKING_AT_HEIGHT" | "RADIATION";
export type PermitStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "ACTIVE" | "SUSPENDED" | "CLOSED" | "CANCELLED";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface Permit {
  id: string;
  permitNumber: string;
  type: PermitType;
  status: PermitStatus;
  title: string;
  wellId: string;
  wellName: string;
  location: string;
  description: string;
  riskLevel: RiskLevel;
  requestedBy: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  validFrom?: string;
  validUntil?: string;
  closedBy?: string;
  closedAt?: string;
  isolations: Isolation[];
  hazards: string[];
  precautions: string[];
  gasTestRequired: boolean;
  gasTestResult?: string;
  gasTestedBy?: string;
  gasTestedAt?: string;
  sisImpacted: boolean;
  sifBypassRef?: string;
  mocRef?: string;
  workoversRef?: string;
  comments: Comment[];
}

export interface Isolation {
  id: string;
  tag: string;
  description: string;
  type: "VALVE" | "ELECTRICAL" | "PNEUMATIC" | "MECHANICAL";
  position: "OPEN" | "CLOSED" | "LOCKED_OPEN" | "LOCKED_CLOSED";
  isolatedBy?: string;
  isolatedAt?: string;
  restoredBy?: string;
  restoredAt?: string;
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
  type: "COMMENT" | "APPROVAL" | "REJECTION" | "SUSPENSION" | "CLOSURE";
}

// ─── In-memory store (replace with DB in production) ─────────────────────────

const permits: Map<string, Permit> = new Map();

// Seed with realistic demo permits
function seedPermits() {
  const demoPermits: Permit[] = [
    {
      id: "PTW-001",
      permitNumber: "PTW-2026-0312-001",
      type: "HOT_WORK",
      status: "ACTIVE",
      title: "Welding on ESP motor housing — Well #23",
      wellId: "well-23",
      wellName: "Permian Basin #23",
      location: "Wellhead Platform A, Zone 2",
      description: "Welding repair on ESP motor housing following vibration damage. Requires hot work permit due to presence of hydrocarbon vapors.",
      riskLevel: "HIGH",
      requestedBy: "T. Williams",
      requestedAt: "2026-03-13T06:00:00Z",
      approvedBy: "J. Rodriguez",
      approvedAt: "2026-03-13T07:30:00Z",
      validFrom: "2026-03-13T08:00:00Z",
      validUntil: "2026-03-13T18:00:00Z",
      isolations: [
        { id: "ISO-001", tag: "XV-2301", description: "Production wing valve", type: "VALVE", position: "LOCKED_CLOSED", isolatedBy: "T. Williams", isolatedAt: "2026-03-13T07:45:00Z" },
        { id: "ISO-002", tag: "XV-2302", description: "Annulus valve", type: "VALVE", position: "LOCKED_CLOSED", isolatedBy: "T. Williams", isolatedAt: "2026-03-13T07:46:00Z" },
        { id: "ISO-003", tag: "MCC-23A", description: "ESP motor control center", type: "ELECTRICAL", position: "LOCKED_OPEN", isolatedBy: "T. Williams", isolatedAt: "2026-03-13T07:50:00Z" },
      ],
      hazards: ["Hydrocarbon vapors", "Ignition sources", "Hot surfaces", "Electrical hazard"],
      precautions: ["Continuous gas monitoring", "Fire watch assigned", "Extinguisher on standby", "Lockout/Tagout applied", "Grounding cable attached"],
      gasTestRequired: true,
      gasTestResult: "0% LEL — CLEAR",
      gasTestedBy: "M. Hassan",
      gasTestedAt: "2026-03-13T07:55:00Z",
      sisImpacted: true,
      sifBypassRef: "SIF-BYPASS-2026-047",
      mocRef: "MOC-2026-0312-003",
      workoversRef: "WO-2026-0089",
      comments: [
        { id: "c1", author: "J. Rodriguez", text: "Approved. Ensure continuous gas monitoring throughout operation.", timestamp: "2026-03-13T07:30:00Z", type: "APPROVAL" },
      ],
    },
    {
      id: "PTW-002",
      permitNumber: "PTW-2026-0313-002",
      type: "CONFINED_SPACE",
      status: "PENDING_APPROVAL",
      title: "Separator vessel internal inspection — V-101",
      wellId: "well-47",
      wellName: "Eagle Ford #47",
      location: "Production Separator V-101",
      description: "Internal inspection of three-phase separator vessel V-101 for corrosion assessment and scale removal.",
      riskLevel: "CRITICAL",
      requestedBy: "A. Al-Rashidi",
      requestedAt: "2026-03-13T08:00:00Z",
      isolations: [
        { id: "ISO-004", tag: "FV-1010", description: "Feed inlet valve", type: "VALVE", position: "LOCKED_CLOSED" },
        { id: "ISO-005", tag: "FV-1011", description: "Oil outlet valve", type: "VALVE", position: "LOCKED_CLOSED" },
        { id: "ISO-006", tag: "FV-1012", description: "Gas outlet valve", type: "VALVE", position: "LOCKED_CLOSED" },
        { id: "ISO-007", tag: "FV-1013", description: "Water outlet valve", type: "VALVE", position: "LOCKED_CLOSED" },
      ],
      hazards: ["Oxygen deficiency", "Toxic H2S gas", "Confined space engulfment", "Slippery surfaces"],
      precautions: ["Continuous O2/H2S monitoring", "Standby rescue team", "Lifeline attached", "Ventilation blower running", "SCBA available"],
      gasTestRequired: true,
      sisImpacted: false,
      comments: [],
    },
    {
      id: "PTW-003",
      permitNumber: "PTW-2026-0311-003",
      type: "ELECTRICAL_ISOLATION",
      status: "CLOSED",
      title: "MCC panel maintenance — Compressor Station C3",
      wellId: "well-12",
      wellName: "Bakken #12",
      location: "Compressor Station C3, MCC Room",
      description: "Scheduled maintenance on motor control center MCC-C3A including contactor replacement and bus bar inspection.",
      riskLevel: "MEDIUM",
      requestedBy: "K. Okafor",
      requestedAt: "2026-03-11T06:00:00Z",
      approvedBy: "J. Rodriguez",
      approvedAt: "2026-03-11T07:00:00Z",
      validFrom: "2026-03-11T08:00:00Z",
      validUntil: "2026-03-11T16:00:00Z",
      closedBy: "K. Okafor",
      closedAt: "2026-03-11T14:30:00Z",
      isolations: [
        { id: "ISO-008", tag: "CB-C3A-001", description: "Main incomer breaker", type: "ELECTRICAL", position: "LOCKED_OPEN", isolatedBy: "K. Okafor", isolatedAt: "2026-03-11T08:10:00Z", restoredBy: "K. Okafor", restoredAt: "2026-03-11T14:20:00Z" },
      ],
      hazards: ["Electrical arc flash", "Stored energy in capacitors", "High voltage"],
      precautions: ["Arc flash PPE worn", "Voltage test before touch", "LOTO applied", "Buddy system"],
      gasTestRequired: false,
      sisImpacted: false,
      comments: [
        { id: "c2", author: "J. Rodriguez", text: "Approved. Standard LOTO procedure applies.", timestamp: "2026-03-11T07:00:00Z", type: "APPROVAL" },
        { id: "c3", author: "K. Okafor", text: "Work completed successfully. All isolations restored. Permit closed.", timestamp: "2026-03-11T14:30:00Z", type: "CLOSURE" },
      ],
    },
  ];

  demoPermits.forEach((p) => permits.set(p.id, p));
}

seedPermits();

// ─── Router ───────────────────────────────────────────────────────────────────

export const permitToWorkRouter = router({
  list: publicProcedure
    .input(z.object({
      status: z.enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "ACTIVE", "SUSPENDED", "CLOSED", "CANCELLED", "ALL"]).optional().default("ALL"),
      type: z.string().optional(),
    }))
    .query(({ input }) => {
      let list = Array.from(permits.values());
      if (input.status !== "ALL") {
        list = list.filter((p) => p.status === input.status);
      }
      if (input.type) {
        list = list.filter((p) => p.type === input.type);
      }
      // Sort: ACTIVE first, then PENDING_APPROVAL, then by requestedAt desc
      const statusOrder: Record<PermitStatus, number> = {
        ACTIVE: 0, PENDING_APPROVAL: 1, APPROVED: 2, SUSPENDED: 3, DRAFT: 4, CLOSED: 5, CANCELLED: 6,
      };
      list.sort((a, b) => {
        const so = statusOrder[a.status] - statusOrder[b.status];
        if (so !== 0) return so;
        return new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime();
      });
      return list;
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const permit = permits.get(input.id);
      if (!permit) throw new Error(`Permit ${input.id} not found`);
      return permit;
    }),

  create: publicProcedure
    .input(z.object({
      type: z.enum(["HOT_WORK", "CONFINED_SPACE", "ELECTRICAL_ISOLATION", "COLD_WORK", "EXCAVATION", "WORKING_AT_HEIGHT", "RADIATION"]),
      title: z.string().min(5),
      wellId: z.string(),
      wellName: z.string(),
      location: z.string(),
      description: z.string(),
      riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
      requestedBy: z.string(),
      hazards: z.array(z.string()),
      precautions: z.array(z.string()),
      gasTestRequired: z.boolean(),
      sisImpacted: z.boolean(),
      validFrom: z.string().optional(),
      validUntil: z.string().optional(),
    }))
    .mutation(({ input }) => {
      const id = `PTW-${nanoid(6).toUpperCase()}`;
      const permitNumber = `PTW-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}-${String(permits.size + 1).padStart(3, "0")}`;

      const newPermit: Permit = {
        id,
        permitNumber,
        ...input,
        status: "PENDING_APPROVAL",
        requestedAt: new Date().toISOString(),
        isolations: [],
        comments: [],
      };

      permits.set(id, newPermit);
      return newPermit;
    }),

  approve: publicProcedure
    .input(z.object({
      id: z.string(),
      approvedBy: z.string(),
      comment: z.string().optional(),
    }))
    .mutation(({ input }) => {
      const permit = permits.get(input.id);
      if (!permit) throw new Error(`Permit ${input.id} not found`);
      if (permit.status !== "PENDING_APPROVAL") throw new Error("Permit is not pending approval");

      permit.status = "APPROVED";
      permit.approvedBy = input.approvedBy;
      permit.approvedAt = new Date().toISOString();

      if (input.comment) {
        permit.comments.push({
          id: nanoid(),
          author: input.approvedBy,
          text: input.comment,
          timestamp: new Date().toISOString(),
          type: "APPROVAL",
        });
      }

      permits.set(input.id, permit);
      return permit;
    }),

  activate: publicProcedure
    .input(z.object({
      id: z.string(),
      activatedBy: z.string(),
      gasTestResult: z.string().optional(),
      gasTestedBy: z.string().optional(),
    }))
    .mutation(({ input }) => {
      const permit = permits.get(input.id);
      if (!permit) throw new Error(`Permit ${input.id} not found`);
      if (permit.status !== "APPROVED") throw new Error("Permit must be approved before activation");
      if (permit.gasTestRequired && !input.gasTestResult) {
        throw new Error("Gas test result required before activation");
      }

      permit.status = "ACTIVE";
      if (input.gasTestResult) {
        permit.gasTestResult = input.gasTestResult;
        permit.gasTestedBy = input.gasTestedBy;
        permit.gasTestedAt = new Date().toISOString();
      }

      permits.set(input.id, permit);
      return permit;
    }),

  close: publicProcedure
    .input(z.object({
      id: z.string(),
      closedBy: z.string(),
      comment: z.string().optional(),
    }))
    .mutation(({ input }) => {
      const permit = permits.get(input.id);
      if (!permit) throw new Error(`Permit ${input.id} not found`);
      if (!["ACTIVE", "APPROVED", "SUSPENDED"].includes(permit.status)) {
        throw new Error("Permit cannot be closed from current status");
      }

      permit.status = "CLOSED";
      permit.closedBy = input.closedBy;
      permit.closedAt = new Date().toISOString();

      if (input.comment) {
        permit.comments.push({
          id: nanoid(),
          author: input.closedBy,
          text: input.comment,
          timestamp: new Date().toISOString(),
          type: "CLOSURE",
        });
      }

      permits.set(input.id, permit);
      return permit;
    }),

  addComment: publicProcedure
    .input(z.object({
      id: z.string(),
      author: z.string(),
      text: z.string().min(1),
    }))
    .mutation(({ input }) => {
      const permit = permits.get(input.id);
      if (!permit) throw new Error(`Permit ${input.id} not found`);

      const comment: Comment = {
        id: nanoid(),
        author: input.author,
        text: input.text,
        timestamp: new Date().toISOString(),
        type: "COMMENT",
      };

      permit.comments.push(comment);
      permits.set(input.id, permit);
      return comment;
    }),

  saveSignature: publicProcedure
    .input(z.object({
      id: z.string(),
      role: z.enum(["issuer", "approver"]),
      signatureUrl: z.string().url(),
      signedBy: z.string(),
    }))
    .mutation(({ input }) => {
      const permit = permits.get(input.id);
      if (!permit) throw new Error(`Permit ${input.id} not found`);
      const now = new Date().toISOString();
      if (input.role === "issuer") {
        (permit as any).issuerSignatureUrl = input.signatureUrl;
        (permit as any).issuerSignedBy = input.signedBy;
        (permit as any).issuerSignedAt = now;
      } else {
        (permit as any).approverSignatureUrl = input.signatureUrl;
        (permit as any).approverSignedBy = input.signedBy;
        (permit as any).approverSignedAt = now;
      }
      permit.comments.push({
        id: nanoid(),
        author: input.signedBy,
        text: `Digital signature captured for ${input.role === "issuer" ? "permit issuer" : "approver"}.`,
        timestamp: now,
        type: input.role === "approver" ? "APPROVAL" : "COMMENT",
      });
      permits.set(input.id, permit);
      return { success: true, role: input.role, signedAt: now };
    }),

  stats: protectedProcedure.query(() => {
    const list = Array.from(permits.values());
    return {
      total: list.length,
      active: list.filter((p) => p.status === "ACTIVE").length,
      pendingApproval: list.filter((p) => p.status === "PENDING_APPROVAL").length,
      approved: list.filter((p) => p.status === "APPROVED").length,
      suspended: list.filter((p) => p.status === "SUSPENDED").length,
      closed: list.filter((p) => p.status === "CLOSED").length,
      highRisk: list.filter((p) => ["HIGH", "CRITICAL"].includes(p.riskLevel) && p.status === "ACTIVE").length,
      sisImpacted: list.filter((p) => p.sisImpacted && p.status === "ACTIVE").length,
      byType: {
        HOT_WORK: list.filter((p) => p.type === "HOT_WORK").length,
        CONFINED_SPACE: list.filter((p) => p.type === "CONFINED_SPACE").length,
        ELECTRICAL_ISOLATION: list.filter((p) => p.type === "ELECTRICAL_ISOLATION").length,
        COLD_WORK: list.filter((p) => p.type === "COLD_WORK").length,
        EXCAVATION: list.filter((p) => p.type === "EXCAVATION").length,
        WORKING_AT_HEIGHT: list.filter((p) => p.type === "WORKING_AT_HEIGHT").length,
        RADIATION: list.filter((p) => p.type === "RADIATION").length,
      },
    };
  }),
});
