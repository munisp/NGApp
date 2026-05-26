/**
 * Keycloak client with token validation, caching, KYC level extraction, and admin ops.
 */

interface TokenCache { claims: Record<string, unknown>; expiresAt: number; }

export class KeycloakClient {
  private realmUrl: string;
  private clientId: string;
  private clientSecret: string;
  private adminUrl: string;
  private tokenCache = new Map<string, TokenCache>();
  private readonly cacheTTL = 300_000; // 5 minutes

  constructor(realmUrl: string, clientId: string, clientSecret: string, adminUrl: string) {
    this.realmUrl = realmUrl;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.adminUrl = adminUrl;
  }

  async ping(): Promise<void> {
    const resp = await fetch(`${this.realmUrl}/.well-known/openid-configuration`);
    if (!resp.ok) throw new Error(`Keycloak unhealthy: ${resp.status}`);
  }

  async validateToken(token: string): Promise<Record<string, unknown>> {
    const cached = this.tokenCache.get(token);
    if (cached && cached.expiresAt > Date.now()) return cached.claims;

    const resp = await fetch(`${this.realmUrl}/protocol/openid-connect/userinfo`, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) throw new Error(`Token invalid (${resp.status})`);
    const claims = await resp.json() as Record<string, unknown>;
    this.tokenCache.set(token, { claims, expiresAt: Date.now() + this.cacheTTL });

    // Evict expired entries
    for (const [k, v] of this.tokenCache) { if (v.expiresAt <= Date.now()) this.tokenCache.delete(k); }
    return claims;
  }

  getKYCLevel(claims: Record<string, unknown>): number {
    const attrs = claims.attributes as Record<string, unknown> | undefined;
    if (attrs?.kyc_level !== undefined) return Number(attrs.kyc_level);
    if (claims.kyc_level !== undefined) return Number(claims.kyc_level);
    return 0;
  }

  async getServiceToken(): Promise<string> {
    const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: this.clientId, client_secret: this.clientSecret });
    const resp = await fetch(`${this.realmUrl}/protocol/openid-connect/token`, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    if (!resp.ok) throw new Error(`Service token failed (${resp.status})`);
    const data = await resp.json() as Record<string, unknown>;
    return data.access_token as string;
  }

  async updateUserKYCLevel(userId: string, kycLevel: number): Promise<void> {
    const token = await this.getServiceToken();
    const realm = this.realmUrl.split('/realms/')[1] || 'insurance';
    await fetch(`${this.adminUrl}/admin/realms/${realm}/users/${userId}`, {
      method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ attributes: { kyc_level: [String(kycLevel)] } }),
    });
  }
}
