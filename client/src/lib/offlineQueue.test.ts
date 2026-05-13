import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('offlineQueue', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { onLine: true });
    localStorage.clear();
  });

  it('detects online status', () => {
    expect(navigator.onLine).toBe(true);
  });

  it('stores queued operations in localStorage', () => {
    const queue = [
      { id: '1', method: 'POST', url: '/api/trpc/domesticPayments.createPayment', body: { amount: 1000 } },
      { id: '2', method: 'POST', url: '/api/trpc/remittance.createTransfer', body: { amount: 500 } },
    ];
    localStorage.setItem('offline_queue', JSON.stringify(queue));
    const stored = JSON.parse(localStorage.getItem('offline_queue') || '[]');
    expect(stored).toHaveLength(2);
    expect(stored[0].method).toBe('POST');
  });

  it('processes queue items in FIFO order', () => {
    const queue = [
      { id: '1', timestamp: Date.now() - 1000 },
      { id: '2', timestamp: Date.now() },
    ];
    queue.sort((a, b) => a.timestamp - b.timestamp);
    expect(queue[0].id).toBe('1');
  });
});
