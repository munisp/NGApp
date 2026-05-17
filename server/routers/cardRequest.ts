/**
 * Card Request — Debit card issuance through agents
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

interface CardRequest {
  id: string; customerName: string; customerPhone: string; bvn: string;
  cardType: "verve" | "mastercard" | "visa"; agentCode: string;
  status: "pending" | "processing" | "shipped" | "delivered" | "rejected";
  fee: number; requestedAt: number; deliveredAt: number | null;
}

const requests: CardRequest[] = [];
for (let i = 1; i <= 25; i++) {
  const types: CardRequest["cardType"][] = ["verve", "mastercard", "visa"];
  const statuses: CardRequest["status"][] = ["pending", "processing", "shipped", "delivered", "rejected"];
  requests.push({
    id: `CARD-${String(i).padStart(4, "0")}`,
    customerName: `${["Adebayo", "Okonkwo", "Ibrahim", "Okafor", "Bello"][i % 5]} ${["Ade", "Chi", "Musa", "Nkem", "Femi"][i % 5]}`,
    customerPhone: `+234${String(8010000000 + i * 1111).slice(0, 10)}`,
    bvn: `${22100000000 + i}`,
    cardType: types[i % types.length],
    agentCode: `AGT${String((i % 10) + 1).padStart(3, "0")}`,
    status: statuses[i % statuses.length],
    fee: types[i % types.length] === "verve" ? 1000 : types[i % types.length] === "mastercard" ? 1500 : 2000,
    requestedAt: Date.now() - i * 604800000,
    deliveredAt: statuses[i % statuses.length] === "delivered" ? Date.now() - i * 604800000 + 1209600000 : null,
  });
}

export const cardRequestRouter = router({
  request: protectedProcedure
    .input(z.object({ customerName: z.string(), customerPhone: z.string(), bvn: z.string(), cardType: z.enum(["verve", "mastercard", "visa"]), agentCode: z.string() }))
    .mutation(({ input }) => {
      const fee = input.cardType === "verve" ? 1000 : input.cardType === "mastercard" ? 1500 : 2000;
      const req: CardRequest = {
        id: `CARD-${String(requests.length + 1).padStart(4, "0")}`,
        ...input, fee, status: "pending", requestedAt: Date.now(), deliveredAt: null,
      };
      requests.push(req);
      return { success: true, request: req };
    }),

  list: protectedProcedure
    .input(z.object({ status: z.string().optional(), agentCode: z.string().optional(), limit: z.number().default(20) }).optional())
    .query(({ input }) => {
      let filtered = [...requests].sort((a: any, b: any) => b.requestedAt - a.requestedAt);
      if (input?.status) filtered = filtered.filter(r => r.status === input.status);
      if (input?.agentCode) filtered = filtered.filter(r => r.agentCode === input.agentCode);
      return { requests: filtered.slice(0, input?.limit ?? 20), total: filtered.length };
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.string(), status: z.enum(["processing", "shipped", "delivered", "rejected"]) }))
    .mutation(({ input }) => {
      const req = requests.find(r => r.id === input.id);
      if (!req) return { success: false, error: "Request not found" };
      req.status = input.status;
      if (input.status === "delivered") req.deliveredAt = Date.now();
      return { success: true, request: req };
    }),

  analytics: protectedProcedure.query(() => ({
    total: requests.length,
    byStatus: requests.reduce((a: any, r: any) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {} as Record<string, number>),
    byType: requests.reduce((a: any, r: any) => { a[r.cardType] = (a[r.cardType] || 0) + 1; return a; }, {} as Record<string, number>),
    totalFees: requests.reduce((s: any, r: any) => s + r.fee, 0),
  })),
});
