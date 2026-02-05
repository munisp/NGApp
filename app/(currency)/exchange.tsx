import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
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

const exchangeRates: { [key: string]: number } = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  NGN: 1580.0,
  KES: 129.5,
  ZAR: 18.5,
  GHS: 15.2,
};

const currencies = [
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', flag: '🇳🇬' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', flag: '🇰🇪' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', flag: '🇿🇦' },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GH₵', flag: '🇬🇭' },
];

export default function ExchangeCurrencyScreen() {
  const router = useRouter();
  const [balances, setBalances] = useState<CurrencyBalance[]>([]);
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');

  useEffect(() => {
    loadBalances();
  }, []);

  useEffect(() => {
    if (fromAmount) {
      calculateExchange();
    }
  }, [fromAmount, fromCurrency, toCurrency]);

  const loadBalances = async () => {
    try {
      const stored = await AsyncStorage.getItem(CURRENCY_BALANCES_KEY);
      if (stored) {
        setBalances(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load balances:', error);
    }
  };

  const calculateExchange = () => {
    const amount = parseFloat(fromAmount);
    if (isNaN(amount)) {
      setToAmount('');
      return;
    }

    // Convert from source to USD, then to target
    const fromRate = exchangeRates[fromCurrency];
    const toRate = exchangeRates[toCurrency];
    const usdAmount = amount / fromRate;
    const result = usdAmount * toRate;

    setToAmount(result.toFixed(2));
  };

  const getBalance = (currency: string): number => {
    const balance = balances.find(b => b.currency === currency);
    return balance?.balance || 0;
  };

  const getCurrencyInfo = (code: string) => {
    return currencies.find(c => c.code === code) || currencies[0];
  };

  const handleExchange = async () => {
    const amount = parseFloat(fromAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    const fromBalance = getBalance(fromCurrency);
    if (amount > fromBalance) {
      Alert.alert('Insufficient Balance', `You don't have enough ${fromCurrency}`);
      return;
    }

    try {
      // Update balances
      const updatedBalances = balances.map(b => {
        if (b.currency === fromCurrency) {
          return { ...b, balance: b.balance - amount };
        }
        if (b.currency === toCurrency) {
          return { ...b, balance: b.balance + parseFloat(toAmount) };
        }
        return b;
      });

      // Add toCurrency if it doesn't exist
      if (!updatedBalances.find(b => b.currency === toCurrency)) {
        const info = getCurrencyInfo(toCurrency);
        updatedBalances.push({
          currency: toCurrency,
          symbol: info.symbol,
          balance: parseFloat(toAmount),
          usdValue: parseFloat(toAmount) / exchangeRates[toCurrency],
          flag: info.flag,
        });
      }

      await AsyncStorage.setItem(CURRENCY_BALANCES_KEY, JSON.stringify(updatedBalances));
      
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert(
        'Exchange Successful',
        `Exchanged ${fromAmount} ${fromCurrency} to ${toAmount} ${toCurrency}`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Exchange failed:', error);
      Alert.alert('Error', 'Failed to complete exchange');
    }
  };

  const fromInfo = getCurrencyInfo(fromCurrency);
  const toInfo = getCurrencyInfo(toCurrency);
  const rate = (exchangeRates[toCurrency] / exchangeRates[fromCurrency]).toFixed(4);

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Exchange Currency', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* From Currency */}
        <View className="bg-surface rounded-xl p-6 mb-4 border border-border">
          <Text className="text-muted mb-3">From</Text>
          
          <View className="flex-row items-center mb-4">
            <Text className="text-4xl mr-3">{fromInfo.flag}</Text>
            <View className="flex-1">
              <Text className="text-foreground font-bold text-xl">{fromCurrency}</Text>
              <Text className="text-muted text-sm">
                Balance: {fromInfo.symbol}{getBalance(fromCurrency).toFixed(2)}
              </Text>
            </View>
          </View>

          <TextInput
            className="bg-background border border-border rounded-xl p-4 text-foreground text-2xl font-bold"
            placeholder="0.00"
            placeholderTextColor="#9BA1A6"
            keyboardType="decimal-pad"
            value={fromAmount}
            onChangeText={setFromAmount}
          />
        </View>

        {/* Exchange Icon */}
        <View className="items-center my-4">
          <TouchableOpacity
            onPress={() => {
              const temp = fromCurrency;
              setFromCurrency(toCurrency);
              setToCurrency(temp);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            className="bg-primary w-16 h-16 rounded-full items-center justify-center"
            style={{ opacity: 1 }}
          >
            <Text className="text-white text-3xl">⇅</Text>
          </TouchableOpacity>
        </View>

        {/* To Currency */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-muted mb-3">To</Text>
          
          <View className="flex-row items-center mb-4">
            <Text className="text-4xl mr-3">{toInfo.flag}</Text>
            <View className="flex-1">
              <Text className="text-foreground font-bold text-xl">{toCurrency}</Text>
              <Text className="text-muted text-sm">
                Balance: {toInfo.symbol}{getBalance(toCurrency).toFixed(2)}
              </Text>
            </View>
          </View>

          <View className="bg-background border border-border rounded-xl p-4">
            <Text className="text-primary text-2xl font-bold">
              {toAmount || '0.00'}
            </Text>
          </View>
        </View>

        {/* Exchange Rate */}
        <View className="bg-primary/10 rounded-xl p-4 mb-6 border border-primary/30">
          <Text className="text-foreground text-center">
            1 {fromCurrency} = {rate} {toCurrency}
          </Text>
        </View>

        {/* Exchange Button */}
        <TouchableOpacity
          onPress={handleExchange}
          className="bg-primary rounded-xl p-4 mb-6"
          style={{ opacity: 1 }}
        >
          <Text className="text-white text-center font-semibold text-lg">
            Exchange Now
          </Text>
        </TouchableOpacity>

        {/* Currency Selector */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-lg mb-4">Select Currencies</Text>
          
          <Text className="text-muted text-sm mb-2">From Currency</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            {currencies.map(curr => (
              <TouchableOpacity
                key={curr.code}
                onPress={() => {
                  setFromCurrency(curr.code);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                className={`mr-3 px-4 py-3 rounded-xl ${
                  fromCurrency === curr.code
                    ? 'bg-primary'
                    : 'bg-background border border-border'
                }`}
                style={{ opacity: 1 }}
              >
                <Text className="text-2xl mb-1">{curr.flag}</Text>
                <Text
                  className={`font-semibold ${
                    fromCurrency === curr.code ? 'text-white' : 'text-foreground'
                  }`}
                >
                  {curr.code}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text className="text-muted text-sm mb-2">To Currency</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {currencies.map(curr => (
              <TouchableOpacity
                key={curr.code}
                onPress={() => {
                  setToCurrency(curr.code);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                className={`mr-3 px-4 py-3 rounded-xl ${
                  toCurrency === curr.code
                    ? 'bg-primary'
                    : 'bg-background border border-border'
                }`}
                style={{ opacity: 1 }}
              >
                <Text className="text-2xl mb-1">{curr.flag}</Text>
                <Text
                  className={`font-semibold ${
                    toCurrency === curr.code ? 'text-white' : 'text-foreground'
                  }`}
                >
                  {curr.code}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
