import crypto from 'crypto';

export interface TokenizedData {
  token: string;
  dataType: TokenDataType;
  createdAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, string>;
}

export type TokenDataType = 'pan' | 'cvv' | 'pin' | 'account_number' | 'bvn' | 'nin' | 'pii' | 'biometric';

export interface DetokenizeResult {
  success: boolean;
  data?: string;
  error?: string;
}

export interface HSMConfig {
  provider: 'aws_kms' | 'azure_keyvault' | 'gcp_kms' | 'hashicorp_vault' | 'local';
  keyId: string;
  region?: string;
  endpoint?: string;
}

export interface KeyMetadata {
  keyId: string;
  version: number;
  algorithm: string;
  createdAt: Date;
  rotatedAt?: Date;
  status: 'active' | 'pending_rotation' | 'retired';
}

const tokenStore = new Map<string, { encryptedData: string; dataType: TokenDataType; metadata?: Record<string, string>; createdAt: Date; expiresAt?: Date }>();
const keyStore = new Map<string, { key: Buffer; metadata: KeyMetadata }>();

let masterKeyId = 'master-key-v1';
let currentDataKeyId = 'data-key-v1';

function initializeKeys(): void {
  if (!keyStore.has(masterKeyId)) {
    const masterKey = crypto.randomBytes(32);
    keyStore.set(masterKeyId, {
      key: masterKey,
      metadata: {
        keyId: masterKeyId,
        version: 1,
        algorithm: 'AES-256-GCM',
        createdAt: new Date(),
        status: 'active'
      }
    });
  }

  if (!keyStore.has(currentDataKeyId)) {
    const dataKey = crypto.randomBytes(32);
    keyStore.set(currentDataKeyId, {
      key: dataKey,
      metadata: {
        keyId: currentDataKeyId,
        version: 1,
        algorithm: 'AES-256-GCM',
        createdAt: new Date(),
        status: 'active'
      }
    });
  }
}

initializeKeys();

function getDataKey(): Buffer {
  const keyData = keyStore.get(currentDataKeyId);
  if (!keyData) {
    throw new Error('Data encryption key not found');
  }
  return keyData.key;
}

