/**
 * S94-02: Bulk Role Import Router
 * Allows administrators to upload CSV files to mass-assign PBAC roles.
 * Validates agent codes, checks role hierarchy, and produces import reports.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

// ── Types ──
const VALID_ROLES = [
  "super_admin", "admin", "manager", "supervisor", "operator", "agent", "viewer"
] as const;

type PBACRole = typeof VALID_ROLES[number];

interface ImportRow {
  agentCode: string;
  targetRole: string;
  department?: string;
  notes?: string;
}

interface ImportResult {
  row: number;
  agentCode: string;
  targetRole: string;
  status: "success" | "error" | "skipped";
  message: string;
  previousRole?: string;
}

interface ImportReport {
  importId: string;
  timestamp: number;
  totalRows: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
  results: ImportResult[];
  importedBy: string;
}

// ── In-memory import history ──
const importHistory: ImportReport[] = [];
const MAX_IMPORT_HISTORY = 100;

// ── Role hierarchy for validation ──
const ROLE_HIERARCHY: Record<PBACRole, number> = {
  super_admin: 7,
  admin: 6,
  manager: 5,
  supervisor: 4,
  operator: 3,
  agent: 2,
  viewer: 1,
};

// ── Simulated agent store (in production, queries DB) ──
const agentRoles: Map<string, { role: PBACRole; name: string; department: string }> = new Map([
  ["AG001", { role: "agent", name: "Adebayo Ogundimu", department: "Lagos Central" }],
  ["AG002", { role: "agent", name: "Chioma Eze", department: "Lagos Island" }],
  ["AG003", { role: "operator", name: "Ibrahim Musa", department: "Kano North" }],
  ["AG004", { role: "supervisor", name: "Fatima Bello", department: "Abuja FCT" }],
  ["AG005", { role: "agent", name: "Emeka Nwosu", department: "Rivers South" }],
  ["AG006", { role: "viewer", name: "Grace Adeyemi", department: "Oyo West" }],
  ["AG007", { role: "agent", name: "Yusuf Abdullahi", department: "Kaduna East" }],
  ["AG008", { role: "operator", name: "Ngozi Okafor", department: "Enugu Central" }],
  ["AG009", { role: "agent", name: "Tunde Bakare", department: "Osun North" }],
  ["AG010", { role: "agent", name: "Amina Garba", department: "Borno South" }],
]);

function parseCSV(csvContent: string): ImportRow[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase().split(",").map(h => h.trim());
  const agentCodeIdx = header.findIndex(h => h === "agent_code" || h === "agentcode" || h === "code");
  const roleIdx = header.findIndex(h => h === "role" || h === "target_role" || h === "targetrole");
  const deptIdx = header.findIndex(h => h === "department" || h === "dept");
  const notesIdx = header.findIndex(h => h === "notes" || h === "comment");

  if (agentCodeIdx === -1 || roleIdx === -1) {
    throw new Error("CSV must contain 'agent_code' and 'role' columns");
  }

  return lines.slice(1).filter(l => l.trim()).map(line => {
    const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
    return {
      agentCode: cols[agentCodeIdx] || "",
      targetRole: cols[roleIdx] || "",
      department: deptIdx >= 0 ? cols[deptIdx] : undefined,
      notes: notesIdx >= 0 ? cols[notesIdx] : undefined,
    };
  });
}

export const bulkRoleImportRouter = router({
  /**
   * Parse and validate a CSV file before importing
   */
  validateCSV: protectedProcedure
    .input(z.object({ csvContent: z.string().min(10) }))
    .mutation(({ input }) => {
      try {
        const rows = parseCSV(input.csvContent);
        const validationResults = rows.map((row, idx) => {
          const errors: string[] = [];
          if (!row.agentCode) errors.push("Missing agent code");
          if (!row.targetRole) errors.push("Missing target role");
          if (row.targetRole && !VALID_ROLES.includes(row.targetRole as PBACRole)) {
            errors.push(`Invalid role: ${row.targetRole}. Valid: ${VALID_ROLES.join(", ")}`);
          }
          const agent = agentRoles.get(row.agentCode);
          if (row.agentCode && !agent) errors.push(`Agent not found: ${row.agentCode}`);

          return {
            row: idx + 2, // 1-indexed, skip header
            agentCode: row.agentCode,
            targetRole: row.targetRole,
            currentRole: agent?.role || "unknown",
            agentName: agent?.name || "Unknown",
            isValid: errors.length === 0,
            errors,
            wouldChange: agent ? agent.role !== row.targetRole : false,
          };
        });

        return {
          totalRows: rows.length,
          validCount: validationResults.filter(r => r.isValid).length,
          errorCount: validationResults.filter(r => !r.isValid).length,
          changeCount: validationResults.filter(r => r.wouldChange).length,
          noChangeCount: validationResults.filter(r => r.isValid && !r.wouldChange).length,
          results: validationResults,
        };
      } catch (err: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
      }
    }),

  /**
   * Execute bulk role import from validated CSV
   */
  executeImport: protectedProcedure
    .input(z.object({
      csvContent: z.string().min(10),
      skipErrors: z.boolean().default(true),
      dryRun: z.boolean().default(false),
    }))
    .mutation(({ input, ctx }) => {
      const rows = parseCSV(input.csvContent);
      const results: ImportResult[] = [];
      const adminRole = (ctx.user as any)?.role || "admin";
      const adminLevel = ROLE_HIERARCHY[adminRole as PBACRole] || 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;

        // Validate agent exists
        const agent = agentRoles.get(row.agentCode);
        if (!agent) {
          results.push({
            row: rowNum, agentCode: row.agentCode, targetRole: row.targetRole,
            status: "error", message: `Agent not found: ${row.agentCode}`,
          });
          if (!input.skipErrors) break;
          continue;
        }

        // Validate role
        if (!VALID_ROLES.includes(row.targetRole as PBACRole)) {
          results.push({
            row: rowNum, agentCode: row.agentCode, targetRole: row.targetRole,
            status: "error", message: `Invalid role: ${row.targetRole}`,
          });
          if (!input.skipErrors) break;
          continue;
        }

        // Check hierarchy — can't assign role higher than your own
        const targetLevel = ROLE_HIERARCHY[row.targetRole as PBACRole];
        if (targetLevel >= adminLevel) {
          results.push({
            row: rowNum, agentCode: row.agentCode, targetRole: row.targetRole,
            status: "error", message: `Cannot assign role '${row.targetRole}' (level ${targetLevel}) — your level is ${adminLevel}`,
          });
          if (!input.skipErrors) break;
          continue;
        }

        // Skip if no change
        if (agent.role === row.targetRole) {
          results.push({
            row: rowNum, agentCode: row.agentCode, targetRole: row.targetRole,
            status: "skipped", message: `Already has role '${row.targetRole}'`,
            previousRole: agent.role,
          });
          continue;
        }

        // Apply role change (unless dry run)
        const previousRole = agent.role;
        if (!input.dryRun) {
          agent.role = row.targetRole as PBACRole;
          if (row.department) agent.department = row.department;
        }

        results.push({
          row: rowNum, agentCode: row.agentCode, targetRole: row.targetRole,
          status: "success", message: input.dryRun
            ? `Would change from '${previousRole}' to '${row.targetRole}'`
            : `Changed from '${previousRole}' to '${row.targetRole}'`,
          previousRole,
        });
      }

      const report: ImportReport = {
        importId: `IMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        totalRows: rows.length,
        successCount: results.filter(r => r.status === "success").length,
        errorCount: results.filter(r => r.status === "error").length,
        skippedCount: results.filter(r => r.status === "skipped").length,
        results,
        importedBy: (ctx.user as any)?.name || "admin",
      };

      if (!input.dryRun) {
        importHistory.unshift(report);
        if (importHistory.length > MAX_IMPORT_HISTORY) importHistory.splice(MAX_IMPORT_HISTORY);
      }

      return report;
    }),

  /**
   * Get import history
   */
  getImportHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
    .query(({ input }) => {
      const limit = input?.limit || 20;
      return {
        imports: importHistory.slice(0, limit),
        total: importHistory.length,
      };
    }),

  /**
   * Get CSV template for download
   */
  getTemplate: protectedProcedure.query(() => {
    return {
      csvTemplate: `agent_code,role,department,notes\nAG001,operator,Lagos Central,Promoted to operator\nAG002,supervisor,Lagos Island,New team lead`,
      validRoles: VALID_ROLES,
      sampleAgents: Array.from(agentRoles.entries()).slice(0, 5).map(([code, data]) => ({
        code, name: data.name, currentRole: data.role, department: data.department,
      })),
    };
  }),

  /**
   * Rollback a specific import
   */
  rollbackImport: protectedProcedure
    .input(z.object({ importId: z.string() }))
    .mutation(({ input }) => {
      const report = importHistory.find(r => r.importId === input.importId);
      if (!report) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Import not found" });
      }

      let rolledBack = 0;
      for (const result of report.results) {
        if (result.status === "success" && result.previousRole) {
          const agent = agentRoles.get(result.agentCode);
          if (agent) {
            agent.role = result.previousRole as PBACRole;
            rolledBack++;
          }
        }
      }

      return {
        importId: input.importId,
        rolledBackCount: rolledBack,
        totalSuccessful: report.successCount,
        message: `Rolled back ${rolledBack}/${report.successCount} role changes`,
      };
    }),
});
