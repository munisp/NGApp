import * as crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { userMfa, mfaAuditLog, InsertUserMfa, InsertMfaAuditLog } from '../../drizzle/schema';

/**
 * Multi-Factor Authentication Service
 * Implements TOTP (Time-based One-Time Password) authentication
 */

// TOTP configuration
const TOTP_WINDOW = 1; // Allow 1 step before/after current time
const TOTP_STEP = 30; // 30 seconds per step
const TOTP_DIGITS = 6; // 6-digit codes
const BACKUP_CODES_COUNT = 10;

/**
 * Generate a random base32 secret for TOTP
 */
export function generateTotpSecret(): string {
  const buffer = crypto.randomBytes(20);
  return base32Encode(buffer);
}

/**
 * Generate TOTP code for a given secret and time
 */
export function generateTotpCode(secret: string, time?: number): string {
  const epoch = Math.floor((time || Date.now()) / 1000);
  const counter = Math.floor(epoch / TOTP_STEP);
  
  const secretBuffer = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  
  const hmac = crypto.createHmac('sha1', secretBuffer);
  hmac.update(counterBuffer);
  const hash = hmac.digest();
  
  const offset = hash[hash.length - 1] & 0xf;
  const code = (
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)
  ) % Math.pow(10, TOTP_DIGITS);
  
  return code.toString().padStart(TOTP_DIGITS, '0');
}

/**
 * Verify TOTP code against secret
 */
export function verifyTotpCode(secret: string, code: string): boolean {
  const now = Date.now();
  
  // Check current time window and adjacent windows
  for (let i = -TOTP_WINDOW; i <= TOTP_WINDOW; i++) {
    const time = now + (i * TOTP_STEP * 1000);
    const expectedCode = generateTotpCode(secret, time);
    
    if (code === expectedCode) {
      return true;
    }
  }
  
  return false;
}

/**
 * Generate backup codes
 */
export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  
  for (let i = 0; i < BACKUP_CODES_COUNT; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  
  return codes;
}

// Encryption key for backup codes (in production, use environment variable or key management service)
const ENCRYPTION_KEY = process.env.MFA_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

/**
 * Encrypt backup codes for storage using AES-256-GCM
 */
function encryptBackupCodes(codes: string[]): string {
  const plaintext = codes.join(',');
  
  // Generate a random initialization vector
  const iv = crypto.randomBytes(16);
  
  // Create cipher with AES-256-GCM
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  // Encrypt the plaintext
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Get the authentication tag
  const authTag = cipher.getAuthTag();
  
  // Combine IV + encrypted data + auth tag
  const combined = Buffer.concat([
    iv,
    Buffer.from(encrypted, 'hex'),
    authTag
  ]);
  
  return combined.toString('base64');
}

/**
 * Decrypt backup codes from storage using AES-256-GCM
 */
