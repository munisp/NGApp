import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ENCRYPTION_KEY = process.env.PII_ENCRYPTION_KEY || "default-dev-key-change-in-production-32b";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 16;

function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, 32);
}

export function encryptField(plaintext: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(ENCRYPTION_KEY, salt);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();
  return [
    salt.toString("hex"),
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted,
  ].join(":");
}

export function decryptField(ciphertext: string): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 4) {
    throw new Error("Invalid encrypted field format");
  }
  const [saltHex, ivHex, authTagHex, encrypted] = parts;
  const salt = Buffer.from(saltHex, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const key = deriveKey(ENCRYPTION_KEY, salt);
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function isEncrypted(value: string): boolean {
  const parts = value.split(":");
  return parts.length === 4 && parts[0].length === SALT_LENGTH * 2 && parts[1].length === IV_LENGTH * 2;
}

const PII_FIELDS = [
  "ssn", "social_security_number", "national_id", "nin",
  "passport_number", "drivers_license",
  "bank_account_number", "iban", "routing_number",
  "credit_card_number", "card_number", "cvv",
  "date_of_birth", "dob",
  "phone_number", "mobile_number",
  "email", "email_address",
  "home_address", "address_line_1", "address_line_2",
  "mother_maiden_name",
  "tax_id", "tin",
  "biometric_data", "fingerprint_hash",
];

export function encryptPIIFields(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string" && PII_FIELDS.some((f) => key.toLowerCase().includes(f))) {
      if (!isEncrypted(value)) {
        result[key] = encryptField(value);
      } else {
        result[key] = value;
      }
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      result[key] = encryptPIIFields(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function decryptPIIFields(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string" && PII_FIELDS.some((f) => key.toLowerCase().includes(f))) {
      if (isEncrypted(value)) {
        try {
          result[key] = decryptField(value);
        } catch {
          result[key] = value;
        }
      } else {
        result[key] = value;
      }
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      result[key] = decryptPIIFields(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function maskField(value: string, visibleChars: number = 4): string {
  if (value.length <= visibleChars) return "*".repeat(value.length);
  return "*".repeat(value.length - visibleChars) + value.slice(-visibleChars);
}

export function maskPIIForDisplay(data: Record<string, unknown>): Record<string, unknown> {
  const decrypted = decryptPIIFields(data);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(decrypted)) {
    if (typeof value === "string" && PII_FIELDS.some((f) => key.toLowerCase().includes(f))) {
      result[key] = maskField(value);
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      result[key] = maskPIIForDisplay(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}
