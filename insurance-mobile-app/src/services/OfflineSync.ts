import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export interface SyncQueueItem {
  id: string;
  type: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

export interface CachedData {
  key: string;
  data: any;
  timestamp: number;
  expiresAt: number;
}

export interface SyncStatus {
  isOnline: boolean;
  lastSyncTime: number | null;
  pendingChanges: number;
  isSyncing: boolean;
}

const SYNC_QUEUE_KEY = '@insureportal_sync_queue';
const CACHE_PREFIX = '@insureportal_cache_';
const LAST_SYNC_KEY = '@insureportal_last_sync';
const CACHE_DURATION = 24 * 60 * 60 * 1000;

class OfflineSyncService {
  private syncQueue: SyncQueueItem[] = [];
  private isOnline: boolean = true;
  private isSyncing: boolean = false;
  private listeners: ((status: SyncStatus) => void)[] = [];
  private unsubscribeNetInfo: (() => void) | null = null;

  async initialize(): Promise<void> {
    await this.loadSyncQueue();
    
    this.unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;
      
      if (wasOffline && this.isOnline) {
        this.processSyncQueue();
      }
      
      this.notifyListeners();
    });

    const state = await NetInfo.fetch();
    this.isOnline = state.isConnected ?? false;
  }

  destroy(): void {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
    }
  }

  addStatusListener(listener: (status: SyncStatus) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach(listener => listener(status));
  }

  getStatus(): SyncStatus {
    return {
      isOnline: this.isOnline,
      lastSyncTime: this.getLastSyncTime(),
      pendingChanges: this.syncQueue.length,
      isSyncing: this.isSyncing,
    };
  }

  private getLastSyncTime(): number | null {
    try {
      const stored = AsyncStorage.getItem(LAST_SYNC_KEY);
      return stored ? parseInt(stored as unknown as string, 10) : null;
    } catch {
      return null;
    }
  }

  private async setLastSyncTime(): Promise<void> {
    await AsyncStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
  }

  private async loadSyncQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      if (stored) {
        this.syncQueue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading sync queue:', error);
      this.syncQueue = [];
    }
  }

  private async saveSyncQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('Error saving sync queue:', error);
    }
  }

  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount' | 'maxRetries'>): Promise<string> {
    const queueItem: SyncQueueItem = {
      ...item,
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
    };

    this.syncQueue.push(queueItem);
    await this.saveSyncQueue();
    this.notifyListeners();

    if (this.isOnline) {
      this.processSyncQueue();
    }

    return queueItem.id;
  }

  getNetworkStatus(): boolean {
    return this.isOnline;
  }

  addNetworkListener(listener: (isOnline: boolean) => void): () => void {
    const wrappedListener = (status: SyncStatus) => {
      listener(status.isOnline);
    };
    return this.addStatusListener(wrappedListener);
  }

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    return [...this.syncQueue];
  }

  async processSyncQueue(): Promise<void> {
    if (this.isSyncing || !this.isOnline || this.syncQueue.length === 0) {
      return;
    }

    this.isSyncing = true;
    this.notifyListeners();

    const itemsToProcess = [...this.syncQueue];
    const failedItems: SyncQueueItem[] = [];

    for (const item of itemsToProcess) {
      try {
        await this.processQueueItem(item);
        this.syncQueue = this.syncQueue.filter(i => i.id !== item.id);
      } catch (error) {
        console.error(`Error processing sync item ${item.id}:`, error);
        
        item.retryCount++;
        if (item.retryCount < item.maxRetries) {
          failedItems.push(item);
        } else {
          console.error(`Max retries reached for sync item ${item.id}, removing from queue`);
        }
      }
    }

    this.syncQueue = [...this.syncQueue.filter(i => !itemsToProcess.find(p => p.id === i.id)), ...failedItems];
    await this.saveSyncQueue();
    await this.setLastSyncTime();

    this.isSyncing = false;
    this.notifyListeners();
  }

  private async processQueueItem(item: SyncQueueItem): Promise<void> {
    const endpoints: Record<string, string> = {
      policy: '/api/policies',
      claim: '/api/claims',
      payment: '/api/payments',
      profile: '/api/profile',
      document: '/api/documents',
    };

    const endpoint = endpoints[item.entity];
    if (!endpoint) {
      throw new Error(`Unknown entity type: ${item.entity}`);
    }

    const baseUrl = process.env.API_BASE_URL || 'https://api.insureportal.ng';
    let url = `${baseUrl}${endpoint}`;
    let method = 'POST';

    switch (item.type) {
      case 'CREATE':
        method = 'POST';
        break;
      case 'UPDATE':
        method = 'PUT';
        url = `${url}/${item.data.id}`;
        break;
      case 'DELETE':
        method = 'DELETE';
        url = `${url}/${item.data.id}`;
        break;
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: item.type !== 'DELETE' ? JSON.stringify(item.data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
  }

  async cacheData(key: string, data: any, duration: number = CACHE_DURATION): Promise<void> {
    const cacheItem: CachedData = {
      key,
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + duration,
    };

    try {
      await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(cacheItem));
    } catch (error) {
      console.error('Error caching data:', error);
    }
  }

  async getCachedData<T>(key: string): Promise<T | null> {
    try {
      const stored = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
      if (!stored) {
        return null;
      }

      const cacheItem: CachedData = JSON.parse(stored);
      
      if (Date.now() > cacheItem.expiresAt) {
        await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
        return null;
      }

      return cacheItem.data as T;
    } catch (error) {
      console.error('Error getting cached data:', error);
      return null;
    }
  }

  async clearCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  async clearSyncQueue(): Promise<void> {
    this.syncQueue = [];
    await this.saveSyncQueue();
    this.notifyListeners();
  }

  async fetchWithOfflineSupport<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: { cacheDuration?: number; forceRefresh?: boolean } = {}
  ): Promise<T> {
    const { cacheDuration = CACHE_DURATION, forceRefresh = false } = options;

    if (!forceRefresh) {
      const cached = await this.getCachedData<T>(key);
      if (cached !== null) {
        if (this.isOnline) {
          fetchFn().then(data => this.cacheData(key, data, cacheDuration)).catch(console.error);
        }
        return cached;
      }
    }

    if (!this.isOnline) {
      const cached = await this.getCachedData<T>(key);
      if (cached !== null) {
        return cached;
      }
      throw new Error('No internet connection and no cached data available');
    }

    const data = await fetchFn();
    await this.cacheData(key, data, cacheDuration);
    return data;
  }

  async saveOfflineChange(
    entity: SyncQueueItem['entity'],
    type: SyncQueueItem['type'],
    data: any
  ): Promise<{ queued: boolean; id: string }> {
    if (this.isOnline) {
      return { queued: false, id: '' };
    }

    const id = await this.addToSyncQueue({ entity, type, data });
    return { queued: true, id };
  }
}

export const offlineSyncService = new OfflineSyncService();
export default offlineSyncService;
