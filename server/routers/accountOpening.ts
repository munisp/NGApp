/**
 * Account Opening — Agent-facilitated bank account opening
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

interface AccountApplication {
  id: string; customerName: string; phone: string; email: string; bvn: string;
  nin: string; dob: string; gender: string; address: string; state: string;
  accountType: "savings" | "current" | "dom" | "kiddies";
  bank: string; agentCode: string;
  status: "pending" | "under_review" | "approved" | "opened" | "rejected";
  accountNumber: string | null; requestedAt: number; openedAt: number | null;
}

const applications: AccountApplication[] = [];
const banks = ["First Bank", "GTBank", "Access Bank", "UBA", "Zenith Bank", "Fidelity Bank", "Wema Bank", "Sterling Bank"];
for (let i = 1; i <= 30; i++) {
  const statuses: AccountApplication["status"][] = ["pending", "under_review", "approved", "opened", "rejected"];
  const types: AccountApplication["accountType"][] = ["savings", "current", "dom", "kiddies"];
  applications.push({
    id: `ACCT-${String(i).padStart(4, "0")}`,
    customerName: `${["Adebayo", "Okonkwo", "Ibrahim", "Okafor", "Bello"][i % 5]} ${["Ade", "Chi", "Musa", "Nkem", "Femi"][i % 5]}`,
    phone: `+234${String(8010000000 + i * 1111).slice(0, 10)}`,
    email: `customer${i}@email.com`,
    bvn: `${22100000000 + i}`, nin: `${10000000000 + i * 111}`,
    dob: `${1980 + (i % 20)}-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`,
    gender: i % 2 === 0 ? "male" : "female",
    address: `${i} ${["Allen Ave", "Broad St", "Aba Rd", "Ahmadu Bello Way", "Nnamdi Azikiwe St"][i % 5]}`,
    state: ["Lagos", "FCT", "Rivers", "Kano", "Enugu"][i % 5],
    accountType: types[i % types.length],
    bank: banks[i % banks.length],
    agentCode: `AGT${String((i % 10) + 1).padStart(3, "0")}`,
    status: statuses[i % statuses.length],
    accountNumber: statuses[i % statuses.length] === "opened" ? `${3000000000 + i}` : null,
    requestedAt: Date.now() - i * 604800000,
    openedAt: statuses[i % statuses.length] === "opened" ? Date.now() - i * 604800000 + 259200000 : null,
  });
}

export const accountOpeningRouter = router({
  submitApplication: protectedProcedure
    .input(z.object({ customerName: z.string(), phone: z.string(), email: z.string(), bvn: z.string(), nin: z.string(), dob: z.string(), gender: z.string(), address: z.string(), state: z.string(), accountType: z.enum(["savings", "current", "dom", "kiddies"]), bank: z.string(), agentCode: z.string() }))
    .mutation(({ input }) => {
      const app: AccountApplication = {
        id: `ACCT-${String(applications.length + 1).padStart(4, "0")}`,
        ...input, status: "pending", accountNumber: null, requestedAt: Date.now(), openedAt: null,
      };
      applications.push(app);
      return { success: true, application: app };
    }),

  list: protectedProcedure
    .input(z.object({ status: z.string().optional(), bank: z.string().optional(), agentCode: z.string().optional(), limit: z.number().default(20) }).optional())
    .query(({ input }) => {
      let filtered = [...applications].sort((a: any, b: any) => b.requestedAt - a.requestedAt);
      if (input?.status) filtered = filtered.filter(a => a.status === input.status);
      if (input?.bank) filtered = filtered.filter(a => a.bank === input.bank);
      if (input?.agentCode) filtered = filtered.filter(a => a.agentCode === input.agentCode);
      return { applications: filtered.slice(0, input?.limit ?? 20), total: filtered.length };
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.string(), status: z.enum(["under_review", "approved", "opened", "rejected"]), accountNumber: z.string().optional() }))
    .mutation(({ input }) => {
      const app = applications.find(a => a.id === input.id);
      if (!app) return { success: false, error: "Application not found" };
      app.status = input.status;
      if (input.status === "opened") { app.accountNumber = input.accountNumber || `${3000000000 + applications.length}`; app.openedAt = Date.now(); }
      return { success: true, application: app };
    }),

  analytics: protectedProcedure.query(() => ({
    total: applications.length,
    byStatus: applications.reduce((a: any, app: any) => { a[app.status] = (a[app.status] || 0) + 1; return a; }, {} as Record<string, number>),
    byBank: applications.reduce((a: any, app: any) => { a[app.bank] = (a[app.bank] || 0) + 1; return a; }, {} as Record<string, number>),
    byType: applications.reduce((a: any, app: any) => { a[app.accountType] = (a[app.accountType] || 0) + 1; return a; }, {} as Record<string, number>),
    conversionRate: applications.length > 0 ? Math.round(applications.filter(a => a.status === "opened").length / applications.length * 100) : 0,
  })),
});
