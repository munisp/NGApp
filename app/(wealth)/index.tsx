import { View, Text, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

const WEALTH_DATA_KEY = 'wealthData';

interface WealthData {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  accounts: { name: string; balance: number }[];
  investments: { name: string; value: number }[];
  savings: { name: string; current: number; target: number }[];
  history: { month: string; netWorth: number }[];
}

export default function WealthDashboardScreen() {
  const router = useRouter();
  const [wealthData, setWealthData] = useState<WealthData | null>(null);
  const screenWidth = Dimensions.get('window').width;

  useEffect(() => {
    loadWealthData();
  }, []);

  const loadWealthData = async () => {
    try {
      const stored = await AsyncStorage.getItem(WEALTH_DATA_KEY);
      let data: WealthData;

      if (stored) {
        data = JSON.parse(stored);
      } else {
        // Generate sample data
        data = {
          netWorth: 125000,
          totalAssets: 175000,
          totalLiabilities: 50000,
          accounts: [
            { name: 'Checking Account', balance: 15000 },
            { name: 'Savings Account', balance: 35000 },
            { name: 'Investment Account', balance: 75000 },
          ],
          investments: [
            { name: 'Stocks', value: 45000 },
            { name: 'Bonds', value: 20000 },
            { name: 'Crypto', value: 10000 },
          ],
          savings: [
            { name: 'Emergency Fund', current: 15000, target: 20000 },
            { name: 'Vacation', current: 5000, target: 10000 },
            { name: 'Home Down Payment', current: 30000, target: 50000 },
          ],
          history: [
            { month: 'Jul', netWorth: 100000 },
            { month: 'Aug', netWorth: 105000 },
            { month: 'Sep', netWorth: 110000 },
            { month: 'Oct', netWorth: 115000 },
            { month: 'Nov', netWorth: 120000 },
            { month: 'Dec', netWorth: 125000 },
          ],
        };
        await AsyncStorage.setItem(WEALTH_DATA_KEY, JSON.stringify(data));
      }

      setWealthData(data);
    } catch (error) {
      console.error('Failed to load wealth data:', error);
    }
  };

  if (!wealthData) {
    return (
      <ScreenContainer className="p-4">
        <Stack.Screen options={{ title: 'Wealth Dashboard', headerShown: true }} />
        <View className="flex-1 justify-center items-center">
          <Text className="text-muted">Loading...</Text>
        </View>
      </ScreenContainer>
    );
  }

  const growthAmount = wealthData.history.length >= 2 
    ? wealthData.netWorth - wealthData.history[0].netWorth 
    : 0;
  const growthPercent = wealthData.history.length >= 2 && wealthData.history[0].netWorth > 0
    ? (growthAmount / wealthData.history[0].netWorth) * 100
    : 0;

  const maxNetWorth = Math.max(...wealthData.history.map(h => h.netWorth));
  const chartHeight = 150;

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Wealth Dashboard', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Net Worth */}
        <View className="bg-gradient-to-br from-primary to-primary/80 rounded-xl p-8 mb-6">
          <Text className="text-white/80 text-sm mb-2">Total Net Worth</Text>
          <Text className="text-white font-bold text-5xl mb-4">
            ${wealthData.netWorth.toLocaleString()}
          </Text>
          <View className="flex-row items-center">
            <Text className={`font-semibold text-lg mr-2 ${growthAmount >= 0 ? 'text-success' : 'text-error'}`}>
              {growthAmount >= 0 ? '↑' : '↓'} ${Math.abs(growthAmount).toLocaleString()}
            </Text>
            <Text className="text-white/80 text-sm">
              ({growthPercent >= 0 ? '+' : ''}{growthPercent.toFixed(1)}%) last 6 months
            </Text>
          </View>
        </View>

        {/* Assets vs Liabilities */}
        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 bg-success/10 rounded-xl p-5 border border-success/30">
            <Text className="text-muted text-sm mb-2">Total Assets</Text>
            <Text className="text-success font-bold text-2xl">
              ${wealthData.totalAssets.toLocaleString()}
            </Text>
          </View>
          <View className="flex-1 bg-error/10 rounded-xl p-5 border border-error/30">
            <Text className="text-muted text-sm mb-2">Total Liabilities</Text>
            <Text className="text-error font-bold text-2xl">
              ${wealthData.totalLiabilities.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Net Worth History Chart */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-lg mb-4">Net Worth Trend</Text>
          <View className="flex-row items-end justify-between" style={{ height: chartHeight }}>
            {wealthData.history.map((item, index) => {
              const barHeight = (item.netWorth / maxNetWorth) * chartHeight;
              return (
                <View key={index} className="flex-1 items-center">
                  <View
                    className="bg-primary rounded-t-lg w-8"
                    style={{ height: barHeight, marginBottom: 8 }}
                  />
                  <Text className="text-muted text-xs">{item.month}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Accounts Summary */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-foreground font-bold text-lg">Accounts</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/accounts' as any)}>
              <Text className="text-primary font-semibold">View All →</Text>
            </TouchableOpacity>
          </View>
          {wealthData.accounts.map((account, index) => (
            <View key={index} className="flex-row justify-between items-center mb-3 last:mb-0">
              <Text className="text-foreground">{account.name}</Text>
              <Text className="text-foreground font-semibold">
                ${account.balance.toLocaleString()}
              </Text>
            </View>
          ))}
        </View>

        {/* Investments Summary */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-foreground font-bold text-lg">Investments</Text>
            <TouchableOpacity onPress={() => router.push('/(investments)/index' as any)}>
              <Text className="text-primary font-semibold">View All →</Text>
            </TouchableOpacity>
          </View>
          {wealthData.investments.map((investment, index) => {
            const total = wealthData.investments.reduce((sum, inv) => sum + inv.value, 0);
            const percentage = (investment.value / total) * 100;
            return (
              <View key={index} className="mb-4 last:mb-0">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-foreground">{investment.name}</Text>
                  <Text className="text-foreground font-semibold">
                    ${investment.value.toLocaleString()} ({percentage.toFixed(0)}%)
                  </Text>
                </View>
                <View className="h-2 bg-border/30 rounded-full overflow-hidden">
                  <View
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${percentage}%` }}
                  />
                </View>
              </View>
            );
          })}
        </View>

        {/* Savings Goals */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-foreground font-bold text-lg">Savings Goals</Text>
            <TouchableOpacity onPress={() => router.push('/(savings)/index' as any)}>
              <Text className="text-primary font-semibold">View All →</Text>
            </TouchableOpacity>
          </View>
          {wealthData.savings.map((goal, index) => {
            const progress = (goal.current / goal.target) * 100;
            return (
              <View key={index} className="mb-4 last:mb-0">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-foreground">{goal.name}</Text>
                  <Text className="text-muted text-sm">
                    ${goal.current.toLocaleString()} / ${goal.target.toLocaleString()}
                  </Text>
                </View>
                <View className="h-2 bg-border/30 rounded-full overflow-hidden">
                  <View
                    className="h-full bg-success rounded-full"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </View>
              </View>
            );
          })}
        </View>

        {/* Quick Actions */}
        <View className="gap-3 mb-6">
          <TouchableOpacity
            onPress={() => router.push('/(wealth)/projections' as any)}
            className="bg-primary rounded-xl p-4"
            style={{ opacity: 1 }}
          >
            <Text className="text-white text-center font-semibold text-lg">
              📈 View Wealth Projections
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(wealth)/allocation' as any)}
            className="bg-surface border border-border rounded-xl p-4"
            style={{ opacity: 1 }}
          >
            <Text className="text-foreground text-center font-semibold text-lg">
              🥧 Asset Allocation
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
