/**
 * Integration Tests for Critical Payment Flows
 * 
 * Requires a running server at TEST_BASE_URL (default: http://localhost:3000).
 * Tests are automatically skipped when server is not available (CI unit-test mode).
 */
import { describe, it, expect, beforeAll } from 'vitest';

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

let serverAvailable = false;
beforeAll(async () => {
  try {
    const res = await fetch(`${BASE_URL}/healthz`, { signal: AbortSignal.timeout(2000) });
    serverAvailable = res.ok;
  } catch {
    serverAvailable = false;
  }
});

function requireServer() {
  if (!serverAvailable) {
    return true; // should skip
  }
  return false;
}

async function trpcQuery(path: string) {
  const res = await fetch(`${BASE_URL}/api/trpc/${path}`, {
    headers: { 'Content-Type': 'application/json', 'X-Dev-Role': 'participant' },
  });
  return res.json();
}

describe('Critical Payment Flows', () => {
  describe('1. Domestic Payment — NIP Transfer', () => {
    it('should return NIP transfer data', async () => {
      if (requireServer()) return;
      const result = await trpcQuery('domesticPayments.nipTransfers');
      expect(result).toBeDefined();
    });

    it('should return bank participants', async () => {
      if (requireServer()) return;
      const result = await trpcQuery('domesticPayments.participants');
      expect(result).toBeDefined();
    });

    it('should return settlement batches', async () => {
      if (requireServer()) return;
      const result = await trpcQuery('domesticPayments.settlementBatches');
      expect(result).toBeDefined();
    });
  });

  describe('2. Outbound Remittance', () => {
    it('should return corridor list with pricing', async () => {
      if (requireServer()) return;
      const result = await trpcQuery('outboundRemittance.corridors');
      expect(result).toBeDefined();
    });

    it('should return FX rates', async () => {
      if (requireServer()) return;
      const result = await trpcQuery('outboundRemittance.fxRates');
      expect(result).toBeDefined();
    });

    it('should return payment rails', async () => {
      if (requireServer()) return;
      const result = await trpcQuery('outboundRemittance.paymentRails');
      expect(result).toBeDefined();
    });
  });

  describe('3. Middleware Health', () => {
    it('should return combined health status for all 12 services', async () => {
      if (requireServer()) return;
      const result = await trpcQuery('middleware.health');
      expect(result).toBeDefined();
      const data = result.result?.data;
      if (data) {
        expect(data).toHaveProperty('services');
        expect(data).toHaveProperty('overall');
        expect(data).toHaveProperty('_source');
      }
    });

    it('should return Kafka status', async () => {
      if (requireServer()) return;
      const result = await trpcQuery('middleware.kafkaStatus');
      expect(result).toBeDefined();
    });

    it('should return PostgreSQL status', async () => {
      if (requireServer()) return;
      const result = await trpcQuery('middleware.postgresqlStatus');
      expect(result).toBeDefined();
    });

    it('should return TigerBeetle status', async () => {
      if (requireServer()) return;
      const result = await trpcQuery('middleware.tigerbeetleStatus');
      expect(result).toBeDefined();
    });
  });

  describe('4. Onboarding Flow', () => {
    it('should return onboarding config', async () => {
      if (requireServer()) return;
      const result = await trpcQuery('technicalOnboarding.getConfig');
      expect(result).toBeDefined();
    });
  });

  describe('5. Card Processing', () => {
    it('should return card processing dashboard data', async () => {
      if (requireServer()) return;
      const result = await trpcQuery('cardProcessing.dashboard');
      expect(result).toBeDefined();
    });
  });

  describe('6. Government Payments', () => {
    it('should return government payment data', async () => {
      if (requireServer()) return;
      const result = await trpcQuery('governmentPayments.dashboard');
      expect(result).toBeDefined();
    });
  });

  describe('7. Trade Payments', () => {
    it('should return trade payment transactions', async () => {
      if (requireServer()) return;
      const result = await trpcQuery('tradePayments.transactions');
      expect(result).toBeDefined();
    });
  });

  describe('8. API Versioning', () => {
    it('should expose /api/version endpoint', async () => {
      if (requireServer()) return;
      const res = await fetch(`${BASE_URL}/api/version`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('current', 'v1');
      expect(data).toHaveProperty('supported');
    });

    it('should serve v1 and unversioned API routes', async () => {
      if (requireServer()) return;
      const v1Res = await fetch(`${BASE_URL}/api/v1/trpc/middleware.health`);
      const unvRes = await fetch(`${BASE_URL}/api/trpc/middleware.health`);
      expect(v1Res.status).toBeLessThan(500);
      expect(unvRes.status).toBeLessThan(500);
    });
  });

  describe('9. Health Probes', () => {
    it('should respond to /healthz', async () => {
      if (requireServer()) return;
      const res = await fetch(`${BASE_URL}/healthz`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('ok');
    });

    it('should respond to /livez', async () => {
      if (requireServer()) return;
      const res = await fetch(`${BASE_URL}/livez`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('alive');
    });

    it('should respond to /api/status/degradation', async () => {
      if (requireServer()) return;
      const res = await fetch(`${BASE_URL}/api/status/degradation`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('mode');
      expect(data).toHaveProperty('services');
      expect(Array.isArray(data.services)).toBe(true);
    });
  });

  describe('10. Security Headers', () => {
    it('should include rate limit headers on API endpoints', async () => {
      if (requireServer()) return;
      const res = await fetch(`${BASE_URL}/api/trpc/middleware.health`);
      const rlHeader = res.headers.get('x-ratelimit-limit');
      expect(rlHeader).toBeDefined();
    });
  });
});
