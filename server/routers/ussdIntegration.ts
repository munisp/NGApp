import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and, sum } from "drizzle-orm";
import { transactions, agents, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const ussdIntegrationRouter = router({
  handleInput: protectedProcedure.input(z.object({ sessionId: z.string().min(1), phoneNumber: z.string().regex(/^\+?[0-9]{10,15}$/), serviceCode: z.string().min(1), input: z.string() })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const menuMap: Record<string, string> = { "1": "Check Balance", "2": "Send Money", "3": "Buy Airtime", "4": "Pay Bills", "5": "My Account" };
      const menuText = menuMap[input.input] ?? "Invalid option";
      await db.insert(auditLog).values({ action: "ussd_input_handled", resource: "ussd_integration", resourceId: input.sessionId, status: "success", metadata: { phoneNumber: input.phoneNumber, serviceCode: input.serviceCode, userInput: input.input, selectedMenu: menuText } });
      return { sessionId: input.sessionId, response: menuText === "Invalid option" ? "CON Invalid option. Try again:\n1. Check Balance\n2. Send Money\n3. Buy Airtime\n4. Pay Bills\n5. My Account" : `CON ${menuText}:\nEnter amount or press 0 to go back`, continueSession: true };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getMenuConfig: protectedProcedure.query(async () => {
    return { menus: [{ code: "1", label: "Check Balance" }, { code: "2", label: "Send Money" }, { code: "3", label: "Buy Airtime" }, { code: "4", label: "Pay Bills" }, { code: "5", label: "My Account" }], serviceCode: "*347#", timeout: 30 };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.action, "ussd_input_handled")).limit(100);
    return { totalInputs: Number(total.value) };
  }),
});
