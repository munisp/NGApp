import { View, Text, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/screen-container';
import AsyncStorage from '@react-native-async-storage/async-storage';

const WEALTH_DATA_KEY = 'wealthData';

interface AssetAllocation {
  category: string;
  value: number;
  color: string;
  emoji: string;
}

export default function AssetAllocationScreen() {
  const [allocations, setAllocations] = useState<AssetAllocation[]>([]);

  useEffect(() => {
    loadAllocations();
  }, []);

  const loadAllocations = async () => {
    try {
      const stored = await AsyncStorage.getItem(WEALTH_DATA_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        
        // Calculate allocations
        const allocs: AssetAllocation[] = [
          { category: 'Cash', value: data.accounts[0].balance + data.accounts[1].balance, color: '#22C55E', emoji: '💵' },
          { category: 'Stocks', value: data.investments[0].value, color: '#0a7ea4', emoji: '📈' },
          { category: 'Bonds', value: data.investments[1].value, color: '#F59E0B', emoji: '📊' },
          { category: 'Crypto', value: data.investments[2].value, color: '#8B5CF6', emoji: '₿' },
        ];

        setAllocations(allocs);
      }
    } catch (error) {
      console.error('Failed to load allocations:', error);
    }
  };

  const totalValue = allocations.reduce((sum, a) => sum + a.value, 0);

  // Simple pie chart using stacked views
  let cumulativePercent = 0;

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Asset Allocation', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text className="text-muted mb-6">
          Your wealth is distributed across different asset classes. Diversification helps manage
          risk.
        </Text>

        {/* Pie Chart Representation */}
        <View className="bg-surface rounded-xl p-8 mb-6 border border-border items-center">
          <View className="w-48 h-48 rounded-full overflow-hidden mb-6" style={{ transform: [{ rotate: '-90deg' }] }}>
            {allocations.map((alloc, index) => {
              const percent = (alloc.value / totalValue) * 100;
              const startPercent = cumulativePercent;
              cumulativePercent += percent;

              return (
                <View
                  key={index}
                  style={{
                    position: 'absolute',
                    width: 192,
                    height: 192,
                    borderRadius: 96,
                    borderWidth: 48,
                    borderColor: alloc.color,
                    borderTopColor: 'transparent',
                    borderRightColor: percent > 25 ? alloc.color : 'transparent',
                    borderBottomColor: percent > 50 ? alloc.color : 'transparent',
                    borderLeftColor: percent > 75 ? alloc.color : 'transparent',
                    transform: [{ rotate: `${startPercent * 3.6}deg` }],
                  }}
                />
              );
            })}
          </View>

          <Text className="text-foreground font-bold text-3xl mb-2">
            ${totalValue.toLocaleString()}
          </Text>
          <Text className="text-muted">Total Assets</Text>
        </View>

        {/* Allocation Breakdown */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-lg mb-4">Breakdown</Text>

          {allocations.map((alloc, index) => {
            const percent = (alloc.value / totalValue) * 100;
            return (
              <View key={index} className="mb-5 last:mb-0">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center flex-1">
                    <Text className="text-2xl mr-3">{alloc.emoji}</Text>
                    <Text className="text-foreground font-semibold">{alloc.category}</Text>
                  </View>
                  <Text className="text-foreground font-bold text-lg">
                    {percent.toFixed(1)}%
                  </Text>
                </View>
                <View className="flex-row items-center mb-2">
                  <View className="flex-1 h-3 bg-border/30 rounded-full overflow-hidden mr-3">
                    <View
                      className="h-full rounded-full"
                      style={{ width: `${percent}%`, backgroundColor: alloc.color }}
                    />
                  </View>
                  <Text className="text-muted text-sm w-24 text-right">
                    ${alloc.value.toLocaleString()}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Recommended Allocation */}
        <View className="bg-primary/10 rounded-xl p-6 mb-6 border border-primary/30">
          <Text className="text-foreground font-bold text-lg mb-3">💡 Recommended Allocation</Text>
          <Text className="text-muted text-sm mb-4">
            For moderate risk tolerance and 10-20 year time horizon:
          </Text>

          <View className="space-y-2">
            <View className="flex-row justify-between mb-2">
              <Text className="text-muted text-sm">Stocks</Text>
              <Text className="text-foreground font-semibold">60%</Text>
            </View>
            <View className="flex-row justify-between mb-2">
              <Text className="text-muted text-sm">Bonds</Text>
              <Text className="text-foreground font-semibold">30%</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-muted text-sm">Cash & Alternatives</Text>
              <Text className="text-foreground font-semibold">10%</Text>
            </View>
          </View>
        </View>

        {/* Tips */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-lg mb-3">Diversification Tips</Text>
          <Text className="text-muted text-sm mb-2">
            • Rebalance your portfolio annually to maintain target allocation
          </Text>
          <Text className="text-muted text-sm mb-2">
            • Younger investors can typically handle more stock exposure
          </Text>
          <Text className="text-muted text-sm mb-2">
            • Increase bond allocation as you approach retirement
          </Text>
          <Text className="text-muted text-sm">
            • Keep 3-6 months of expenses in cash for emergencies
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
