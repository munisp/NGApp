import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { spawn } from "child_process";
import path from "path";

const TransactionSchema = z.object({
  id: z.string(),
  amount: z.number(),
  category: z.string(),
  date: z.number(),
  description: z.string().optional(),
});

const BudgetSchema = z.object({
  category: z.string(),
  limit: z.number(),
});

/**
 * Execute Python predictive alerts service
 */
function executePythonService(action: string, data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, "predictive-alerts.py");
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

export const predictiveAlertsRouter = router({
  /**
   * Analyze spending for a specific category and predict budget risk
   */
  analyzeCategory: publicProcedure
    .input(
      z.object({
        transactions: z.array(TransactionSchema),
        category: z.string(),
        budget_limit: z.number(),
        period_start: z.number(),
        period_end: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      return await executePythonService("analyze_category", input);
    }),

  /**
   * Get all predictive alerts for budget categories
   */
  getAllAlerts: publicProcedure
    .input(
      z.object({
        transactions: z.array(TransactionSchema),
        budgets: z.array(BudgetSchema),
        period_start: z.number(),
        period_end: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      return await executePythonService("get_all_alerts", input);
    }),

  /**
   * Analyze spending pattern
   */
  analyzePattern: publicProcedure
    .input(
      z.object({
        transactions: z.array(TransactionSchema),
      })
    )
    .mutation(async ({ input }) => {
      return await executePythonService("analyze_pattern", input);
    }),
});
