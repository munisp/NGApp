import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { spawn } from "child_process";
import path from "path";

const TransactionSchema = z.object({
  id: z.string(),
  amount: z.number(),
  date: z.number(),
  merchant: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
});

export const expenseForecastRouter = router({
  forecast: publicProcedure
    .input(
      z.object({
        transactions: z.array(TransactionSchema),
        days: z.number().default(30),
      })
    )
    .mutation(async ({ input }) => {
      return new Promise((resolve, reject) => {
        const pythonScript = path.join(__dirname, "expense-forecast.py");
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
            reject(new Error(`Python script failed: ${stderr}`));
            return;
          }

          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse Python output: ${stdout}`));
          }
        });

        python.stdin.write(
          JSON.stringify({
            action: "forecast",
            transactions: input.transactions,
            days: input.days,
          })
        );
        python.stdin.end();
      });
    }),

  analyzePatterns: publicProcedure
    .input(
      z.object({
        transactions: z.array(TransactionSchema),
      })
    )
    .mutation(async ({ input }) => {
      return new Promise((resolve, reject) => {
        const pythonScript = path.join(__dirname, "expense-forecast.py");
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
            reject(new Error(`Python script failed: ${stderr}`));
            return;
          }

          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse Python output: ${stdout}`));
          }
        });

        python.stdin.write(
          JSON.stringify({
            action: "patterns",
            transactions: input.transactions,
          })
        );
        python.stdin.end();
      });
    }),

  upcomingExpenses: publicProcedure
    .input(
      z.object({
        transactions: z.array(TransactionSchema),
      })
    )
    .mutation(async ({ input }) => {
      return new Promise((resolve, reject) => {
        const pythonScript = path.join(__dirname, "expense-forecast.py");
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
            reject(new Error(`Python script failed: ${stderr}`));
            return;
          }

          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse Python output: ${stdout}`));
          }
        });

        python.stdin.write(
          JSON.stringify({
            action: "upcoming",
            transactions: input.transactions,
          })
        );
        python.stdin.end();
      });
    }),

  cashFlowForecast: publicProcedure
    .input(
      z.object({
        transactions: z.array(TransactionSchema),
        income: z.number().default(5000),
      })
    )
    .mutation(async ({ input }) => {
      return new Promise((resolve, reject) => {
        const pythonScript = path.join(__dirname, "expense-forecast.py");
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
            reject(new Error(`Python script failed: ${stderr}`));
            return;
          }

          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse Python output: ${stdout}`));
          }
        });

        python.stdin.write(
          JSON.stringify({
            action: "cashflow",
            transactions: input.transactions,
            income: input.income,
          })
        );
        python.stdin.end();
      });
    }),
});
