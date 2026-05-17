// USSD Receipt Printer Router — Sprint 76
// Generate thermal receipts for completed *384# USSD transactions
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

const RECEIPT_WIDTH = 32;

const TEMPLATES: Record<string, { header: string; footer: string; locale: string }> = {
  en: { header: "54LINK POS SERVICES", footer: "Thank you for banking with 54Link", locale: "en" },
  fr: { header: "SERVICES POS 54LINK", footer: "Merci d'utiliser 54Link", locale: "fr" },
  sw: { header: "HUDUMA ZA POS 54LINK", footer: "Asante kwa kutumia 54Link", locale: "sw" },
  ha: { header: "SABIS NA POS 54LINK", footer: "Na gode da amfani da 54Link", locale: "ha" },
  yo: { header: "ISE POS 54LINK", footer: "E se fun lilo 54Link", locale: "yo" },
};

const TX_TYPE_NAMES: Record<string, string> = {
  cash_in: "CASH IN", cash_out: "CASH OUT", balance: "BALANCE INQUIRY",
  transfer: "TRANSFER", airtime: "AIRTIME", bills: "BILL PAYMENT",
};

function center(s: string, w: number): string {
  if (s.length >= w) return s.substring(0, w);
  const pad = Math.floor((w - s.length) / 2);
  return " ".repeat(pad) + s + " ".repeat(w - pad - s.length);
}

function maskPhone(phone: string): string {
  if (phone.length < 6) return phone;
  return phone.substring(0, 3) + "*".repeat(phone.length - 6) + phone.substring(phone.length - 3);
}

function formatReceipt(tx: any, locale: string): string {
  const tmpl = TEMPLATES[locale] || TEMPLATES.en;
  const sep = "=".repeat(RECEIPT_WIDTH);
  const dash = "-".repeat(RECEIPT_WIDTH);
  const txName = TX_TYPE_NAMES[tx.type] || tx.type.toUpperCase();
  const date = new Date(tx.timestamp).toISOString().replace("T", " ").substring(0, 19);
  return [
    sep, center(tmpl.header, RECEIPT_WIDTH), center(txName, RECEIPT_WIDTH), sep,
    `Ref:    ${tx.reference}`, `Date:   ${date}`,
    `Agent:  ${tx.agentName}`, `Phone:  ${maskPhone(tx.customerPhone)}`,
    dash, `Amount: ${tx.currency} ${tx.amount.toFixed(2)}`,
    `Status: ${tx.status.toUpperCase()}`,
    `Via:    USSD ${tx.shortCode}`, `Net:    ${tx.carrier}`,
    dash, center(tmpl.footer, RECEIPT_WIDTH), sep,
  ].join("\n");
}

const receipts: Array<{ id: string; txId: string; content: string; printStatus: string; createdAt: number; printedAt?: number }> = [];

export const ussdReceiptRouter = router({
  generate: protectedProcedure
    .input(z.object({
      id: z.string(),
      type: z.string(),
      amount: z.number(),
      currency: z.string(),
      agentName: z.string(),
      customerPhone: z.string(),
      carrier: z.string(),
      shortCode: z.string(),
      reference: z.string(),
      status: z.string(),
      timestamp: z.number(),
      locale: z.string().default("en"),
    }))
    .mutation(({ input }) => {
      const content = formatReceipt(input, input.locale);
      const receipt = {
        id: `RCP-${Date.now()}-${input.id.substring(0, 8)}`,
        txId: input.id,
        content,
        printStatus: "queued" as string,
        createdAt: Date.now(),
      };
      receipts.push(receipt);
      return receipt;
    }),

  print: protectedProcedure
    .input(z.object({ receiptId: z.string() }))
    .mutation(({ input }) => {
      const receipt = receipts.find(r => r.id === input.receiptId);
      if (!receipt) return { status: "not_found" };
      receipt.printStatus = "printed";
      receipt.printedAt = Date.now();
      return { status: "printed", receiptId: receipt.id };
    }),

  getReceipts: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }))
    .query(({ input }) => receipts.slice(-input.limit)),

  getTemplates: protectedProcedure.query(() => TEMPLATES),
});
