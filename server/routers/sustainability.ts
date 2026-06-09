/**
 * Sustainability / Carbon Offsets router
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { carbonOffsets, walletBalances } from "../../drizzle/schema";
import { eq, and, desc, sum, sql } from "drizzle-orm";

// Carbon offset projects catalogue (static reference data)
export const OFFSET_PROJECTS = [
  { id: "proj-001", name: "Kariba REDD+ Forest Protection", country: "ZW", pricePerTon: 12.5, category: "forestry" },
  { id: "proj-002", name: "Kenya Wind Energy", country: "KE", pricePerTon: 9.0, category: "renewable" },
  { id: "proj-003", name: "Nigeria Clean Cookstoves", country: "NG", pricePerTon: 7.5, category: "clean_energy" },
  { id: "proj-004", name: "Tanzania Mangrove Restoration", country: "TZ", pricePerTon: 15.0, category: "blue_carbon" },
  { id: "proj-005", name: "Ghana Solar Mini-Grids", country: "GH", pricePerTon: 8.0, category: "renewable" },
];

export const sustainabilityRouter = router({
  // List available offset projects
  listProjects: protectedProcedure.query(() => {
    return OFFSET_PROJECTS;
  }),

  // Get user's purchased offsets
  myOffsets: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(carbonOffsets)
      .where(eq(carbonOffsets.userId, String(ctx.user.id)))
      .orderBy(desc(carbonOffsets.createdAt));
  }),

  // Purchase a carbon offset — deducts from USDC wallet balance
  purchaseOffset: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        amountTons: z.number().positive().max(1000),
        vintageYear: z.number().int().min(2020).max(2030).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const project = OFFSET_PROJECTS.find((p) => p.id === input.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Offset project not found" });
      const costUsd = parseFloat((input.amountTons * project.pricePerTon).toFixed(2));
      // Atomic wallet deduction from USDC balance
      const result = await db.execute(
        sql`UPDATE wallet_balances
            SET balance = (CAST(balance AS DECIMAL(30,8)) - ${costUsd})::TEXT,
                updated_at = ${Math.floor(Date.now() / 1000)}
            WHERE user_id = ${String(ctx.user.id)}
              AND currency = 'USDC'
              AND CAST(balance AS DECIMAL(30,8)) >= ${costUsd}
            RETURNING id, balance`
      );
      if (!(result as any[])[0]) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Insufficient USDC balance. Need $${costUsd.toFixed(2)} to purchase ${input.amountTons} tons of carbon offsets.`,
        });
      }
      const [row] = await db
        .insert(carbonOffsets)
        .values({
          userId: String(ctx.user.id),
          amount: String(input.amountTons),
          projectName: project.name,
          projectCountry: project.country,
          costUsd: costUsd.toFixed(2),
          vintageYear: input.vintageYear ?? new Date().getFullYear(),
        })
        .returning();
      return row;
    }),

  // Stats for the Sustainability page
  stats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { totalOffsetTons: 0, totalSpentUsd: 0, purchaseCount: 0 };
    const rows = await db
      .select()
      .from(carbonOffsets)
      .where(eq(carbonOffsets.userId, String(ctx.user.id)));
    const totalOffsetTons = rows.reduce((s, r) => s + parseFloat(r.amount), 0);
    const totalSpentUsd = rows.reduce((s, r) => s + parseFloat(r.costUsd), 0);
    return {
      totalOffsetTons: Math.round(totalOffsetTons * 100) / 100,
      totalSpentUsd: Math.round(totalSpentUsd * 100) / 100,
      purchaseCount: rows.length,
    };
  }),
});
