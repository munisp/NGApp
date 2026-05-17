import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
const mccCodes = [
  { code: "5411", description: "Grocery Stores, Supermarkets", category: "Food & Beverage", riskLevel: "low", transactionLimit: 50000 },
  { code: "5541", description: "Service Stations (Fuel)", category: "Automotive", riskLevel: "low", transactionLimit: 25000 },
  { code: "5812", description: "Eating Places, Restaurants", category: "Food & Beverage", riskLevel: "low", transactionLimit: 15000 },
  { code: "5912", description: "Drug Stores, Pharmacies", category: "Healthcare", riskLevel: "low", transactionLimit: 20000 },
  { code: "5999", description: "Miscellaneous Retail", category: "Retail", riskLevel: "medium", transactionLimit: 30000 },
  { code: "6011", description: "Financial Institutions - Cash", category: "Financial", riskLevel: "high", transactionLimit: 100000 },
  { code: "6012", description: "Financial Institutions - Merch", category: "Financial", riskLevel: "high", transactionLimit: 200000 },
  { code: "7011", description: "Hotels, Motels, Resorts", category: "Travel", riskLevel: "medium", transactionLimit: 75000 },
  { code: "7995", description: "Gambling Transactions", category: "Entertainment", riskLevel: "high", transactionLimit: 10000 },
  { code: "8011", description: "Doctors", category: "Healthcare", riskLevel: "low", transactionLimit: 50000 },
  { code: "8062", description: "Hospitals", category: "Healthcare", riskLevel: "low", transactionLimit: 500000 },
  { code: "4814", description: "Telecom Services", category: "Utilities", riskLevel: "low", transactionLimit: 10000 },
];
export const mccManagerRouter = router({
  getStats: protectedProcedure.query(async () => ({
    totalCodes: 450, activeCodes: 420, categories: 18, highRisk: 35, mediumRisk: 85, lowRisk: 300,
    lastUpdated: Date.now() - 604800000, merchantsMapped: 12500,
  })),
  listCodes: protectedProcedure.input(z.object({ category: z.string().optional(), riskLevel: z.string().optional() }).optional())
    .query(async ({ input }) => {
      let filtered = mccCodes;
      if (input?.category) filtered = filtered.filter(m => m.category === input.category);
      if (input?.riskLevel) filtered = filtered.filter(m => m.riskLevel === input.riskLevel);
      return { codes: filtered, total: filtered.length };
    }),
  lookupCode: protectedProcedure.input(z.object({ code: z.string() }))
    .query(async ({ input }) => mccCodes.find(m => m.code === input.code) || null),
  updateLimit: protectedProcedure.input(z.object({ code: z.string(), transactionLimit: z.number() }))
    .mutation(async ({ input }) => ({ success: true, code: input.code, newLimit: input.transactionLimit, updatedAt: Date.now() })),
});