function encrypt(plaintext: string): { ciphertext: string; iv: string; authTag: string } {
  const key = getDataKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

function decrypt(ciphertext: string, iv: string, authTag: string): string {
  const key = getDataKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

function generateToken(dataType: TokenDataType): string {
  const prefix = getTokenPrefix(dataType);
  const randomPart = crypto.randomBytes(16).toString('hex');
  const checksum = crypto.createHash('sha256').update(randomPart).digest('hex').slice(0, 4);
  return `${prefix}_${randomPart}${checksum}`;
}

function getTokenPrefix(dataType: TokenDataType): string {
  const prefixes: Record<TokenDataType, string> = {
    pan: 'tok_pan',
    cvv: 'tok_cvv',
    pin: 'tok_pin',
    account_number: 'tok_acc',
    bvn: 'tok_bvn',
    nin: 'tok_nin',
    pii: 'tok_pii',
    biometric: 'tok_bio'
  };
  return prefixes[dataType];
}

export function tokenize(
  sensitiveData: string,
  dataType: TokenDataType,
  options?: { expiresInSeconds?: number; metadata?: Record<string, string> }
): TokenizedData {
  const token = generateToken(dataType);
  const { ciphertext, iv, authTag } = encrypt(sensitiveData);
  const encryptedData = `${iv}:${authTag}:${ciphertext}`;

  const expiresAt = options?.expiresInSeconds 
    ? new Date(Date.now() + options.expiresInSeconds * 1000)
    : undefined;

  tokenStore.set(token, {
    encryptedData,
    dataType,
    metadata: options?.metadata,
    createdAt: new Date(),
    expiresAt
  });

  logTokenOperation('tokenize', token, dataType, true);

  return {
    token,
    dataType,
    createdAt: new Date(),
    expiresAt,
    metadata: options?.metadata
  };
}

export function detokenize(token: string, purpose: string): DetokenizeResult {
  const stored = tokenStore.get(token);
  
  if (!stored) {
    logTokenOperation('detokenize', token, 'unknown' as TokenDataType, false, 'Token not found');
    return { success: false, error: 'Token not found' };
  }

  if (stored.expiresAt && stored.expiresAt < new Date()) {
    tokenStore.delete(token);
    logTokenOperation('detokenize', token, stored.dataType, false, 'Token expired');
    return { success: false, error: 'Token expired' };
  }

  try {
    const [iv, authTag, ciphertext] = stored.encryptedData.split(':');
    const decrypted = decrypt(ciphertext, iv, authTag);
    
    logTokenOperation('detokenize', token, stored.dataType, true, undefined, purpose);
    
    return { success: true, data: decrypted };
  } catch (error) {
    logTokenOperation('detokenize', token, stored.dataType, false, (error as Error).message);
    return { success: false, error: 'Decryption failed' };
  }
}

export function deleteToken(token: string): boolean {
  const existed = tokenStore.has(token);
  tokenStore.delete(token);
  logTokenOperation('delete', token, 'unknown' as TokenDataType, existed);
  return existed;
}

export function getTokenMetadata(token: string): Omit<TokenizedData, 'token'> | null {
  const stored = tokenStore.get(token);
  if (!stored) return null;
  
  return {
    dataType: stored.dataType,
    createdAt: stored.createdAt,
    expiresAt: stored.expiresAt,
    metadata: stored.metadata
  };
}

export function rotateDataKey(): KeyMetadata {
  const oldKeyId = currentDataKeyId;
  const oldKey = keyStore.get(oldKeyId);
  
  if (oldKey) {
    oldKey.metadata.status = 'pending_rotation';
  }

  const newVersion = oldKey ? oldKey.metadata.version + 1 : 1;
  const newKeyId = `data-key-v${newVersion}`;
  const newKey = crypto.randomBytes(32);
  
  keyStore.set(newKeyId, {
    key: newKey,
    metadata: {
      keyId: newKeyId,
      version: newVersion,
      algorithm: 'AES-256-GCM',
      createdAt: new Date(),
      status: 'active'
    }
  });

  currentDataKeyId = newKeyId;

  if (oldKey) {
    oldKey.metadata.status = 'retired';
    oldKey.metadata.rotatedAt = new Date();
  }

  logKeyOperation('rotate', newKeyId, newVersion);

  return keyStore.get(newKeyId)!.metadata;
}

export function getKeyMetadata(keyId?: string): KeyMetadata | null {
  const id = keyId || currentDataKeyId;
  const keyData = keyStore.get(id);
  return keyData?.metadata || null;
}

export function listKeys(): KeyMetadata[] {
  return Array.from(keyStore.values()).map(k => k.metadata);
}

const auditLog: Array<{
  timestamp: Date;
  operation: string;
  tokenId?: string;
  keyId?: string;
  dataType?: TokenDataType;
  success: boolean;
  error?: string;
  purpose?: string;
  actor?: string;
}> = [];

function logTokenOperation(
  operation: string,
  token: string,
  dataType: TokenDataType,
  success: boolean,
  error?: string,
  purpose?: string
): void {
  auditLog.push({
    timestamp: new Date(),
    operation,
    tokenId: token.slice(0, 20) + '...',
    dataType,
    success,
    error,
    purpose
  });

  if (auditLog.length > 10000) {
    auditLog.splice(0, auditLog.length - 10000);
  }
}

function logKeyOperation(operation: string, keyId: string, version: number): void {
  auditLog.push({
    timestamp: new Date(),
    operation: `key_${operation}`,
    keyId,
    success: true
  });
}

export function getAuditLog(limit: number = 100): typeof auditLog {
  return auditLog.slice(-limit);
}

export function maskPAN(pan: string): string {
  if (pan.length < 13) return '****';
  return pan.slice(0, 6) + '*'.repeat(pan.length - 10) + pan.slice(-4);
}

export function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length < 6) return '****';
  return '*'.repeat(accountNumber.length - 4) + accountNumber.slice(-4);
}

export function maskBVN(bvn: string): string {
  if (bvn.length !== 11) return '***********';
  return bvn.slice(0, 3) + '*****' + bvn.slice(-3);
}

export class TokenVaultService {
  tokenize = tokenize;
  detokenize = detokenize;
  deleteToken = deleteToken;
  getTokenMetadata = getTokenMetadata;
  rotateDataKey = rotateDataKey;
  getKeyMetadata = getKeyMetadata;
  listKeys = listKeys;
  getAuditLog = getAuditLog;
  maskPAN = maskPAN;
  maskAccountNumber = maskAccountNumber;
  maskBVN = maskBVN;
}

let tokenVaultInstance: TokenVaultService | null = null;

export function getTokenVaultService(): TokenVaultService {
  if (!tokenVaultInstance) {
    tokenVaultInstance = new TokenVaultService();
  }
  return tokenVaultInstance;
}

export default TokenVaultService;
