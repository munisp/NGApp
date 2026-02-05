import { View, Text, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';

// Mock monthly trend data
const monthlyData = [
  { month: 'Jan', spending: 1250, budget: 1500 },
  { month: 'Feb', spending: 1380, budget: 1500 },
  { month: 'Mar', spending: 1620, budget: 1500 },
  { month: 'Apr', spending: 1450, budget: 1500 },
  { month: 'May', spending: 1580, budget: 1500 },
  { month: 'Jun', spending: 1420, budget: 1500 },
];

export default function TrendsScreen() {
  const maxSpending = Math.max(...monthlyData.map(d => Math.max(d.spending, d.budget)));
  const avgSpending = monthlyData.reduce((sum, d) => sum + d.spending, 0) / monthlyData.length;
  const totalSpending = monthlyData.reduce((sum, d) => sum + d.spending, 0);

  return (
    <ScreenContainer className="p-4">
      <Stack.Screen options={{ title: 'Monthly Trends', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Summary */}
        <View className="bg-primary/10 rounded-xl p-6 mb-6 border border-primary/30">
          <Text className="text-foreground font-bold text-xl mb-4">6-Month Summary</Text>
          <View className="flex-row justify-between mb-3">
            <Text className="text-muted">Total Spending</Text>
            <Text className="text-foreground font-bold text-lg">
              ${totalSpending.toFixed(2)}
            </Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-muted">Monthly Average</Text>
            <Text className="text-primary font-bold text-lg">
              ${avgSpending.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Chart */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-lg mb-6">Spending vs Budget</Text>
          
          {monthlyData.map((data, index) => {
            const spendingPercent = (data.spending / maxSpending) * 100;
            const budgetPercent = (data.budget / maxSpending) * 100;
            const overBudget = data.spending > data.budget;

            return (
              <View key={index} className="mb-6">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-foreground font-semibold w-12">{data.month}</Text>
                  <View className="flex-1 mx-3">
                    {/* Budget line */}
                    <View className="relative h-8 bg-border/30 rounded-full overflow-hidden">
                      {/* Spending bar */}
                      <View
                        className={`absolute h-full rounded-full ${
                          overBudget ? 'bg-error' : 'bg-primary'
                        }`}
                        style={{ width: `${spendingPercent}%` }}
                      />
                      {/* Budget marker */}
                      <View
                        className="absolute h-full border-r-2 border-warning"
                        style={{ left: `${budgetPercent}%` }}
                      />
                    </View>
                  </View>
                  <Text className={`font-bold text-base w-20 text-right ${
                    overBudget ? 'text-error' : 'text-foreground'
                  }`}>
                    ${data.spending}
                  </Text>
                </View>
                {overBudget && (
                  <Text className="text-error text-xs ml-14">
                    ${(data.spending - data.budget).toFixed(2)} over budget
                  </Text>
                )}
              </View>
            );
          })}

          {/* Legend */}
          <View className="flex-row gap-4 mt-4 pt-4 border-t border-border">
            <View className="flex-row items-center">
              <View className="w-4 h-4 bg-primary rounded mr-2" />
              <Text className="text-muted text-sm">Spending</Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-4 h-4 border-2 border-warning rounded mr-2" />
              <Text className="text-muted text-sm">Budget</Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-4 h-4 bg-error rounded mr-2" />
              <Text className="text-muted text-sm">Over Budget</Text>
            </View>
          </View>
        </View>

        {/* Insights */}
        <View className="bg-surface rounded-xl p-6 mb-6 border border-border">
          <Text className="text-foreground font-bold text-lg mb-4">Trends Analysis</Text>
          
          <View className="bg-primary/10 rounded-xl p-4 mb-3">
            <Text className="text-foreground text-sm leading-relaxed">
              Your spending has been relatively consistent over the past 6 months, averaging ${avgSpending.toFixed(2)} per month.
            </Text>
          </View>

          <View className="bg-warning/10 rounded-xl p-4 mb-3">
            <Text className="text-foreground text-sm leading-relaxed">
              March had the highest spending at ${monthlyData[2].spending}, which was ${(monthlyData[2].spending - monthlyData[2].budget).toFixed(2)} over your budget.
            </Text>
          </View>

          <View className="bg-success/10 rounded-xl p-4">
            <Text className="text-foreground text-sm leading-relaxed">
              💡 Tip: Consider setting category-specific budgets to better control spending in high-expense areas.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
