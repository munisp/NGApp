import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { spawn } from "child_process";
import path from "path";

const TransactionSchema = z.object({
  id: z.string(),
  type: z.enum(["credit", "debit"]),
  amount: z.number(),
  category: z.string(),
  date: z.number(),
  description: z.string().optional(),
});

/**
 * Execute Python tax export service
 */
function executePythonService(action: string, data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, "tax-export.py");
    const python = spawn("python3", [pythonScript]);

    let stdout = "";
    let stderr = "";

    python.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    python.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    python.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Python service failed: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result);
        }
      } catch (error) {
        reject(new Error(`Failed to parse Python output: ${stdout}`));
      }
    });

    // Send input data to Python script
    python.stdin.write(JSON.stringify({ action, ...data }));
    python.stdin.end();
  });
}

export const taxExportRouter = router({
  /**
   * Generate country-specific tax report
   */
  generateReport: publicProcedure
    .input(
      z.object({
        country: z.enum(["nigeria", "kenya", "ghana", "south_africa"]),
        tax_year: z.number(),
        taxpayer_name: z.string(),
        tax_id: z.string(),
        transactions: z.array(TransactionSchema),
      })
    )
    .mutation(async ({ input }) => {
      return await executePythonService("generate_report", input);
    }),

  /**
   * Get list of supported tax authorities
   */
  getAuthorities: publicProcedure.query(async () => {
    return await executePythonService("get_authorities", {});
  }),
});