function decryptBackupCodes(encrypted: string): string[] {
  try {
    // Decode the combined data
    const combined = Buffer.from(encrypted, 'base64');
    
    // Extract IV (first 16 bytes)
    const iv = combined.subarray(0, 16);
    
    // Extract auth tag (last 16 bytes)
    const authTag = combined.subarray(combined.length - 16);
    
    // Extract encrypted data (middle)
    const encryptedData = combined.subarray(16, combined.length - 16);
    
    // Create decipher
    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt
    let decrypted = decipher.update(encryptedData.toString('hex'), 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted.split(',');
  } catch (error) {
    console.error('Failed to decrypt backup codes:', error);
    throw new Error('Failed to decrypt backup codes');
  }
}

/**
 * Generate TOTP URI for QR code
 */
export function generateTotpUri(secret: string, email: string, issuer: string = 'African Fintech'): string {
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: TOTP_DIGITS.toString(),
    period: TOTP_STEP.toString(),
  });
  
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?${params.toString()}`;
}

/**
 * Enable MFA for a user
 */
export async function enableMfa(userId: number, email: string): Promise<{
  secret: string;
  qrCodeUri: string;
  backupCodes: string[];
}> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }
  
  // Generate TOTP secret and backup codes
  const secret = generateTotpSecret();
  const backupCodes = generateBackupCodes();
  const encryptedBackupCodes = encryptBackupCodes(backupCodes);
  
  // Check if MFA already exists for this user
  const existing = await db.select().from(userMfa).where(eq(userMfa.userId, userId)).limit(1);
  
  if (existing.length > 0) {
    // Update existing MFA configuration
    await db.update(userMfa)
      .set({
        totpSecret: secret,
        totpEnabled: false,
        totpVerified: false,
        backupCodes: encryptedBackupCodes,
        backupCodesUsed: 0,
        updatedAt: new Date(),
      })
      .where(eq(userMfa.userId, userId));
  } else {
    // Create new MFA configuration
    const mfaData: InsertUserMfa = {
      userId,
      totpSecret: secret,
      totpEnabled: false,
      totpVerified: false,
      backupCodes: encryptedBackupCodes,
      backupCodesUsed: 0,
    };
    
    await db.insert(userMfa).values(mfaData);
  }
  
  // Log MFA enabled event
  await logMfaEvent(userId, 'mfa_enabled', {});
  
  // Generate QR code URI
  const qrCodeUri = generateTotpUri(secret, email);
  
  return {
    secret,
    qrCodeUri,
    backupCodes,
  };
}

/**
 * Verify and activate MFA for a user
 */
export async function verifyAndActivateMfa(userId: number, code: string): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }
  
  // Get user's MFA configuration
  const mfaConfig = await db.select().from(userMfa).where(eq(userMfa.userId, userId)).limit(1);
  
  if (mfaConfig.length === 0) {
    throw new Error('MFA not configured for this user');
  }
  
  const config = mfaConfig[0];
  
  // Verify the code
  const isValid = verifyTotpCode(config.totpSecret, code);
  
  if (isValid) {
    // Activate MFA
    await db.update(userMfa)
      .set({
        totpEnabled: true,
        totpVerified: true,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userMfa.userId, userId));
    
    // Log MFA verified event
    await logMfaEvent(userId, 'mfa_verified', { success: true });
    
    return true;
  } else {
    // Log failed verification
    await logMfaEvent(userId, 'mfa_failed', { reason: 'invalid_code' });
    
    return false;
  }
}

/**
 * Verify MFA code for login
 */
export async function verifyMfaForLogin(userId: number, code: string): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }
  
  // Get user's MFA configuration
  const mfaConfig = await db.select().from(userMfa).where(eq(userMfa.userId, userId)).limit(1);
  
  if (mfaConfig.length === 0 || !mfaConfig[0].totpEnabled) {
    throw new Error('MFA not enabled for this user');
  }
  
  const config = mfaConfig[0];
  
  // Try TOTP code first
  const isValidTotp = verifyTotpCode(config.totpSecret, code);
  
  if (isValidTotp) {
    // Update last used timestamp
    await db.update(userMfa)
      .set({
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userMfa.userId, userId));
    
    // Log successful verification
    await logMfaEvent(userId, 'mfa_verified', { method: 'totp' });
    
    return true;
  }
  
  // Try backup code
  if (config.backupCodes) {
    const backupCodes = decryptBackupCodes(config.backupCodes);
    const codeIndex = backupCodes.indexOf(code.toUpperCase());
    
    if (codeIndex !== -1) {
      // Remove used backup code
      backupCodes.splice(codeIndex, 1);
      const updatedBackupCodes = encryptBackupCodes(backupCodes);
      
      await db.update(userMfa)
        .set({
          backupCodes: updatedBackupCodes,
          backupCodesUsed: config.backupCodesUsed + 1,
          lastUsedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userMfa.userId, userId));
      
      // Log backup code used
      await logMfaEvent(userId, 'backup_code_used', { remaining: backupCodes.length });
      
      return true;
    }
  }
  
  // Log failed verification
  await logMfaEvent(userId, 'mfa_failed', { reason: 'invalid_code' });
  
  return false;
}

/**
 * Disable MFA for a user
 */
export async function disableMfa(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }
  
  await db.update(userMfa)
    .set({
      totpEnabled: false,
      totpVerified: false,
      updatedAt: new Date(),
    })
    .where(eq(userMfa.userId, userId));
  
  // Log MFA disabled event
  await logMfaEvent(userId, 'mfa_disabled', {});
}

/**
 * Regenerate backup codes
 */
export async function regenerateBackupCodes(userId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }
  
  const backupCodes = generateBackupCodes();
  const encryptedBackupCodes = encryptBackupCodes(backupCodes);
  
  await db.update(userMfa)
    .set({
      backupCodes: encryptedBackupCodes,
      backupCodesUsed: 0,
      updatedAt: new Date(),
    })
    .where(eq(userMfa.userId, userId));
  
  // Log backup codes regenerated
  await logMfaEvent(userId, 'backup_codes_regenerated', {});
  
  return backupCodes;
}

/**
 * Check if MFA is enabled for a user
 */
export async function isMfaEnabled(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    return false;
  }
  
  const mfaConfig = await db.select().from(userMfa).where(eq(userMfa.userId, userId)).limit(1);
  
  return mfaConfig.length > 0 && mfaConfig[0].totpEnabled === true;
}

/**
 * Get MFA status for a user
 */
export async function getMfaStatus(userId: number): Promise<{
  enabled: boolean;
  verified: boolean;
  backupCodesRemaining: number;
  lastUsedAt: Date | null;
} | null> {
  const db = await getDb();
  if (!db) {
    return null;
  }
  
  const mfaConfig = await db.select().from(userMfa).where(eq(userMfa.userId, userId)).limit(1);
  
  if (mfaConfig.length === 0) {
    return null;
  }
  
  const config = mfaConfig[0];
  let backupCodesRemaining = 0;
  
  if (config.backupCodes) {
    const codes = decryptBackupCodes(config.backupCodes);
    backupCodesRemaining = codes.length;
  }
  
  return {
    enabled: config.totpEnabled === true,
    verified: config.totpVerified === true,
    backupCodesRemaining,
    lastUsedAt: config.lastUsedAt,
  };
}

/**
 * Log MFA event to audit log
 */
async function logMfaEvent(
  userId: number,
  event: 'mfa_enabled' | 'mfa_disabled' | 'mfa_verified' | 'mfa_failed' | 'backup_code_used' | 'backup_codes_regenerated' | 'recovery_email_updated',
  details: Record<string, any>
): Promise<void> {
  const db = await getDb();
  if (!db) {
    return;
  }
  
  const logEntry: InsertMfaAuditLog = {
    userId,
    event,
    details,
    ipAddress: null,
    userAgent: null,
  };
  
  await db.insert(mfaAuditLog).values(logEntry);
}

/**
 * Base32 encoding (RFC 4648)
 */
function base32Encode(buffer: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';
  
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }
  
  return output;
}

/**
 * Base32 decoding (RFC 4648)
 */
function base32Decode(str: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let index = 0;
  const output = Buffer.alloc(Math.ceil(str.length * 5 / 8));
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i].toUpperCase();
    const charValue = alphabet.indexOf(char);
    
    if (charValue === -1) {
      continue;
    }
    
    value = (value << 5) | charValue;
    bits += 5;
    
    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  
  return output.slice(0, index);
}
