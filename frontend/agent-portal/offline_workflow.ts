/**
 * Offline Workflow Manager
 * Provides "resume where you left off" functionality for agent workflows
 * Handles intermittent network, conflict resolution, and pending/posted status
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Database schema
interface AgentWorkflowDB extends DBSchema {
  workflows: {
    key: string;
    value: WorkflowState;
    indexes: {
      'by-status': string;
      'by-created': number;
    };
  };
  pendingTransactions: {
    key: string;
    value: PendingTransaction;
    indexes: {
      'by-status': string;
      'by-created': number;
    };
  };
  syncQueue: {
    key: string;
    value: SyncQueueItem;
    indexes: {
      'by-priority': number;
      'by-created': number;
    };
  };
  conflictLog: {
    key: string;
    value: ConflictRecord;
  };
}

// Types
interface WorkflowState {
  workflowId: string;
  workflowType: WorkflowType;
  status: WorkflowStatus;
  currentStep: number;
  totalSteps: number;
  data: Record<string, any>;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  resumable: boolean;
  expiresAt?: number;
}

type WorkflowType = 
  | 'cash_in'
  | 'cash_out'
  | 'transfer'
  | 'kyc_submission'
  | 'agent_registration'
  | 'float_request';

type WorkflowStatus = 
  | 'in_progress'
  | 'pending_sync'
  | 'syncing'
  | 'completed'
  | 'failed'
  | 'expired';

interface PendingTransaction {
  transactionId: string;
  localId: string;
  type: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  data: Record<string, any>;
  createdAt: number;
  syncedAt?: number;
  confirmedAt?: number;
  ledgerStatus?: LedgerStatus;
  retryCount: number;
  lastError?: string;
}

type TransactionStatus = 
  | 'pending'      // Created locally, not yet synced
  | 'syncing'      // Being sent to server
  | 'synced'       // Server acknowledged, awaiting ledger confirmation
  | 'posted'       // Confirmed in ledger (TigerBeetle)
  | 'failed'       // Failed to sync or post
  | 'reversed';    // Transaction was reversed

type LedgerStatus = 
  | 'pending'      // Awaiting ledger posting
  | 'posted'       // Posted to TigerBeetle
  | 'confirmed'    // Confirmed by reconciliation
  | 'failed';      // Ledger posting failed

interface SyncQueueItem {
  itemId: string;
  type: 'transaction' | 'workflow' | 'data';
  referenceId: string;
  priority: number;
  payload: any;
  createdAt: number;
  attempts: number;
  lastAttempt?: number;
  nextRetry?: number;
}

interface ConflictRecord {
  conflictId: string;
  type: string;
  localData: any;
  serverData: any;
  resolution?: ConflictResolution;
  resolvedAt?: number;
  resolvedBy?: string;
}

type ConflictResolution = 'local_wins' | 'server_wins' | 'merged' | 'manual';

// Network status
interface NetworkStatus {
  online: boolean;
  connectionType: string;
  effectiveType: string;
  downlink: number;
  rtt: number;
}

/**
 * Offline Workflow Manager
 */
export class OfflineWorkflowManager {
  private db: IDBPDatabase<AgentWorkflowDB> | null = null;
  private syncInProgress = false;
  private networkStatus: NetworkStatus = {
    online: navigator.onLine,
    connectionType: 'unknown',
    effectiveType: 'unknown',
    downlink: 0,
    rtt: 0
  };
  
  private apiBaseUrl: string;
  private onStatusChange?: (status: NetworkStatus) => void;
  private onSyncComplete?: (results: SyncResult[]) => void;
  private onConflict?: (conflict: ConflictRecord) => Promise<ConflictResolution>;

  constructor(config: {
    apiBaseUrl: string;
    onStatusChange?: (status: NetworkStatus) => void;
    onSyncComplete?: (results: SyncResult[]) => void;
    onConflict?: (conflict: ConflictRecord) => Promise<ConflictResolution>;
  }) {
    this.apiBaseUrl = config.apiBaseUrl;
    this.onStatusChange = config.onStatusChange;
    this.onSyncComplete = config.onSyncComplete;
    this.onConflict = config.onConflict;
  }

