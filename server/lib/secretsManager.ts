/**
 * C6: Secrets Management — centralized, audited access to sensitive config values.
 * In production, swap the in-memory store for HashiCorp Vault, AWS Secrets Manager, etc.
 */

import crypto from "crypto";
import { logger } from "./logger";

interface SecretEntry {
  name: string;
  encryptedValue: string;
  iv: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  rotateAfterDays: number;
  lastRotated: Date;
  accessLog: { actor: string; timestamp: Date; action: string }[];
}

const MASTER_KEY = process.env.SECRETS_MASTER_KEY || "54bank-dev-master-key-32-chars!1";
const secrets = new Map<string, SecretEntry>();

function encrypt(plaintext: string): { encrypted: string; iv: string } {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(MASTER_KEY, "54bank-salt", 32);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  return { encrypted, iv: iv.toString("hex") };
}

function decrypt(encrypted: string, ivHex: string): string {
  const iv = Buffer.from(ivHex, "hex");
  const key = crypto.scryptSync(MASTER_KEY, "54bank-salt", 32);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function setSecret(name: string, value: string, rotateAfterDays = 90, actor = "system"): void {
  const { encrypted, iv } = encrypt(value);
  const existing = secrets.get(name);
  const now = new Date();

  secrets.set(name, {
    name,
    encryptedValue: encrypted,
    iv,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    version: (existing?.version ?? 0) + 1,
    rotateAfterDays,
    lastRotated: now,
    accessLog: [...(existing?.accessLog ?? []), { actor, timestamp: now, action: "set" }],
  });

  logger.info("Secret updated", { name, version: (existing?.version ?? 0) + 1, actor });
}

export function getSecret(name: string, actor = "system"): string | null {
  const entry = secrets.get(name);
  if (!entry) return null;

  entry.accessLog.push({ actor, timestamp: new Date(), action: "read" });

  const daysSinceRotation = (Date.now() - entry.lastRotated.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceRotation > entry.rotateAfterDays) {
    logger.warn("Secret rotation overdue", { name, daysSinceRotation: Math.floor(daysSinceRotation), rotateAfterDays: entry.rotateAfterDays });
  }

  return decrypt(entry.encryptedValue, entry.iv);
}

export function listSecrets(): { name: string; version: number; lastRotated: Date; rotateAfterDays: number; overdue: boolean }[] {
  return Array.from(secrets.values()).map((s) => ({
    name: s.name,
    version: s.version,
    lastRotated: s.lastRotated,
    rotateAfterDays: s.rotateAfterDays,
    overdue: (Date.now() - s.lastRotated.getTime()) / (1000 * 60 * 60 * 24) > s.rotateAfterDays,
  }));
}

export function getSecretAuditLog(name: string): SecretEntry["accessLog"] {
  return secrets.get(name)?.accessLog ?? [];
}

// Seed default secrets for development
setSecret("JWT_SECRET", process.env.JWT_SECRET || "dev-test-secret-key-at-least-32-chars-long", 365, "system-init");
setSecret("DATABASE_URL", process.env.DATABASE_URL || "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db", 90, "system-init");
setSecret("REDIS_URL", process.env.REDIS_URL || "redis://localhost:6379", 180, "system-init");
