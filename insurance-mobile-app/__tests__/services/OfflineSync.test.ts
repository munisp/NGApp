import { OfflineSyncService } from '../../src/services/OfflineSync';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

jest.mock('@react-native-async-storage/async-storage');
jest.mock('@react-native-community/netinfo');

describe('OfflineSyncService', () => {
  let offlineSync: OfflineSyncService;

  beforeEach(() => {
    jest.clearAllMocks();
    offlineSync = new OfflineSyncService();
  });

  describe('cacheData', () => {
    it('should cache data with expiration', async () => {
      const key = 'test_key';
      const data = { foo: 'bar' };
      
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await offlineSync.cacheData(key, data);

      expect(AsyncStorage.setItem).toHaveBeenCalled();
      const call = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      expect(call[0]).toBe(`@insureportal_cache_${key}`);
      
      const cachedData = JSON.parse(call[1]);
      expect(cachedData.key).toBe(key);
      expect(cachedData.data).toEqual(data);
      expect(cachedData.expiresAt).toBeGreaterThan(Date.now());
    });
  });

  describe('getCachedData', () => {
    it('should return cached data if not expired', async () => {
      const key = 'test_key';
      const data = { foo: 'bar' };
      const cachedItem = {
        key,
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + 1000000,
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cachedItem));

      const result = await offlineSync.getCachedData(key);

      expect(result).toEqual(data);
    });

    it('should return null if data is expired', async () => {
      const key = 'test_key';
      const cachedItem = {
        key,
        data: { foo: 'bar' },
        timestamp: Date.now() - 1000000,
        expiresAt: Date.now() - 1000,
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cachedItem));
      (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

      const result = await offlineSync.getCachedData(key);

      expect(result).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalled();
    });

    it('should return null if no cached data exists', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await offlineSync.getCachedData('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('addToSyncQueue', () => {
    it('should add item to sync queue', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const id = await offlineSync.addToSyncQueue({
        type: 'CREATE_CLAIM',
        endpoint: '/claims',
        method: 'POST',
        data: { amount: 50000 },
      });

      expect(id).toMatch(/^sync_/);
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('clearCache', () => {
    it('should clear all cached data', async () => {
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([
        '@insureportal_cache_key1',
        '@insureportal_cache_key2',
        '@insureportal_other_key',
      ]);
      (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);

      await offlineSync.clearCache();

      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
        '@insureportal_cache_key1',
        '@insureportal_cache_key2',
      ]);
    });
  });

  describe('getNetworkStatus', () => {
    it('should return online status', () => {
      offlineSync['isOnline'] = true;
      expect(offlineSync.getNetworkStatus()).toBe(true);
    });

    it('should return offline status', () => {
      offlineSync['isOnline'] = false;
      expect(offlineSync.getNetworkStatus()).toBe(false);
    });
  });
});
