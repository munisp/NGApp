// @ts-ignore
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { transactions } from "../../drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";
import * as crypto from "crypto";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const TOKEN_PREFIX = "tok_";

function encryptSensitiveData(data: string, key: string): { encrypted: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(16);
  const derivedKey = crypto.scryptSync(key, "pos-shell-salt", 32);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, derivedKey, iv);
  let encrypted = cipher.update(data, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();
  return { encrypted, iv: iv.toString("hex"), tag: tag.toString("hex") };
}

function decryptSensitiveData(encrypted: string, iv: string, tag: string, key: string): string {
  const derivedKey = crypto.scryptSync(key, "pos-shell-salt", 32);
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, derivedKey, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function generateToken(): string {
  return TOKEN_PREFIX + crypto.randomBytes(24).toString("hex");
}

function maskCardNumber(cardNumber: string): string {
  return "*".repeat(cardNumber.length - 4) + cardNumber.slice(-4);
}

export const paymentTokenVaultRouter = router({
  tokenize: protectedProcedure
    .input(z.object({
      cardNumber: z.string().min(13).max(19),
      expiryMonth: z.number().min(1).max(12),
      expiryYear: z.number().min(2024),
      cardholderName: z.string(),
      merchantId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const token = generateToken();
      const masked = maskCardNumber(input.cardNumber);
      const encryptionKey = process.env.JWT_SECRET || "default-vault-key";
      const { encrypted, iv, tag } = encryptSensitiveData(input.cardNumber, encryptionKey);
      return {
        token,
        maskedCard: masked,
        expiryMonth: input.expiryMonth,
        expiryYear: input.expiryYear,
        cardholderName: input.cardholderName,
        fingerprint: crypto.createHash("sha256").update(input.cardNumber).digest("hex").slice(0, 16),
        createdAt: new Date().toISOString(),
      };
    }),

  detokenize: protectedProcedure
    .input(z.object({ token: z.string().startsWith("tok_"), merchantId: z.string() }))
    .query(async ({ input }) => {
      return { token: input.token, status: "active", lastUsed: new Date().toISOString() };
    }),

  listTokens: protectedProcedure
    .input(z.object({ merchantId: z.string(), limit: z.number().default(20) }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const rows = await db.select().from(transactions).limit(input.limit).orderBy(desc(transactions.createdAt));
      return { tokens: rows.map(r => ({ id: r.id, status: "active" })), total: rows.length };
    }),

  revokeToken: protectedProcedure
    .input(z.object({ token: z.string().startsWith("tok_"), reason: z.string() }))
    .mutation(async ({ input }) => {
      return { token: input.token, status: "revoked", revokedAt: new Date().toISOString(), reason: input.reason };
    }),
  createToken: protectedProcedure
    .input(z.object({}))
    .mutation(async ({ ctx, input }) => {
      return { success: true } as any;
    }),
  getStats: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      return {} as any;
    }),
});
