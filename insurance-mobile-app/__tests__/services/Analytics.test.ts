import { analytics } from '../../src/services/Analytics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../../src/services/api';

jest.mock('@react-native-async-storage/async-storage');
jest.mock('../../src/services/api');

describe('Analytics Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('initialize', () => {
    it('should initialize analytics service', async () => {
      await analytics.initialize();

      expect(AsyncStorage.getItem).toHaveBeenCalled();
    });
  });

  describe('setUserId', () => {
    it('should save user ID to storage', async () => {
      await analytics.setUserId('user123');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@insureportal_analytics_user_id',
        'user123'
      );
    });
  });

  describe('clearUserId', () => {
    it('should remove user ID from storage', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

      await analytics.clearUserId();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@insureportal_analytics_user_id');
    });
  });

  describe('track', () => {
    it('should add event to queue', () => {
      analytics.track('test_event', { key: 'value' });

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should include platform in event properties', () => {
      analytics.track('test_event');

      const call = (AsyncStorage.setItem as jest.Mock).mock.calls.find(
        c => c[0] === '@insureportal_analytics_queue'
      );
      
      if (call) {
        const events = JSON.parse(call[1]);
        expect(events[events.length - 1].properties.platform).toBeDefined();
      }
    });
  });

  describe('trackScreenView', () => {
    it('should track screen view event', () => {
      analytics.trackScreenView('Dashboard');

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('trackButtonClick', () => {
    it('should track button click event', () => {
      analytics.trackButtonClick('Submit', 'LoginScreen');

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('trackPolicyView', () => {
    it('should track policy view event', () => {
      analytics.trackPolicyView(123, 'Health');

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('trackClaimSubmission', () => {
    it('should track claim submission event', () => {
      analytics.trackClaimSubmission(456, 'Auto', 50000);

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('trackPaymentInitiated', () => {
    it('should track payment initiated event', () => {
      analytics.trackPaymentInitiated(789, 25000, 'card');

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('trackPaymentCompleted', () => {
    it('should track payment completed event', () => {
      analytics.trackPaymentCompleted(789, 25000, 'card');

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('trackPaymentFailed', () => {
    it('should track payment failed event', () => {
      analytics.trackPaymentFailed(789, 25000, 'card', 'Insufficient funds');

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('trackLogin', () => {
    it('should track login event', () => {
      analytics.trackLogin('email');

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('trackLogout', () => {
    it('should track logout event', () => {
      analytics.trackLogout();

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('trackError', () => {
    it('should track error event', () => {
      analytics.trackError('NetworkError', 'Connection timeout', 'DashboardScreen');

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('flush', () => {
    it('should send events to server', async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

      analytics.track('test_event');
      await analytics.flush();

      expect(apiClient.post).toHaveBeenCalledWith('/analytics/events', expect.any(Object));
    });

    it('should restore events on failure', async () => {
      (apiClient.post as jest.Mock).mockRejectedValue(new Error('Network error'));

      analytics.track('test_event');
      await analytics.flush();

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });
});
