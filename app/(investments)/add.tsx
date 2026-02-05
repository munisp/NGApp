import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

const INVESTMENTS_KEY = 'investments';

const popularStocks = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
];

const popularCrypto = [
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'BNB', name: 'Binance Coin' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'ADA', name: 'Cardano' },
];

export default function AddInvestmentScreen() {
  const router = useRouter();
  const [type, setType] = useState<'stock' | 'crypto'>('stock');
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSelectPopular = (item: { symbol: string; name: string }) => {
    setSymbol(item.symbol);
    setName(item.name);
  };

  const handleSave = async () => {
    if (!symbol || !name || !quantity || !purchasePrice || !currentPrice) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const qty = parseFloat(quantity);
    const price = parseFloat(purchasePrice);
    const current = parseFloat(currentPrice);

    if (qty <= 0 || price <= 0 || current <= 0) {
      Alert.alert('Error', 'Please enter valid positive numbers');
      return;
    }

    try {
      setIsSaving(true);

      // Load existing investments
      const stored = await AsyncStorage.getItem(INVESTMENTS_KEY);
      const investments = stored ? JSON.parse(stored) : [];

      // Create new investment
      const newInvestment = {
        id: Date.now().toString(),
        symbol: symbol.toUpperCase(),
        name,
        type,
        quantity: qty,
        purchasePrice: price,
        currentPrice: current,
        purchaseDate: new Date().toISOString(),
      };

      investments.push(newInvestment);
      await AsyncStorage.setItem(INVESTMENTS_KEY, JSON.stringify(investments));

      Alert.alert('Success', 'Investment added successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Failed to add investment:', error);
      Alert.alert('Error', 'Failed to add investment. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const popularList = type === 'stock' ? popularStocks : popularCrypto;
  const totalCost = quantity && purchasePrice ? parseFloat(quantity) * parseFloat(purchasePrice) : 0;
  const currentValue = quantity && currentPrice ? parseFloat(quantity) * parseFloat(currentPrice) : 0;
  const profitLoss = currentValue - totalCost;

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Add Investment', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Type Selection */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold mb-2">Investment Type *</Text>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => setType('stock')}
              className={`flex-1 px-4 py-3 rounded-xl ${
                type === 'stock'
                  ? 'bg-primary'
                  : 'bg-surface border border-border'
              }`}
              style={{ opacity: 1 }}
            >
              <Text
                className={`text-center font-semibold ${
                  type === 'stock' ? 'text-white' : 'text-foreground'
                }`}
              >
                📊 Stock
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setType('crypto')}
              className={`flex-1 px-4 py-3 rounded-xl ${
                type === 'crypto'
                  ? 'bg-primary'
                  : 'bg-surface border border-border'
              }`}
              style={{ opacity: 1 }}
            >
              <Text
                className={`text-center font-semibold ${
                  type === 'crypto' ? 'text-white' : 'text-foreground'
                }`}
              >
                ₿ Crypto
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Popular Options */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold mb-2">Popular {type === 'stock' ? 'Stocks' : 'Cryptocurrencies'}</Text>
          <View className="flex-row flex-wrap gap-2">
            {popularList.map(item => (
              <TouchableOpacity
                key={item.symbol}
                onPress={() => handleSelectPopular(item)}
                className={`px-4 py-2 rounded-xl ${
                  symbol === item.symbol
                    ? 'bg-primary'
                    : 'bg-surface border border-border'
                }`}
                style={{ opacity: 1 }}
              >
                <Text
                  className={`font-medium ${
                    symbol === item.symbol ? 'text-white' : 'text-foreground'
                  }`}
                >
                  {item.symbol}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Symbol */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold mb-2">Symbol *</Text>
          <TextInput
            value={symbol}
            onChangeText={(text) => setSymbol(text.toUpperCase())}
            placeholder="e.g., AAPL, BTC"
            autoCapitalize="characters"
            placeholderTextColor="#9BA1A6"
            className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground font-mono"
          />
        </View>

        {/* Name */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold mb-2">Name *</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g., Apple Inc., Bitcoin"
            placeholderTextColor="#9BA1A6"
            className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
          />
        </View>

        {/* Quantity */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold mb-2">Quantity *</Text>
          <TextInput
            value={quantity}
            onChangeText={setQuantity}
            placeholder="0"
            keyboardType="decimal-pad"
            placeholderTextColor="#9BA1A6"
            className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-xl font-bold"
          />
        </View>

        {/* Purchase Price */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold mb-2">Purchase Price (per unit) *</Text>
          <View className="bg-surface border border-border rounded-xl px-4 py-3 flex-row items-center">
            <Text className="text-foreground text-xl font-bold mr-2">$</Text>
            <TextInput
              value={purchasePrice}
              onChangeText={setPrice}
              placeholder="0.00"
              keyboardType="decimal-pad"
              placeholderTextColor="#9BA1A6"
              className="flex-1 text-foreground text-xl font-bold"
            />
          </View>
        </View>

        {/* Current Price */}
        <View className="mb-6">
          <Text className="text-foreground font-semibold mb-2">Current Price (per unit) *</Text>
          <View className="bg-surface border border-border rounded-xl px-4 py-3 flex-row items-center">
            <Text className="text-foreground text-xl font-bold mr-2">$</Text>
            <TextInput
              value={currentPrice}
              onChangeText={setCurrentPrice}
              placeholder="0.00"
              keyboardType="decimal-pad"
              placeholderTextColor="#9BA1A6"
              className="flex-1 text-foreground text-xl font-bold"
            />
          </View>
        </View>

        {/* Investment Summary */}
        {totalCost > 0 && (
          <View className="bg-primary/10 rounded-xl p-4 mb-6 border border-primary/30">
            <Text className="text-foreground font-semibold mb-3">Investment Summary</Text>
            <View className="flex-row justify-between mb-2">
              <Text className="text-muted">Total Cost</Text>
              <Text className="text-foreground font-semibold">${totalCost.toFixed(2)}</Text>
            </View>
            <View className="flex-row justify-between mb-2">
              <Text className="text-muted">Current Value</Text>
              <Text className="text-foreground font-semibold">${currentValue.toFixed(2)}</Text>
            </View>
            <View className="h-px bg-border my-2" />
            <View className="flex-row justify-between">
              <Text className="text-muted">Profit/Loss</Text>
              <Text className={`font-bold text-lg ${profitLoss >= 0 ? 'text-success' : 'text-error'}`}>
                {profitLoss >= 0 ? '+' : ''}${profitLoss.toFixed(2)}
              </Text>
            </View>
          </View>
        )}

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          className="bg-primary rounded-xl p-4 mb-4"
          style={{ opacity: isSaving ? 0.6 : 1 }}
        >
          <Text className="text-white text-center font-semibold text-lg">
            {isSaving ? 'Adding...' : 'Add Investment'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          disabled={isSaving}
          className="bg-surface border border-border rounded-xl p-4 mb-6"
          style={{ opacity: isSaving ? 0.6 : 1 }}
        >
          <Text className="text-foreground text-center font-semibold text-lg">
            Cancel
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
