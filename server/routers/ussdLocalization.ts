import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { desc, eq, and, count } from "drizzle-orm";
import { auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

const ussdTranslations: Record<string, Record<string, string>> = {
  en: { welcome: "Welcome to POS Agent", select_option: "Select an option", balance: "Check Balance", transfer: "Transfer Funds", withdraw: "Withdraw", deposit: "Deposit", exit: "Exit" },
  ha: { welcome: "Barka da zuwa POS Agent", select_option: "Zaɓi wani zaɓi", balance: "Duba Balance", transfer: "Tura Kuɗi", withdraw: "Cire Kuɗi", deposit: "Ajiye Kuɗi", exit: "Fita" },
  yo: { welcome: "Ẹ ku abọ si POS Agent", select_option: "Yan aṣayan kan", balance: "Ṣayẹwo Balanse", transfer: "Fi Owo Ranṣẹ", withdraw: "Yọ Owo", deposit: "Fi Owo Pamọ", exit: "Jade" },
  ig: { welcome: "Nnọọ na POS Agent", select_option: "Họrọ nhọrọ", balance: "Lelee Balance", transfer: "Zigara Ego", withdraw: "Wepụta Ego", deposit: "Tinye Ego", exit: "Pụọ" },
  pcm: { welcome: "Welcome to POS Agent", select_option: "Pick wetin you want", balance: "Check your money", transfer: "Send money", withdraw: "Collect money", deposit: "Put money", exit: "Comot" },
};

export const ussdLocalizationRouter = router({
  list: protectedProcedure.input(z.object({ locale: z.string().optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const locale = input?.locale;
      if (locale && ussdTranslations[locale]) {
        return { translations: [{ locale, keys: ussdTranslations[locale] }], total: 1, supportedLocales: Object.keys(ussdTranslations) };
      }
      const all = Object.entries(ussdTranslations).map(([loc, keys]) => ({ locale: loc, keys, keyCount: Object.keys(keys).length }));
      return { translations: all, total: all.length, supportedLocales: Object.keys(ussdTranslations) };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
});
