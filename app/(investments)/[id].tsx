import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Investment {
  id: string;
  symbol: string;
  name: string;
  type: 'stock' | 'crypto';
  quantity: number;
  purchasePrice: number;
  currentPrice: number;
  purchaseDate: string;
}

const INVESTMENTS_KEY = 'investments';

export default function InvestmentDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const investmentId = params.id as string;

  const [investment, setInvestment] = useState<Investment | null>(null);

  useEffect(() => {
    loadInvestment();
  }, [investmentId]);

  const loadInvestment = async () => {
    try {
      const stored = await AsyncStorage.getItem(INVESTMENTS_KEY);
      if (stored) {
        const investments = JSON.parse(stored);
        const found = investments.find((inv: Investment) => inv.id === investmentId);
        if (found) {
          setInvestment(found);
        }
      }
    } catch (error) {
      console.error('Failed to load investment:', error);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Investment',
      'Are you sure you want to remove this investment from your portfolio?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const stored = await AsyncStorage.getItem(INVESTMENTS_KEY);
              if (stored) {
                const investments = JSON.parse(stored);
                const updated = investments.filter((inv: Investment) => inv.id !== investmentId);
                await AsyncStorage.setItem(INVESTMENTS_KEY, JSON.stringify(updated));
              }
              router.back();
            } catch (error) {
              console.error('Failed to delete investment:', error);
              Alert.alert('Error', 'Failed to delete investment');
            }
          },
        },
      ]
    );
  };

  if (!investment) {
    return (
      <ScreenContainer className="p-4 justify-center items-center">
        <Text className="text-foreground">Loading...</Text>
      </ScreenContainer>
    );
  }

  const totalValue = investment.quantity * investment.currentPrice;
  const totalCost = investment.quantity * investment.purchasePrice;
  const profitLoss = totalValue - totalCost;
  const profitLossPercentage = totalCost > 0 ? (profitLoss / totalCost) * 100 : 0;
  const isProfit = profitLoss >= 0;

  // Calculate days held
  const daysHeld = Math.floor(
    (new Date().getTime() - new Date(investment.purchaseDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: investment.symbol, headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Investment Header */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border items-center">
          <View className="flex-row items-center mb-2">
            <Text className="text-foreground font-bold text-3xl mr-2">
              {investment.symbol}
            </Text>
            <View className={`${investment.type === 'stock' ? 'bg-primary/20' : 'bg-warning/20'} rounded px-3 py-1`}>
              <Text className={`${investment.type === 'stock' ? 'text-primary' : 'text-warning'} font-semibold`}>
                {investment.type.toUpperCase()}
              </Text>
            </View>
          </View>
          <Text className="text-muted text-lg mb-4">{investment.name}</Text>

          <Text className="text-primary font-bold text-5xl mb-2">
            ${totalValue.toFixed(2)}
          </Text>
          <Text className="text-muted text-sm">Current Value</Text>
        </View>

        {/* Performance */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-lg mb-4">Performance</Text>

          <View className="flex-row justify-between mb-4">
            <View className="flex-1">
              <Text className="text-muted text-sm mb-1">Profit/Loss</Text>
              <Text className={`font-bold text-2xl ${isProfit ? 'text-success' : 'text-error'}`}>
                {isProfit ? '+' : ''}${profitLoss.toFixed(2)}
              </Text>
            </View>
            <View className="flex-1 items-end">
              <Text className="text-muted text-sm mb-1">Return</Text>
              <Text className={`font-bold text-2xl ${isProfit ? 'text-success' : 'text-error'}`}>
                {isProfit ? '+' : ''}{profitLossPercentage.toFixed(2)}%
              </Text>
            </View>
          </View>

          {/* Simple Performance Bar */}
          <View className="bg-border rounded-full h-3 overflow-hidden mb-2">
            <View
              className={`${isProfit ? 'bg-success' : 'bg-error'} h-full rounded-full`}
              style={{ width: `${Math.min(Math.abs(profitLossPercentage), 100)}%` }}
            />
          </View>
        </View>

        {/* Investment Details */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-lg mb-4">Details</Text>

          <View className="flex-row justify-between mb-3">
            <Text className="text-muted">Quantity</Text>
            <Text className="text-foreground font-semibold">{investment.quantity}</Text>
          </View>

          <View className="flex-row justify-between mb-3">
            <Text className="text-muted">Purchase Price</Text>
            <Text className="text-foreground font-semibold">
              ${investment.purchasePrice.toFixed(2)}
            </Text>
          </View>

          <View className="flex-row justify-between mb-3">
            <Text className="text-muted">Current Price</Text>
            <Text className="text-foreground font-semibold">
              ${investment.currentPrice.toFixed(2)}
            </Text>
          </View>

          <View className="h-px bg-border my-3" />

          <View className="flex-row justify-between mb-3">
            <Text className="text-muted">Total Cost</Text>
            <Text className="text-foreground font-semibold">${totalCost.toFixed(2)}</Text>
          </View>

          <View className="flex-row justify-between mb-3">
            <Text className="text-muted">Current Value</Text>
            <Text className="text-primary font-bold text-lg">${totalValue.toFixed(2)}</Text>
          </View>

          <View className="h-px bg-border my-3" />

          <View className="flex-row justify-between">
            <Text className="text-muted">Days Held</Text>
            <Text className="text-foreground font-semibold">{daysHeld} days</Text>
          </View>

          <View className="flex-row justify-between mt-3">
            <Text className="text-muted">Purchase Date</Text>
            <Text className="text-foreground font-semibold">
              {new Date(investment.purchaseDate).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Price Change Indicator */}
        <View className={`${isProfit ? 'bg-success/10 border-success' : 'bg-error/10 border-error'} rounded-xl p-4 mb-6 border`}>
          <Text className={`${isProfit ? 'text-success' : 'text-error'} font-semibold mb-2`}>
            {isProfit ? '📈 Gaining' : '📉 Losing'}
          </Text>
          <Text className="text-muted text-sm">
            {isProfit
              ? `Your investment has increased by $${profitLoss.toFixed(2)} since purchase.`
              : `Your investment has decreased by $${Math.abs(profitLoss).toFixed(2)} since purchase.`}
          </Text>
        </View>

        {/* Actions */}
        <TouchableOpacity
          onPress={handleDelete}
          className="bg-error/20 border border-error rounded-xl p-4 mb-6"
          style={{ opacity: 1 }}
        >
          <Text className="text-error text-center font-semibold text-lg">
            Remove from Portfolio
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
