import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { spawn } from "child_process";
import path from "path";

const NotificationContextSchema = z.object({
  amount: z.number().optional(),
  days_until_due: z.number().optional(),
  progress: z.number().optional(),
  balance: z.number().optional(),
  threshold: z.number().optional(),
});

const InteractionSchema = z.object({
  type: z.string(),
  timestamp: z.string(),
  engaged: z.boolean(),
});

const RecentNotificationSchema = z.object({
  type: z.string(),
  timestamp: z.string(),
});

const HistoricalDataSchema = z.object({
  interactions: z.array(InteractionSchema).optional(),
  recent_notifications: z.array(RecentNotificationSchema).optional(),
  preferences: z.record(z.string(), z.any()).optional(),
});

const SmartNotificationInputSchema = z.object({
  notification_type: z.string(),
  context: NotificationContextSchema,
  historical_data: HistoricalDataSchema.optional(),
});

/**
 * Call Python smart notification service
 */
async function callSmartNotificationService(input: z.infer<typeof SmartNotificationInputSchema>): Promise<any> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, "smart-notifications.py");
    const pythonProcess = spawn("python3", [scriptPath]);

    let stdout = "";
    let stderr = "";

    pythonProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Smart notification service failed: ${stderr}`));
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
        reject(new Error(`Failed to parse smart notification result: ${error}`));
      }
    });

    // Send input to Python script
    pythonProcess.stdin.write(JSON.stringify(input));
    pythonProcess.stdin.end();
  });
}

import { protectedProcedure } from "../_core/trpc";

export const smartNotificationsRouter = router({
  /**
   * Generate smart notification with AI optimization
   */
  generate: protectedProcedure
    .input(SmartNotificationInputSchema)
    .mutation(async ({ input }) => {
      const result = await callSmartNotificationService(input);
      return result;
    }),

  /**
   * Record notification interaction for learning
   */
  recordInteraction: protectedProcedure
    .input(
      z.object({
        notification_type: z.string(),
        engaged: z.boolean(),
        timestamp: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // In a real implementation, this would store the interaction in a database
      // For now, we'll just return success
      return {
        success: true,
        interaction: {
          type: input.notification_type,
          engaged: input.engaged,
          timestamp: input.timestamp || new Date().toISOString(),
        },
      };
    }),

  /**
   * Get notification preferences
   */
  getPreferences: protectedProcedure
    .query(async () => {
      // Default preferences
      return {
        transaction_max_per_day: 10,
        transaction_min_interval: 30,
        bill_max_per_day: 5,
        bill_min_interval: 120,
        goal_max_per_day: 3,
        goal_min_interval: 240,
        balance_max_per_day: 3,
        balance_min_interval: 360,
        security_max_per_day: 20,
        security_min_interval: 5,
      };
    }),

  /**
   * Update notification preferences
   */
  updatePreferences: protectedProcedure
    .input(z.record(z.string(), z.any()))
    .mutation(async ({ input }) => {
      // In a real implementation, this would store preferences in a database
      return {
        success: true,
        preferences: input,
      };
    }),
});
