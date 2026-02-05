import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CurrencyBalance {
  currency: string;
  symbol: string;
  balance: number;
  usdValue: number;
  flag: string;
}

const CURRENCY_BALANCES_KEY = 'currencyBalances';

// Mock exchange rates (in real app, fetch from API)
const exchangeRates: { [key: string]: number } = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  NGN: 1580.0,
  KES: 129.5,
  ZAR: 18.5,
  GHS: 15.2,
};

export default function CurrencyWalletScreen() {
  const router = useRouter();
  const [balances, setBalances] = useState<CurrencyBalance[]>([]);
  const [totalUSD, setTotalUSD] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadBalances();
  }, []);

  const loadBalances = async () => {
    try {
      const stored = await AsyncStorage.getItem(CURRENCY_BALANCES_KEY);
      let currencyBalances: CurrencyBalance[] = [];

      if (stored) {
        currencyBalances = JSON.parse(stored);
      } else {
        // Initialize with default balances
        currencyBalances = [
          { currency: 'USD', symbol: '$', balance: 1000, usdValue: 1000, flag: '🇺🇸' },
          { currency: 'EUR', symbol: '€', balance: 500, usdValue: 543.48, flag: '🇪🇺' },
          { currency: 'NGN', symbol: '₦', balance: 50000, usdValue: 31.65, flag: '🇳🇬' },
        ];
        await AsyncStorage.setItem(CURRENCY_BALANCES_KEY, JSON.stringify(currencyBalances));
      }

      setBalances(currencyBalances);
      const total = currencyBalances.reduce((sum, b) => sum + b.usdValue, 0);
      setTotalUSD(total);
    } catch (error) {
      console.error('Failed to load balances:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBalances();
    setRefreshing(false);
  };

  const getCurrencyInfo = (code: string): { name: string; flag: string } => {
    const currencies: { [key: string]: { name: string; flag: string } } = {
      USD: { name: 'US Dollar', flag: '🇺🇸' },
      EUR: { name: 'Euro', flag: '🇪🇺' },
      GBP: { name: 'British Pound', flag: '🇬🇧' },
      NGN: { name: 'Nigerian Naira', flag: '🇳🇬' },
      KES: { name: 'Kenyan Shilling', flag: '🇰🇪' },
      ZAR: { name: 'South African Rand', flag: '🇿🇦' },
      GHS: { name: 'Ghanaian Cedi', flag: '🇬🇭' },
    };
    return currencies[code] || { name: code, flag: '🌍' };
  };

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Multi-Currency Wallet', headerShown: true }} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0a7ea4" />
        }
      >
        {/* Total Balance */}
        <View className="bg-primary/10 rounded-xl p-6 mb-6 border border-primary/30 items-center">
          <Text className="text-foreground font-bold text-xl mb-2">Total Balance (USD)</Text>
          <Text className="text-primary font-bold text-6xl mb-2">
            ${totalUSD.toFixed(2)}
          </Text>
          <Text className="text-muted">{balances.length} currencies</Text>
        </View>

        {/* Currency Balances */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-lg mb-4">Your Currencies</Text>

          {balances.map((balance, index) => {
            const info = getCurrencyInfo(balance.currency);
            return (
              <TouchableOpacity
                key={index}
                onPress={() => router.push(`/(currency)/detail?currency=${balance.currency}` as any)}
                className="mb-4"
                style={{ opacity: 1 }}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <Text className="text-5xl mr-4">{info.flag}</Text>
                    <View className="flex-1">
                      <Text className="text-foreground font-bold text-lg mb-1">
                        {balance.currency}
                      </Text>
                      <Text className="text-muted text-sm">{info.name}</Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <Text className="text-foreground font-bold text-xl mb-1">
                      {balance.symbol}{balance.balance.toFixed(2)}
                    </Text>
                    <Text className="text-muted text-sm">
                      ≈ ${balance.usdValue.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Actions */}
        <TouchableOpacity
          onPress={() => router.push('/(currency)/exchange' as any)}
          className="bg-primary rounded-xl p-4 mb-3"
          style={{ opacity: 1 }}
        >
          <Text className="text-white text-center font-semibold text-lg">
            💱 Exchange Currency
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/(currency)/add' as any)}
          className="bg-surface border border-border rounded-xl p-4 mb-6"
          style={{ opacity: 1 }}
        >
          <Text className="text-foreground text-center font-semibold text-lg">
            ➕ Add Currency
          </Text>
        </TouchableOpacity>

        {/* Exchange Rates */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-lg mb-4">Live Exchange Rates</Text>
          <Text className="text-muted text-sm mb-4">1 USD equals:</Text>

          {Object.entries(exchangeRates)
            .filter(([code]) => code !== 'USD')
            .map(([code, rate]) => {
              const info = getCurrencyInfo(code);
              return (
                <View key={code} className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center">
                    <Text className="text-2xl mr-3">{info.flag}</Text>
                    <Text className="text-foreground font-semibold">{code}</Text>
                  </View>
                  <Text className="text-muted">{rate.toFixed(2)}</Text>
                </View>
              );
            })}
        </View>

        {/* Info */}
        <View className="bg-primary/10 rounded-xl p-4 mb-6 border border-primary/30">
          <Text className="text-foreground font-semibold mb-2">💡 Multi-Currency Benefits</Text>
          <Text className="text-muted text-sm mb-2">
            • Hold multiple currencies in one wallet
          </Text>
          <Text className="text-muted text-sm mb-2">
            • Exchange at competitive rates
          </Text>
          <Text className="text-muted text-sm">
            • Make international payments easily
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
