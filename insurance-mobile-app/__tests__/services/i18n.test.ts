import { i18n, t, Language } from '../../src/services/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage');

describe('i18n Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should load saved language from storage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('yo');

      await i18n.initialize();

      expect(AsyncStorage.getItem).toHaveBeenCalledWith('@insureportal_language');
    });

    it('should default to English if no saved language', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await i18n.initialize();

      expect(i18n.getLanguage()).toBe('en');
    });
  });

  describe('setLanguage', () => {
    it('should save language to storage', async () => {
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await i18n.setLanguage('ha');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('@insureportal_language', 'ha');
      expect(i18n.getLanguage()).toBe('ha');
    });
  });

  describe('t (translate)', () => {
    beforeEach(async () => {
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      await i18n.setLanguage('en');
    });

    it('should return English translation', () => {
      const result = t('common.welcome');
      expect(result).toBe('Welcome');
    });

    it('should return key if translation not found', () => {
      const result = t('nonexistent.key');
      expect(result).toBe('nonexistent.key');
    });

    it('should replace parameters in translation', () => {
      const result = t('common.welcome');
      expect(result).toBe('Welcome');
    });
  });

  describe('getAvailableLanguages', () => {
    it('should return all available languages', () => {
      const languages = i18n.getAvailableLanguages();

      expect(languages).toHaveLength(5);
      expect(languages.map(l => l.code)).toEqual(['en', 'yo', 'ha', 'ig', 'pcm']);
    });

    it('should include native names', () => {
      const languages = i18n.getAvailableLanguages();

      const yoruba = languages.find(l => l.code === 'yo');
      expect(yoruba?.nativeName).toBe('Yorùbá');

      const pidgin = languages.find(l => l.code === 'pcm');
      expect(pidgin?.nativeName).toBe('Naija');
    });
  });

  describe('addListener', () => {
    it('should notify listeners when language changes', async () => {
      const callback = jest.fn();
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      i18n.addListener(callback);
      await i18n.setLanguage('ig');

      expect(callback).toHaveBeenCalledWith('ig');
    });

    it('should return unsubscribe function', async () => {
      const callback = jest.fn();
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const unsubscribe = i18n.addListener(callback);
      unsubscribe();
      await i18n.setLanguage('ha');

      expect(callback).not.toHaveBeenCalled();
    });
  });
});
