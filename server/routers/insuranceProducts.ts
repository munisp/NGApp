/**
 * Insurance Products — Micro-insurance for agents and customers
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

interface InsuranceProduct {
  id: string; name: string; category: "life" | "health" | "device" | "business" | "crop";
  provider: string; premium: number; premiumFrequency: "monthly" | "quarterly" | "annually";
  coverageAmount: number; description: string; status: "active" | "inactive";
}

interface InsurancePolicy {
  id: string; productId: string; productName: string; holderName: string; holderPhone: string;
  agentCode: string; premium: number; coverageAmount: number;
  status: "active" | "lapsed" | "claimed" | "cancelled"; startDate: number;
  endDate: number; lastPayment: number; claimAmount: number | null;
}

const products: InsuranceProduct[] = [
  { id: "INS-001", name: "Agent Device Protection", category: "device", provider: "Leadway Assurance", premium: 500, premiumFrequency: "monthly", coverageAmount: 150000, description: "Covers POS terminal damage, theft, and malfunction", status: "active" },
  { id: "INS-002", name: "Micro Health Cover", category: "health", provider: "AXA Mansard", premium: 1000, premiumFrequency: "monthly", coverageAmount: 500000, description: "Basic health coverage for agents and families", status: "active" },
  { id: "INS-003", name: "Business Continuity", category: "business", provider: "AIICO Insurance", premium: 2500, premiumFrequency: "monthly", coverageAmount: 2000000, description: "Covers business interruption and loss of income", status: "active" },
  { id: "INS-004", name: "Customer Life Cover", category: "life", provider: "Custodian Life", premium: 300, premiumFrequency: "monthly", coverageAmount: 1000000, description: "Term life insurance sold through agents", status: "active" },
  { id: "INS-005", name: "Crop Insurance", category: "crop", provider: "NAICOM", premium: 1500, premiumFrequency: "quarterly", coverageAmount: 500000, description: "Agricultural insurance for farming communities", status: "active" },
];

const policies: InsurancePolicy[] = [];
for (let i = 1; i <= 40; i++) {
  const product = products[i % products.length];
  policies.push({
    id: `POL-${String(i).padStart(4, "0")}`,
    productId: product.id, productName: product.name,
    holderName: `${["Adebayo", "Okonkwo", "Ibrahim", "Okafor", "Bello"][i % 5]} ${["Ade", "Chi", "Musa", "Nkem", "Femi"][i % 5]}`,
    holderPhone: `+234${String(8010000000 + i * 1111).slice(0, 10)}`,
    agentCode: `AGT${String((i % 10) + 1).padStart(3, "0")}`,
    premium: product.premium, coverageAmount: product.coverageAmount,
    status: i % 8 === 0 ? "lapsed" : i % 12 === 0 ? "claimed" : i % 15 === 0 ? "cancelled" : "active",
    startDate: Date.now() - i * 2592000000,
    endDate: Date.now() + (365 - i * 10) * 86400000,
    lastPayment: Date.now() - (i % 8 === 0 ? 90 : 15) * 86400000,
    claimAmount: i % 12 === 0 ? Math.floor(product.coverageAmount * 0.5) : null,
  });
}

export const insuranceProductsRouter = router({
  products: protectedProcedure.query(() => ({ products: products.filter(p => p.status === "active") })),

  enroll: protectedProcedure
    .input(z.object({ productId: z.string(), holderName: z.string(), holderPhone: z.string(), agentCode: z.string() }))
    .mutation(({ input }) => {
      const product = products.find(p => p.id === input.productId);
      if (!product || product.status !== "active") return { success: false, error: "Product not available" };
      const policy: InsurancePolicy = {
        id: `POL-${String(policies.length + 1).padStart(4, "0")}`,
        productId: input.productId, productName: product.name,
        holderName: input.holderName, holderPhone: input.holderPhone,
        agentCode: input.agentCode, premium: product.premium, coverageAmount: product.coverageAmount,
        status: "active", startDate: Date.now(), endDate: Date.now() + 365 * 86400000,
        lastPayment: Date.now(), claimAmount: null,
      };
      policies.push(policy);
      return { success: true, policy };
    }),

  policies: protectedProcedure
    .input(z.object({ status: z.string().optional(), agentCode: z.string().optional(), limit: z.number().default(20) }).optional())
    .query(({ input }) => {
      let filtered = [...policies].sort((a: any, b: any) => b.startDate - a.startDate);
      if (input?.status) filtered = filtered.filter(p => p.status === input.status);
      if (input?.agentCode) filtered = filtered.filter(p => p.agentCode === input.agentCode);
      return { policies: filtered.slice(0, input?.limit ?? 20), total: filtered.length };
    }),

  fileClaim: protectedProcedure
    .input(z.object({ policyId: z.string(), claimAmount: z.number(), reason: z.string() }))
    .mutation(({ input }) => {
      const policy = policies.find(p => p.id === input.policyId);
      if (!policy || policy.status !== "active") return { success: false, error: "Policy not active" };
      if (input.claimAmount > policy.coverageAmount) return { success: false, error: "Claim exceeds coverage" };
      policy.status = "claimed"; policy.claimAmount = input.claimAmount;
      return { success: true, policy };
    }),

  analytics: protectedProcedure.query(() => ({
    totalPolicies: policies.length,
    activePolicies: policies.filter(p => p.status === "active").length,
    totalPremiumCollected: policies.reduce((s: any, p: any) => s + p.premium * 3, 0),
    totalClaimsPaid: policies.filter(p => p.claimAmount).reduce((s: any, p: any) => s + (p.claimAmount || 0), 0),
    lapsedRate: policies.length > 0 ? Math.round(policies.filter(p => p.status === "lapsed").length / policies.length * 100) : 0,
    byProduct: products.map(p => ({ name: p.name, count: policies.filter(pol => pol.productId === p.id).length })),
  })),
});