  /**
   * Initialize the offline workflow manager
   */
  async initialize(): Promise<void> {
    // Open IndexedDB
    this.db = await openDB<AgentWorkflowDB>('agent-workflows', 1, {
      upgrade(db) {
        // Workflows store
        const workflowStore = db.createObjectStore('workflows', {
          keyPath: 'workflowId'
        });
        workflowStore.createIndex('by-status', 'status');
        workflowStore.createIndex('by-created', 'createdAt');

        // Pending transactions store
        const txStore = db.createObjectStore('pendingTransactions', {
          keyPath: 'localId'
        });
        txStore.createIndex('by-status', 'status');
        txStore.createIndex('by-created', 'createdAt');

        // Sync queue store
        const syncStore = db.createObjectStore('syncQueue', {
          keyPath: 'itemId'
        });
        syncStore.createIndex('by-priority', 'priority');
        syncStore.createIndex('by-created', 'createdAt');

        // Conflict log store
        db.createObjectStore('conflictLog', {
          keyPath: 'conflictId'
        });
      }
    });

    // Setup network listeners
    this.setupNetworkListeners();

    // Start background sync
    this.startBackgroundSync();

    // Clean up expired workflows
    await this.cleanupExpiredWorkflows();
  }

  /**
   * Setup network status listeners
   */
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.networkStatus.online = true;
      this.onStatusChange?.(this.networkStatus);
      this.triggerSync();
    });

    window.addEventListener('offline', () => {
      this.networkStatus.online = false;
      this.onStatusChange?.(this.networkStatus);
    });

    // Monitor connection quality
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      connection.addEventListener('change', () => {
        this.networkStatus = {
          online: navigator.onLine,
          connectionType: connection.type || 'unknown',
          effectiveType: connection.effectiveType || 'unknown',
          downlink: connection.downlink || 0,
          rtt: connection.rtt || 0
        };
        this.onStatusChange?.(this.networkStatus);
      });
    }
  }

  /**
   * Start a new workflow
   */
  async startWorkflow(
    type: WorkflowType,
    initialData: Record<string, any> = {}
  ): Promise<WorkflowState> {
    const workflow: WorkflowState = {
      workflowId: `wf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      workflowType: type,
      status: 'in_progress',
      currentStep: 0,
      totalSteps: this.getWorkflowSteps(type),
      data: initialData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      resumable: true,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };

    await this.db!.put('workflows', workflow);
    return workflow;
  }

  /**
   * Get workflow steps count
   */
  private getWorkflowSteps(type: WorkflowType): number {
    const stepCounts: Record<WorkflowType, number> = {
      cash_in: 4,
      cash_out: 5,
      transfer: 4,
      kyc_submission: 6,
      agent_registration: 8,
      float_request: 3
    };
    return stepCounts[type] || 5;
  }

  /**
   * Update workflow progress
   */
  async updateWorkflow(
    workflowId: string,
    updates: Partial<WorkflowState>
  ): Promise<WorkflowState | null> {
    const workflow = await this.db!.get('workflows', workflowId);
    if (!workflow) return null;

    const updated: WorkflowState = {
      ...workflow,
      ...updates,
      updatedAt: Date.now()
    };

    await this.db!.put('workflows', updated);
    return updated;
  }

  /**
   * Get resumable workflows
   */
  async getResumableWorkflows(): Promise<WorkflowState[]> {
    const all = await this.db!.getAllFromIndex('workflows', 'by-status', 'in_progress');
    return all.filter(w => w.resumable && (!w.expiresAt || w.expiresAt > Date.now()));
  }

  /**
   * Resume a workflow
   */
  async resumeWorkflow(workflowId: string): Promise<WorkflowState | null> {
    const workflow = await this.db!.get('workflows', workflowId);
    if (!workflow || !workflow.resumable) return null;

    if (workflow.expiresAt && workflow.expiresAt < Date.now()) {
      await this.updateWorkflow(workflowId, { status: 'expired' });
      return null;
    }

    return workflow;
  }

  /**
   * Complete a workflow
   */
  async completeWorkflow(workflowId: string): Promise<void> {
    await this.updateWorkflow(workflowId, {
      status: 'completed',
      completedAt: Date.now(),
      resumable: false
    });
  }

  /**
   * Create a pending transaction
   */
  async createPendingTransaction(
    type: string,
    amount: number,
    currency: string,
    data: Record<string, any>
  ): Promise<PendingTransaction> {
    const transaction: PendingTransaction = {
      transactionId: '', // Will be assigned by server
      localId: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      amount,
      currency,
      status: 'pending',
      data,
      createdAt: Date.now(),
      retryCount: 0
    };

    await this.db!.put('pendingTransactions', transaction);

    // Add to sync queue
    await this.addToSyncQueue('transaction', transaction.localId, transaction, 1);

    // Trigger sync if online
    if (this.networkStatus.online) {
      this.triggerSync();
    }

    return transaction;
  }

  /**
   * Get transaction status with ledger confirmation
   */
  async getTransactionStatus(localId: string): Promise<{
    status: TransactionStatus;
    ledgerStatus?: LedgerStatus;
    displayStatus: string;
  } | null> {
    const tx = await this.db!.get('pendingTransactions', localId);
    if (!tx) return null;

    let displayStatus: string;
    switch (tx.status) {
      case 'pending':
        displayStatus = 'Pending - Awaiting network';
        break;
      case 'syncing':
        displayStatus = 'Processing...';
        break;
      case 'synced':
        displayStatus = tx.ledgerStatus === 'posted' 
          ? 'Posted - Confirmed' 
          : 'Pending - Awaiting confirmation';
        break;
      case 'posted':
        displayStatus = 'Completed';
        break;
      case 'failed':
        displayStatus = 'Failed - ' + (tx.lastError || 'Unknown error');
        break;
      case 'reversed':
        displayStatus = 'Reversed';
        break;
      default:
        displayStatus = 'Unknown';
    }

    return {
      status: tx.status,
      ledgerStatus: tx.ledgerStatus,
      displayStatus
    };
  }

  /**
   * Add item to sync queue
   */
  private async addToSyncQueue(
    type: 'transaction' | 'workflow' | 'data',
    referenceId: string,
    payload: any,
    priority: number
  ): Promise<void> {
    const item: SyncQueueItem = {
      itemId: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      referenceId,
      priority,
      payload,
      createdAt: Date.now(),
      attempts: 0
    };

    await this.db!.put('syncQueue', item);
  }

  /**
   * Start background sync
   */
  private startBackgroundSync(): void {
    // Sync every 30 seconds when online
    setInterval(() => {
      if (this.networkStatus.online && !this.syncInProgress) {
        this.triggerSync();
      }
    }, 30000);
  }

  /**
   * Trigger sync
   */
  async triggerSync(): Promise<void> {
    if (this.syncInProgress || !this.networkStatus.online) return;

    this.syncInProgress = true;
    const results: SyncResult[] = [];

    try {
      // Get pending items from sync queue
      const items = await this.db!.getAllFromIndex('syncQueue', 'by-priority');

      for (const item of items) {
        // Skip if not ready for retry
        if (item.nextRetry && item.nextRetry > Date.now()) continue;

        try {
          const result = await this.syncItem(item);
          results.push(result);

          if (result.success) {
            // Remove from queue
            await this.db!.delete('syncQueue', item.itemId);
          } else {
            // Update retry info
            const nextRetry = Date.now() + Math.min(
              1000 * Math.pow(2, item.attempts), // Exponential backoff
              300000 // Max 5 minutes
            );
            await this.db!.put('syncQueue', {
              ...item,
              attempts: item.attempts + 1,
              lastAttempt: Date.now(),
              nextRetry
            });
          }
        } catch (error) {
          console.error('Sync item failed:', error);
        }
      }

      this.onSyncComplete?.(results);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync a single item
   */
  private async syncItem(item: SyncQueueItem): Promise<SyncResult> {
    switch (item.type) {
      case 'transaction':
        return this.syncTransaction(item);
      case 'workflow':
        return this.syncWorkflow(item);
      default:
        return { success: false, itemId: item.itemId, error: 'Unknown type' };
    }
  }

  /**
   * Sync a transaction
   */
  private async syncTransaction(item: SyncQueueItem): Promise<SyncResult> {
    const tx = await this.db!.get('pendingTransactions', item.referenceId);
    if (!tx) {
      return { success: true, itemId: item.itemId }; // Already processed
    }

    // Update status to syncing
    await this.db!.put('pendingTransactions', { ...tx, status: 'syncing' });

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/v1/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': tx.localId
        },
        body: JSON.stringify({
          type: tx.type,
          amount: tx.amount,
          currency: tx.currency,
          ...tx.data
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();

      // Update transaction with server response
      await this.db!.put('pendingTransactions', {
        ...tx,
        transactionId: result.transaction_id,
        status: 'synced',
        syncedAt: Date.now(),
        ledgerStatus: result.ledger_status || 'pending'
      });

      return { success: true, itemId: item.itemId, data: result };
    } catch (error: any) {
      // Update with error
      await this.db!.put('pendingTransactions', {
        ...tx,
        status: tx.retryCount >= 3 ? 'failed' : 'pending',
        retryCount: tx.retryCount + 1,
        lastError: error.message
      });

      return { success: false, itemId: item.itemId, error: error.message };
    }
  }

  /**
   * Sync a workflow
   */
  private async syncWorkflow(item: SyncQueueItem): Promise<SyncResult> {
    // Workflow sync implementation
    return { success: true, itemId: item.itemId };
  }

  /**
   * Handle conflict
   */
  async handleConflict(
    type: string,
    localData: any,
    serverData: any
  ): Promise<ConflictResolution> {
    const conflict: ConflictRecord = {
      conflictId: `conflict-${Date.now()}`,
      type,
      localData,
      serverData
    };

    await this.db!.put('conflictLog', conflict);

    // If callback provided, let caller decide
    if (this.onConflict) {
      const resolution = await this.onConflict(conflict);
      conflict.resolution = resolution;
      conflict.resolvedAt = Date.now();
      await this.db!.put('conflictLog', conflict);
      return resolution;
    }

    // Default: server wins for financial data, local wins for drafts
    const resolution: ConflictResolution = 
      type.includes('transaction') ? 'server_wins' : 'local_wins';
    
    conflict.resolution = resolution;
    conflict.resolvedAt = Date.now();
    await this.db!.put('conflictLog', conflict);
    
    return resolution;
  }

  /**
   * Clean up expired workflows
   */
  private async cleanupExpiredWorkflows(): Promise<void> {
    const all = await this.db!.getAll('workflows');
    const now = Date.now();

    for (const workflow of all) {
      if (workflow.expiresAt && workflow.expiresAt < now && workflow.status === 'in_progress') {
        await this.updateWorkflow(workflow.workflowId, { status: 'expired' });
      }
    }
  }

  /**
   * Get pending transactions count
   */
  async getPendingCount(): Promise<number> {
    const pending = await this.db!.getAllFromIndex('pendingTransactions', 'by-status', 'pending');
    return pending.length;
  }

  /**
   * Get network status
   */
  getNetworkStatus(): NetworkStatus {
    return this.networkStatus;
  }
}

interface SyncResult {
  success: boolean;
  itemId: string;
  data?: any;
  error?: string;
}

// Export singleton
let instance: OfflineWorkflowManager | null = null;

export function getOfflineWorkflowManager(config?: {
  apiBaseUrl: string;
  onStatusChange?: (status: NetworkStatus) => void;
  onSyncComplete?: (results: SyncResult[]) => void;
  onConflict?: (conflict: ConflictRecord) => Promise<ConflictResolution>;
}): OfflineWorkflowManager {
  if (!instance && config) {
    instance = new OfflineWorkflowManager(config);
  }
  return instance!;
}
