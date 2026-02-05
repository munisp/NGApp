import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

interface CurrencyBalance {
  currency: string;
  symbol: string;
  balance: number;
  usdValue: number;
  flag: string;
}

const CURRENCY_BALANCES_KEY = 'currencyBalances';

const availableCurrencies = [
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', flag: '🇳🇬' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', flag: '🇰🇪' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', flag: '🇿🇦' },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GH₵', flag: '🇬🇭' },
];

export default function AddCurrencyScreen() {
  const router = useRouter();
  const [existingCurrencies, setExistingCurrencies] = useState<string[]>([]);

  useEffect(() => {
    loadExistingCurrencies();
  }, []);

  const loadExistingCurrencies = async () => {
    try {
      const stored = await AsyncStorage.getItem(CURRENCY_BALANCES_KEY);
      if (stored) {
        const balances: CurrencyBalance[] = JSON.parse(stored);
        setExistingCurrencies(balances.map(b => b.currency));
      }
    } catch (error) {
      console.error('Failed to load currencies:', error);
    }
  };

  const handleAddCurrency = async (currency: typeof availableCurrencies[0]) => {
    try {
      const stored = await AsyncStorage.getItem(CURRENCY_BALANCES_KEY);
      const balances: CurrencyBalance[] = stored ? JSON.parse(stored) : [];

      // Check if already added
      if (balances.find(b => b.currency === currency.code)) {
        Alert.alert('Already Added', `${currency.name} is already in your wallet`);
        return;
      }

      // Add new currency with zero balance
      balances.push({
        currency: currency.code,
        symbol: currency.symbol,
        balance: 0,
        usdValue: 0,
        flag: currency.flag,
      });

      await AsyncStorage.setItem(CURRENCY_BALANCES_KEY, JSON.stringify(balances));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        'Currency Added',
        `${currency.name} has been added to your wallet`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Failed to add currency:', error);
      Alert.alert('Error', 'Failed to add currency');
    }
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Add Currency', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text className="text-foreground font-bold text-2xl mb-2">
          Add a Currency
        </Text>
        <Text className="text-muted mb-6">
          Select a currency to add to your multi-currency wallet
        </Text>

        {availableCurrencies.map((currency, index) => {
          const isAdded = existingCurrencies.includes(currency.code);

          return (
            <TouchableOpacity
              key={index}
              onPress={() => {
                if (!isAdded) {
                  handleAddCurrency(currency);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
              disabled={isAdded}
              className={`bg-surface rounded-xl p-6 mb-4 border ${
                isAdded ? 'border-success opacity-60' : 'border-border'
              }`}
              style={{ opacity: isAdded ? 0.6 : 1 }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <Text className="text-6xl mr-4">{currency.flag}</Text>
                  <View className="flex-1">
                    <Text className="text-foreground font-bold text-xl mb-1">
                      {currency.code}
                    </Text>
                    <Text className="text-muted text-sm">{currency.name}</Text>
                  </View>
                </View>
                {isAdded ? (
                  <View className="bg-success rounded-full px-4 py-2">
                    <Text className="text-white font-semibold">Added</Text>
                  </View>
                ) : (
                  <View className="bg-primary rounded-full w-10 h-10 items-center justify-center">
                    <Text className="text-white text-2xl">+</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Info */}
        <View className="bg-primary/10 rounded-xl p-4 mt-4 mb-6 border border-primary/30">
          <Text className="text-foreground font-semibold mb-2">💡 About Multi-Currency</Text>
          <Text className="text-muted text-sm mb-2">
            • Add any currency to your wallet
          </Text>
          <Text className="text-muted text-sm mb-2">
            • Exchange between currencies instantly
          </Text>
          <Text className="text-muted text-sm">
            • Make payments in any supported currency
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
