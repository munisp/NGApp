/**
 * Dapr client with state management, pub/sub, service invocation, and secrets.
 */

export class DaprClient {
  private baseUrl: string;
  private stateStore: string;
  private pubsubName: string;

  constructor(httpPort: number = 3500, stateStore: string = 'statestore', pubsubName: string = 'pubsub') {
    this.baseUrl = `http://localhost:${httpPort}/v1.0`;
    this.stateStore = stateStore;
    this.pubsubName = pubsubName;
  }

  async ping(): Promise<void> {
    const resp = await fetch(`${this.baseUrl}/healthz`);
    if (!resp.ok) throw new Error(`Dapr unhealthy: ${resp.status}`);
  }

  async saveState(key: string, value: unknown, etag?: string): Promise<void> {
    const item: Record<string, unknown> = { key, value };
    if (etag) item.etag = etag;
    item.options = { concurrency: 'first-write', consistency: 'strong' };
    await fetch(`${this.baseUrl}/state/${this.stateStore}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([item]),
    });
  }

  async getState<T = unknown>(key: string): Promise<{ value: T | null; etag: string }> {
    const resp = await fetch(`${this.baseUrl}/state/${this.stateStore}/${key}`);
    if (!resp.ok) return { value: null, etag: '' };
    const etag = resp.headers.get('ETag') || '';
    const value = await resp.json() as T;
    return { value, etag };
  }

  async deleteState(key: string): Promise<void> {
    await fetch(`${this.baseUrl}/state/${this.stateStore}/${key}`, { method: 'DELETE' });
  }

  async publishEvent(topic: string, data: unknown): Promise<void> {
    await fetch(`${this.baseUrl}/publish/${this.pubsubName}/${topic}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
  }

  async invokeService(appId: string, method: string, data?: unknown, httpMethod: string = 'POST'): Promise<unknown> {
    const opts: RequestInit = { method: httpMethod, headers: { 'Content-Type': 'application/json' } };
    if (data && httpMethod !== 'GET') opts.body = JSON.stringify(data);
    const resp = await fetch(`${this.baseUrl}/invoke/${appId}/method/${method}`, opts);
    if (!resp.ok) throw new Error(`Service invoke failed (${resp.status})`);
    const text = await resp.text();
    return text ? JSON.parse(text) : null;
  }

  async getSecret(secretStore: string, secretName: string): Promise<Record<string, string>> {
    const resp = await fetch(`${this.baseUrl}/secrets/${secretStore}/${secretName}`);
    if (!resp.ok) throw new Error(`Secret retrieval failed (${resp.status})`);
    return resp.json() as Promise<Record<string, string>>;
  }

  async saveKYCSession(sessionId: string, data: Record<string, unknown>): Promise<void> {
    await this.saveState(`kyc:session:${sessionId}`, { ...data, updated_at: new Date().toISOString() });
  }

  async getKYCSession(sessionId: string): Promise<Record<string, unknown> | null> {
    const { value } = await this.getState<Record<string, unknown>>(`kyc:session:${sessionId}`);
    return value;
  }

  async publishKYCEvent(eventType: string, customerId: string, data: Record<string, unknown>): Promise<void> {
    await this.publishEvent('kyc-events', { event_type: eventType, customer_id: customerId, data, timestamp: new Date().toISOString() });
  }

  async savePolicyState(policyId: string, state: Record<string, unknown>): Promise<void> {
    await this.saveState(`policy:${policyId}`, state);
  }

  async saveClaimState(claimId: string, state: Record<string, unknown>): Promise<void> {
    await this.saveState(`claim:${claimId}`, state);
  }
}
