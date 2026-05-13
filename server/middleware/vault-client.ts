import { createChildLogger } from '../lib/logger';

const log = createChildLogger('vault');

interface VaultConfig {
  address: string;
  token?: string;
  roleId?: string;
  secretId?: string;
  namespace?: string;
  mountPath?: string;
}

interface VaultSecret {
  data: Record<string, string>;
  metadata: {
    version: number;
    created_time: string;
    destroyed: boolean;
  };
}

export class VaultClient {
  private address: string;
  private token: string | null = null;
  private namespace: string;
  private mountPath: string;
  private cache = new Map<string, { data: VaultSecret; expiry: number }>();
  private ttl = 300_000; // 5 min cache

  constructor(config?: Partial<VaultConfig>) {
    this.address = config?.address || process.env.VAULT_ADDR || 'http://localhost:8200';
    this.token = config?.token || process.env.VAULT_TOKEN || null;
    this.namespace = config?.namespace || process.env.VAULT_NAMESPACE || '';
    this.mountPath = config?.mountPath || 'secret';

    if (config?.roleId && config?.secretId) {
      this.authenticateAppRole(config.roleId, config.secretId).catch((err) =>
        log.warn({ err }, 'AppRole auth failed, will retry on first request')
      );
    }
  }

  private async authenticateAppRole(roleId: string, secretId: string): Promise<void> {
    const resp = await fetch(`${this.address}/v1/auth/approle/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_id: roleId, secret_id: secretId }),
    });

    if (!resp.ok) {
      throw new Error(`Vault AppRole auth failed: ${resp.status}`);
    }

    const body = await resp.json();
    this.token = body.auth.client_token;
    log.info('Vault AppRole authentication successful');
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) headers['X-Vault-Token'] = this.token;
    if (this.namespace) headers['X-Vault-Namespace'] = this.namespace;
    return headers;
  }

  async getSecret(path: string): Promise<Record<string, string>> {
    const cached = this.cache.get(path);
    if (cached && Date.now() < cached.expiry) {
      return cached.data.data;
    }

    const url = `${this.address}/v1/${this.mountPath}/data/${path}`;
    const resp = await fetch(url, { headers: this.getHeaders() });

    if (!resp.ok) {
      log.error({ path, status: resp.status }, 'Failed to read secret from Vault');
      throw new Error(`Vault read failed for ${path}: ${resp.status}`);
    }

    const body = await resp.json();
    const secret: VaultSecret = {
      data: body.data.data,
      metadata: body.data.metadata,
    };

    this.cache.set(path, { data: secret, expiry: Date.now() + this.ttl });
    log.info({ path, version: secret.metadata.version }, 'Secret loaded from Vault');
    return secret.data;
  }

  async putSecret(path: string, data: Record<string, string>): Promise<void> {
    const url = `${this.address}/v1/${this.mountPath}/data/${path}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ data }),
    });

    if (!resp.ok) {
      throw new Error(`Vault write failed for ${path}: ${resp.status}`);
    }

    this.cache.delete(path);
    log.info({ path }, 'Secret written to Vault');
  }

  async getDatabaseCredentials(role: string): Promise<{ username: string; password: string }> {
    const url = `${this.address}/v1/database/creds/${role}`;
    const resp = await fetch(url, { headers: this.getHeaders() });

    if (!resp.ok) {
      throw new Error(`Vault DB creds failed for role ${role}: ${resp.status}`);
    }

    const body = await resp.json();
    log.info({ role, lease_duration: body.lease_duration }, 'Database credentials leased');
    return {
      username: body.data.username,
      password: body.data.password,
    };
  }

  async getTransitEncrypt(keyName: string, plaintext: string): Promise<string> {
    const url = `${this.address}/v1/transit/encrypt/${keyName}`;
    const encoded = Buffer.from(plaintext).toString('base64');
    const resp = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ plaintext: encoded }),
    });

    if (!resp.ok) throw new Error(`Vault transit encrypt failed: ${resp.status}`);
    const body = await resp.json();
    return body.data.ciphertext;
  }

  async getTransitDecrypt(keyName: string, ciphertext: string): Promise<string> {
    const url = `${this.address}/v1/transit/decrypt/${keyName}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ ciphertext }),
    });

    if (!resp.ok) throw new Error(`Vault transit decrypt failed: ${resp.status}`);
    const body = await resp.json();
    return Buffer.from(body.data.plaintext, 'base64').toString('utf8');
  }

  async healthCheck(): Promise<{ initialized: boolean; sealed: boolean; version: string }> {
    const resp = await fetch(`${this.address}/v1/sys/health`, {
      headers: this.getHeaders(),
    });
    const body = await resp.json();
    return {
      initialized: body.initialized,
      sealed: body.sealed,
      version: body.version,
    };
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// Singleton instance
let _vaultClient: VaultClient | null = null;

export function getVaultClient(): VaultClient {
  if (!_vaultClient) {
    _vaultClient = new VaultClient({
      address: process.env.VAULT_ADDR,
      token: process.env.VAULT_TOKEN,
      roleId: process.env.VAULT_ROLE_ID,
      secretId: process.env.VAULT_SECRET_ID,
      namespace: process.env.VAULT_NAMESPACE,
    });
  }
  return _vaultClient;
}
