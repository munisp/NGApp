/**
 * Offline-First Queue for EscrowProtect PWA
 * 
 * IndexedDB-backed outbox that stores "intent + evidence" for:
 * - Escrow creation requests
 * - Evidence uploads (OCR text, hashes, screenshots)
 * - Payment confirmations
 * - Delivery confirmations
 * 
 * Features:
 * - Automatic retry with exponential backoff
 * - Idempotency key generation
 * - Network status detection
 * - Sync when online
 */

// Types
export interface QueuedRequest {
  id: string;
  idempotencyKey: string;
  type: RequestType;
  payload: Record<string, unknown>;
  evidence: Evidence;
  status: QueueStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  error?: string;
  response?: Record<string, unknown>;
}

export interface Evidence {
  listingText?: string;
  ocrTextHash?: string;
  screenshotHash?: string;
  deviceMetadata?: DeviceMetadata;
  timestamp: string;
  sourceUrl?: string;
  sellerHandle?: string;
}

export interface DeviceMetadata {
  userAgent: string;
  platform: string;
  language: string;
  timezone: string;
  screenWidth: number;
  screenHeight: number;
}

export enum RequestType {
  ESCROW_CREATE = 'escrow_create',
  ESCROW_CAPTURE = 'escrow_capture',
  ESCROW_RELEASE = 'escrow_release',
  ESCROW_REFUND = 'escrow_refund',
  EVIDENCE_UPLOAD = 'evidence_upload',
  DELIVERY_CONFIRM = 'delivery_confirm',
  DISPUTE_CREATE = 'dispute_create',
}

export enum QueueStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

// Constants
const DB_NAME = 'escrow-offline-queue';
const DB_VERSION = 1;
const STORE_NAME = 'requests';
const MAX_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 60000;
const QUEUE_EXPIRY_HOURS = 72;

// IndexedDB wrapper
class OfflineQueueDB {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  async open(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('idempotencyKey', 'idempotencyKey', { unique: true });
          store.createIndex('nextRetryAt', 'nextRetryAt', { unique: false });
        }
      };
    });

    return this.dbPromise;
  }

  async add(request: QueuedRequest): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.add(request);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  }

  async update(request: QueuedRequest): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(request);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  }

  async get(id: string): Promise<QueuedRequest | undefined> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });
  }

  async getByIdempotencyKey(key: string): Promise<QueuedRequest | undefined> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('idempotencyKey');
      const req = index.get(key);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });
  }

  async getPending(): Promise<QueuedRequest[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('status');
      const req = index.getAll(QueueStatus.PENDING);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });
  }

  async getReadyForRetry(): Promise<QueuedRequest[]> {
    const db = await this.open();
    const now = new Date().toISOString();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const results: QueuedRequest[] = [];
      
      const req = store.openCursor();
      req.onerror = () => reject(req.error);
      req.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const request = cursor.value as QueuedRequest;
          if (
            request.status === QueueStatus.PENDING &&
            (!request.nextRetryAt || request.nextRetryAt <= now)
          ) {
            results.push(request);
          }
          cursor.continue();
        } else {
          resolve(results);
        }
      };
    });
  }

  async delete(id: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  }

  async getAll(): Promise<QueuedRequest[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });
  }

  async clear(): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  }
}

// Utility functions
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

function generateIdempotencyKey(type: RequestType, payload: Record<string, unknown>): string {
  const data = JSON.stringify({ type, ...payload });
  // Simple hash for idempotency
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `idem-${type}-${Math.abs(hash).toString(36)}-${Date.now().toString(36)}`;
}

function getDeviceMetadata(): DeviceMetadata {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
  };
}

function calculateRetryDelay(attempts: number): number {
  const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempts);
  const jitter = Math.random() * 1000;
  return Math.min(delay + jitter, MAX_RETRY_DELAY_MS);
}

