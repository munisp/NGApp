import { View, Text, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
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

export default function InvestmentsScreen() {
  const router = useRouter();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadInvestments();
  }, []);

  const loadInvestments = async () => {
    try {
      setIsLoading(true);
      const stored = await AsyncStorage.getItem(INVESTMENTS_KEY);
      if (stored) {
        setInvestments(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load investments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateTotalValue = (): number => {
    return investments.reduce((sum, inv) => sum + (inv.quantity * inv.currentPrice), 0);
  };

  const calculateTotalCost = (): number => {
    return investments.reduce((sum, inv) => sum + (inv.quantity * inv.purchasePrice), 0);
  };

  const calculateProfitLoss = (): { amount: number; percentage: number } => {
    const totalValue = calculateTotalValue();
    const totalCost = calculateTotalCost();
    const amount = totalValue - totalCost;
    const percentage = totalCost > 0 ? (amount / totalCost) * 100 : 0;
    return { amount, percentage };
  };

  const renderInvestment = ({ item }: { item: Investment }) => {
    const totalValue = item.quantity * item.currentPrice;
    const totalCost = item.quantity * item.purchasePrice;
    const profitLoss = totalValue - totalCost;
    const profitLossPercentage = totalCost > 0 ? (profitLoss / totalCost) * 100 : 0;
    const isProfit = profitLoss >= 0;

    return (
      <TouchableOpacity
        onPress={() => router.push(`/(investments)/${item.id}` as any)}
        className="bg-surface rounded-xl p-4 mb-3 border border-border"
        style={{ opacity: 1 }}
      >
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-1">
            <View className="flex-row items-center mb-1">
              <Text className="text-foreground font-bold text-lg mr-2">
                {item.symbol}
              </Text>
              <View className={`${item.type === 'stock' ? 'bg-primary/20' : 'bg-warning/20'} rounded px-2 py-0.5`}>
                <Text className={`${item.type === 'stock' ? 'text-primary' : 'text-warning'} text-xs font-semibold`}>
                  {item.type.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text className="text-muted text-sm">{item.name}</Text>
          </View>
          <View className="items-end">
            <Text className="text-foreground font-bold text-lg">
              ${totalValue.toFixed(2)}
            </Text>
            <Text className={`font-semibold text-sm ${isProfit ? 'text-success' : 'text-error'}`}>
              {isProfit ? '+' : ''}${profitLoss.toFixed(2)} ({isProfit ? '+' : ''}{profitLossPercentage.toFixed(2)}%)
            </Text>
          </View>
        </View>

        <View className="flex-row justify-between">
          <View>
            <Text className="text-muted text-xs mb-1">Quantity</Text>
            <Text className="text-foreground font-medium">{item.quantity}</Text>
          </View>
          <View>
            <Text className="text-muted text-xs mb-1">Avg. Cost</Text>
            <Text className="text-foreground font-medium">${item.purchasePrice.toFixed(2)}</Text>
          </View>
          <View>
            <Text className="text-muted text-xs mb-1">Current Price</Text>
            <Text className="text-foreground font-medium">${item.currentPrice.toFixed(2)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const totalValue = calculateTotalValue();
  const totalCost = calculateTotalCost();
  const { amount: profitLoss, percentage: profitLossPercentage } = calculateProfitLoss();
  const isProfit = profitLoss >= 0;

  // Calculate diversification
  const stockValue = investments
    .filter(inv => inv.type === 'stock')
    .reduce((sum, inv) => sum + (inv.quantity * inv.currentPrice), 0);
  const cryptoValue = investments
    .filter(inv => inv.type === 'crypto')
    .reduce((sum, inv) => sum + (inv.quantity * inv.currentPrice), 0);
  const stockPercentage = totalValue > 0 ? (stockValue / totalValue) * 100 : 0;
  const cryptoPercentage = totalValue > 0 ? (cryptoValue / totalValue) * 100 : 0;

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Investments', headerShown: true }} />

      {/* Portfolio Summary */}
      {investments.length > 0 && (
        <View className="bg-primary/10 rounded-xl p-6 mb-6 border border-primary/30">
          <Text className="text-foreground font-bold text-xl mb-2">Portfolio Value</Text>
          <Text className="text-primary font-bold text-5xl mb-3">
            ${totalValue.toFixed(2)}
          </Text>
          
          <View className="flex-row items-center mb-4">
            <Text className={`font-bold text-xl mr-2 ${isProfit ? 'text-success' : 'text-error'}`}>
              {isProfit ? '+' : ''}${profitLoss.toFixed(2)}
            </Text>
            <Text className={`font-semibold ${isProfit ? 'text-success' : 'text-error'}`}>
              ({isProfit ? '+' : ''}{profitLossPercentage.toFixed(2)}%)
            </Text>
          </View>

          <View className="flex-row justify-between">
            <View>
              <Text className="text-muted text-sm mb-1">Total Cost</Text>
              <Text className="text-foreground font-semibold">${totalCost.toFixed(2)}</Text>
            </View>
            <View>
              <Text className="text-muted text-sm mb-1">Holdings</Text>
              <Text className="text-foreground font-semibold">{investments.length}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Diversification */}
      {investments.length > 0 && (
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-lg mb-4">Diversification</Text>
          
          {/* Diversification Bar */}
          <View className="flex-row h-3 rounded-full overflow-hidden mb-4">
            {stockPercentage > 0 && (
              <View
                className="bg-primary"
                style={{ width: `${stockPercentage}%` }}
              />
            )}
            {cryptoPercentage > 0 && (
              <View
                className="bg-warning"
                style={{ width: `${cryptoPercentage}%` }}
              />
            )}
          </View>

          <View className="flex-row justify-between">
            <View className="flex-row items-center">
              <View className="w-3 h-3 bg-primary rounded-full mr-2" />
              <Text className="text-muted text-sm">Stocks {stockPercentage.toFixed(0)}%</Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-3 h-3 bg-warning rounded-full mr-2" />
              <Text className="text-muted text-sm">Crypto {cryptoPercentage.toFixed(0)}%</Text>
            </View>
          </View>
        </View>
      )}

      {/* Add Investment Button */}
      <TouchableOpacity
        onPress={() => router.push('/(investments)/add' as any)}
        className="bg-primary rounded-xl p-4 mb-6 flex-row items-center justify-center"
        style={{ opacity: 1 }}
      >
        <Text className="text-white text-2xl mr-2">+</Text>
        <Text className="text-white font-semibold text-lg">Add Investment</Text>
      </TouchableOpacity>

      {/* Investments List */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0a7ea4" />
        </View>
      ) : investments.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-6xl mb-4">📈</Text>
          <Text className="text-foreground font-semibold text-lg mb-2">No Investments</Text>
          <Text className="text-muted text-center mb-6">
            Start building your investment portfolio
          </Text>
        </View>
      ) : (
        <>
          <Text className="text-foreground font-bold text-lg mb-3">Your Holdings</Text>
          <FlatList
            data={investments}
            renderItem={renderInvestment}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
    </ScreenContainer>
  );
}
