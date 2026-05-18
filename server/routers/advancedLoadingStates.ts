import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { sql, count } from "drizzle-orm";
import { platform_health_checks } from "../../drizzle/schema";

export const advancedLoadingStatesRouter = router({
  getStates: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(platform_health_checks);
    return { isLoading: false, hasError: false, totalChecks: Number(total.value), timestamp: new Date().toISOString() };
  }),
});
