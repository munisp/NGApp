import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { spawn } from "child_process";
import path from "path";
import { deliverWebhookEvent } from '../services/webhook-delivery';

const TaxOptimizationInputSchema = z.object({
  portfolio: z.array(z.object({
    symbol: z.string(),
    purchasePrice: z.number(),
    currentPrice: z.number(),
    quantity: z.number(),
  })).optional(),
  accounts: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    balance: z.number(),
    annualIncome: z.number().optional(),
  })).optional(),
  expenses: z.array(z.object({
    category: z.string(),
    amount: z.number(),
  })).optional(),
  income: z.number().optional(),
  age: z.number().optional(),
});

export const taxOptimizationRouter = router({
  generateReport: protectedProcedure
    .input(TaxOptimizationInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, "tax-optimization.py");
        const pythonProcess = spawn("python3", [scriptPath]);

        let stdout = "";
        let stderr = "";

        // Send input data to Python script
        pythonProcess.stdin.write(JSON.stringify(input));
        pythonProcess.stdin.end();

        pythonProcess.stdout.on("data", (data) => {
          stdout += data.toString();
        });

        pythonProcess.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        pythonProcess.on("close", (code) => {
          if (code !== 0) {
            reject(new Error(`Tax optimization failed: ${stderr}`));
            return;
          }

          try {
            const result = JSON.parse(stdout);
            
            // Fire webhook event for tax optimization completion
            if (userId) {
              deliverWebhookEvent(
                'tax_optimization.completed',
                {
                  totalTaxLiability: result.totalTaxLiability,
                  potentialSavings: result.potentialSavings,
                  optimizationStrategies: result.optimizationStrategies?.length || 0,
                  generatedAt: new Date().toISOString(),
                },
                String(userId)
              ).catch(err => console.error('[Tax Optimization] Webhook delivery failed:', err));
            }
            
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse tax optimization result: ${error}`));
          }
        });

        pythonProcess.on("error", (error) => {
          reject(new Error(`Failed to start tax optimization: ${error.message}`));
        });
      });
    }),
});