async function hashText(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Main OfflineQueue class
export class OfflineQueue {
  private db: OfflineQueueDB;
  private isOnline: boolean;
  private syncInProgress: boolean = false;
  private syncInterval: number | null = null;
  private apiBaseUrl: string;
  private onStatusChange?: (request: QueuedRequest) => void;

  constructor(apiBaseUrl: string = '/api/v1') {
    this.db = new OfflineQueueDB();
    this.isOnline = navigator.onLine;
    this.apiBaseUrl = apiBaseUrl;

    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.sync();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  /**
   * Initialize the queue and start background sync
   */
  async initialize(): Promise<void> {
    await this.db.open();
    
    // Start periodic sync
    this.syncInterval = window.setInterval(() => {
      if (this.isOnline) {
        this.sync();
      }
    }, 30000); // Sync every 30 seconds

    // Initial sync
    if (this.isOnline) {
      this.sync();
    }
  }

  /**
   * Set callback for status changes
   */
  onRequestStatusChange(callback: (request: QueuedRequest) => void): void {
    this.onStatusChange = callback;
  }

  /**
   * Queue a new request
   */
  async enqueue(
    type: RequestType,
    payload: Record<string, unknown>,
    evidence?: Partial<Evidence>
  ): Promise<QueuedRequest> {
    const idempotencyKey = generateIdempotencyKey(type, payload);
    
    // Check for existing request with same idempotency key
    const existing = await this.db.getByIdempotencyKey(idempotencyKey);
    if (existing) {
      if (existing.status === QueueStatus.COMPLETED) {
        return existing;
      }
      // Return existing pending request
      return existing;
    }

    const request: QueuedRequest = {
      id: generateId(),
      idempotencyKey,
      type,
      payload,
      evidence: {
        timestamp: new Date().toISOString(),
        deviceMetadata: getDeviceMetadata(),
        ...evidence,
      },
      status: QueueStatus.PENDING,
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      createdAt: new Date().toISOString(),
    };

    // Hash evidence text if provided
    if (evidence?.listingText) {
      request.evidence.ocrTextHash = await hashText(evidence.listingText);
    }

    await this.db.add(request);

    // Try to sync immediately if online
    if (this.isOnline) {
      this.sync();
    }

    return request;
  }

  /**
   * Queue escrow creation
   */
  async queueEscrowCreate(
    buyerId: string,
    sellerId: string,
    amount: number,
    currency: string,
    listingText: string,
    sourceUrl?: string,
    sellerHandle?: string
  ): Promise<QueuedRequest> {
    return this.enqueue(
      RequestType.ESCROW_CREATE,
      { buyerId, sellerId, amount, currency },
      { listingText, sourceUrl, sellerHandle }
    );
  }

  /**
   * Queue evidence upload
   */
  async queueEvidenceUpload(
    escrowId: string,
    evidenceType: string,
    data: string,
    sourceUrl?: string
  ): Promise<QueuedRequest> {
    return this.enqueue(
      RequestType.EVIDENCE_UPLOAD,
      { escrowId, evidenceType, data },
      { sourceUrl }
    );
  }

  /**
   * Queue delivery confirmation
   */
  async queueDeliveryConfirm(
    escrowId: string,
    confirmationType: 'buyer' | 'seller',
    notes?: string
  ): Promise<QueuedRequest> {
    return this.enqueue(
      RequestType.DELIVERY_CONFIRM,
      { escrowId, confirmationType, notes }
    );
  }

  /**
   * Sync pending requests with server
   */
  async sync(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) {
      return;
    }

    this.syncInProgress = true;

    try {
      // Get requests ready for retry
      const requests = await this.db.getReadyForRetry();
      
      // Clean up expired requests
      await this.cleanupExpired();

      // Process each request
      for (const request of requests) {
        await this.processRequest(request);
      }
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Process a single request
   */
  private async processRequest(request: QueuedRequest): Promise<void> {
    // Mark as processing
    request.status = QueueStatus.PROCESSING;
    request.attempts += 1;
    request.lastAttemptAt = new Date().toISOString();
    await this.db.update(request);
    this.notifyStatusChange(request);

    try {
      const response = await this.sendRequest(request);
      
      // Success
      request.status = QueueStatus.COMPLETED;
      request.response = response;
      await this.db.update(request);
      this.notifyStatusChange(request);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (request.attempts >= request.maxAttempts) {
        // Max attempts reached
        request.status = QueueStatus.FAILED;
        request.error = errorMessage;
      } else {
        // Schedule retry
        request.status = QueueStatus.PENDING;
        request.error = errorMessage;
        const delay = calculateRetryDelay(request.attempts);
        request.nextRetryAt = new Date(Date.now() + delay).toISOString();
      }
      
      await this.db.update(request);
      this.notifyStatusChange(request);
    }
  }

  /**
   * Send request to server
   */
  private async sendRequest(request: QueuedRequest): Promise<Record<string, unknown>> {
    const endpoints: Record<RequestType, string> = {
      [RequestType.ESCROW_CREATE]: '/escrow/create',
      [RequestType.ESCROW_CAPTURE]: '/escrow/capture',
      [RequestType.ESCROW_RELEASE]: '/escrow/release',
      [RequestType.ESCROW_REFUND]: '/escrow/refund',
      [RequestType.EVIDENCE_UPLOAD]: '/evidence/upload',
      [RequestType.DELIVERY_CONFIRM]: '/delivery/confirm',
      [RequestType.DISPUTE_CREATE]: '/dispute/create',
    };

    const endpoint = endpoints[request.type];
    const url = `${this.apiBaseUrl}${endpoint}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': request.idempotencyKey,
        'X-Evidence-Hash': request.evidence.ocrTextHash || '',
        'X-Device-Timezone': request.evidence.deviceMetadata?.timezone || '',
      },
      body: JSON.stringify({
        ...request.payload,
        evidence: request.evidence,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Clean up expired requests
   */
  private async cleanupExpired(): Promise<void> {
    const all = await this.db.getAll();
    const expiryTime = Date.now() - (QUEUE_EXPIRY_HOURS * 60 * 60 * 1000);

    for (const request of all) {
      const createdAt = new Date(request.createdAt).getTime();
      if (createdAt < expiryTime && request.status !== QueueStatus.COMPLETED) {
        request.status = QueueStatus.EXPIRED;
        await this.db.update(request);
        this.notifyStatusChange(request);
      }
    }
  }

  /**
   * Notify status change
   */
  private notifyStatusChange(request: QueuedRequest): void {
    if (this.onStatusChange) {
      this.onStatusChange(request);
    }
  }

  /**
   * Get all queued requests
   */
  async getAll(): Promise<QueuedRequest[]> {
    return this.db.getAll();
  }

  /**
   * Get pending requests
   */
  async getPending(): Promise<QueuedRequest[]> {
    return this.db.getPending();
  }

  /**
   * Get request by ID
   */
  async get(id: string): Promise<QueuedRequest | undefined> {
    return this.db.get(id);
  }

  /**
   * Retry a failed request
   */
  async retry(id: string): Promise<void> {
    const request = await this.db.get(id);
    if (request && request.status === QueueStatus.FAILED) {
      request.status = QueueStatus.PENDING;
      request.attempts = 0;
      request.error = undefined;
      request.nextRetryAt = undefined;
      await this.db.update(request);
      
      if (this.isOnline) {
        this.sync();
      }
    }
  }

  /**
   * Cancel a pending request
   */
  async cancel(id: string): Promise<void> {
    await this.db.delete(id);
  }

  /**
   * Clear all requests
   */
  async clear(): Promise<void> {
    await this.db.clear();
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    expired: number;
  }> {
    const all = await this.db.getAll();
    return {
      total: all.length,
      pending: all.filter(r => r.status === QueueStatus.PENDING).length,
      processing: all.filter(r => r.status === QueueStatus.PROCESSING).length,
      completed: all.filter(r => r.status === QueueStatus.COMPLETED).length,
      failed: all.filter(r => r.status === QueueStatus.FAILED).length,
      expired: all.filter(r => r.status === QueueStatus.EXPIRED).length,
    };
  }

  /**
   * Destroy the queue (cleanup)
   */
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }
}

// Singleton instance
let queueInstance: OfflineQueue | null = null;

export function getOfflineQueue(apiBaseUrl?: string): OfflineQueue {
  if (!queueInstance) {
    queueInstance = new OfflineQueue(apiBaseUrl);
  }
  return queueInstance;
}

export async function initializeOfflineQueue(apiBaseUrl?: string): Promise<OfflineQueue> {
  const queue = getOfflineQueue(apiBaseUrl);
  await queue.initialize();
  return queue;
}
