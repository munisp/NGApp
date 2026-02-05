import { ScrollView, Text, View, Pressable, Alert, ActivityIndicator, TextInput } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  calculatePortfolioPerformance,
  addHolding,
  deleteHolding,
  getInvestmentRecommendations,
  getTotalDividends,
  addDividend,
  type PortfolioPerformance,
} from "@/utils/portfolio-tracker-enhanced";

export default function EnhancedPortfolioScreen() {
  const colors = useColors();
  const [performance, setPerformance] = useState<PortfolioPerformance | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [totalDividends, setTotalDividends] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newHolding, setNewHolding] = useState({
    symbol: "",
    name: "",
    type: "stock" as "stock" | "crypto",
    quantity: "",
    purchasePrice: "",
  });

  useEffect(() => {
    loadPortfolio();
  }, []);

  const loadPortfolio = async () => {
    setIsLoading(true);
    try {
      const perf = await calculatePortfolioPerformance();
      setPerformance(perf);

      const recs = await getInvestmentRecommendations(perf);
      setRecommendations(recs);

      const divs = await getTotalDividends();
      setTotalDividends(divs);
    } catch (error: any) {
      console.error("Failed to load portfolio:", error);
      Alert.alert("Error", "Failed to load portfolio");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await loadPortfolio();
    setIsRefreshing(false);
  };

  const handleAddHolding = async () => {
    if (
      !newHolding.symbol ||
      !newHolding.name ||
      !newHolding.quantity ||
      !newHolding.purchasePrice
    ) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    try {
      await addHolding({
        symbol: newHolding.symbol.toUpperCase(),
        name: newHolding.name,
        type: newHolding.type,
        quantity: parseFloat(newHolding.quantity),
        purchasePrice: parseFloat(newHolding.purchasePrice),
        purchaseDate: Date.now(),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowAddForm(false);
      setNewHolding({
        symbol: "",
        name: "",
        type: "stock",
        quantity: "",
        purchasePrice: "",
      });
      await loadPortfolio();
    } catch (error: any) {
      Alert.alert("Error", "Failed to add holding");
    }
  };

  const handleDeleteHolding = (id: string, symbol: string) => {
    Alert.alert(
      "Delete Holding",
      `Are you sure you want to remove ${symbol} from your portfolio?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteHolding(id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await loadPortfolio();
            } catch (error) {
              Alert.alert("Error", "Failed to delete holding");
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-base text-muted mt-4">Loading portfolio...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-2xl font-bold text-foreground">Portfolio Tracker</Text>
              <Text className="text-sm text-muted">Real-time stocks & crypto</Text>
            </View>

            <Pressable
              onPress={handleRefresh}
              disabled={isRefreshing}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.primary,
                  opacity: pressed || isRefreshing ? 0.7 : 1,
                },
              ]}
              className="w-12 h-12 rounded-full items-center justify-center"
            >
              <Text style={{ color: colors.background }} className="text-xl">
                {isRefreshing ? "⏳" : "🔄"}
              </Text>
            </Pressable>
          </View>

          {/* Portfolio Summary */}
          {performance && (
            <View
              style={{ backgroundColor: colors.surface }}
              className="rounded-2xl p-5"
            >
              <Text className="text-sm text-muted mb-4">Total Portfolio Value</Text>
              <Text className="text-4xl font-bold text-foreground mb-4">
                ${performance.totalValue.toFixed(2)}
              </Text>

              <View className="flex-row items-center gap-6">
                <View className="flex-1">
                  <Text className="text-xs text-muted mb-1">Total Gain/Loss</Text>
                  <Text
                    style={{
                      color:
                        performance.totalGainLoss >= 0 ? colors.success : colors.error,
                    }}
                    className="text-lg font-bold"
                  >
                    {performance.totalGainLoss >= 0 ? "+" : ""}$
                    {performance.totalGainLoss.toFixed(2)}
                  </Text>
                  <Text
                    style={{
                      color:
                        performance.totalGainLoss >= 0 ? colors.success : colors.error,
                    }}
                    className="text-sm font-semibold"
                  >
                    {performance.totalGainLossPercentage >= 0 ? "+" : ""}
                    {performance.totalGainLossPercentage.toFixed(2)}%
                  </Text>
                </View>

                <View className="flex-1">
                  <Text className="text-xs text-muted mb-1">Today's Change</Text>
                  <Text
                    style={{
                      color: performance.dayChange >= 0 ? colors.success : colors.error,
                    }}
                    className="text-lg font-bold"
                  >
                    {performance.dayChange >= 0 ? "+" : ""}$
                    {performance.dayChange.toFixed(2)}
                  </Text>
                  <Text
                    style={{
                      color: performance.dayChange >= 0 ? colors.success : colors.error,
                    }}
                    className="text-sm font-semibold"
                  >
                    {performance.dayChangePercentage >= 0 ? "+" : ""}
                    {performance.dayChangePercentage.toFixed(2)}%
                  </Text>
                </View>
              </View>

              {totalDividends > 0 && (
                <View
                  style={{ backgroundColor: colors.background }}
                  className="rounded-xl p-3 mt-4"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-muted">Total Dividends</Text>
                    <Text
                      style={{ color: colors.success }}
                      className="text-base font-bold"
                    >
                      ${totalDividends.toFixed(2)}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* AI Recommendations */}
          {recommendations.length > 0 && (
            <View
              style={{ backgroundColor: colors.surface }}
              className="rounded-2xl p-5"
            >
              <View className="flex-row items-center gap-2 mb-4">
                <Text className="text-xl">🤖</Text>
                <Text className="text-lg font-bold text-foreground">
                  AI Recommendations
                </Text>
              </View>

              {recommendations.map((rec, index) => (
                <View
                  key={index}
                  style={{ backgroundColor: colors.background }}
                  className="rounded-xl p-4 mb-3"
                >
                  <Text className="text-sm text-foreground leading-relaxed">{rec}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Holdings List */}
          {performance && performance.holdings.length > 0 && (
            <View>
              <Text className="text-lg font-bold text-foreground mb-4">Holdings</Text>

              {performance.holdings.map((holding) => (
                <Pressable
                  key={holding.id}
                  onLongPress={() => handleDeleteHolding(holding.id, holding.symbol)}
                  style={({ pressed }) => [
                    {
                      backgroundColor: colors.surface,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  className="rounded-2xl p-5 mb-3"
                >
                  <View className="flex-row items-start justify-between mb-3">
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2 mb-1">
                        <Text className="text-lg font-bold text-foreground">
                          {holding.symbol}
                        </Text>
                        <View
                          style={{
                            backgroundColor:
                              holding.type === "stock"
                                ? colors.primary + "20"
                                : "#F59E0B20",
                          }}
                          className="rounded-full px-2 py-1"
                        >
                          <Text
                            style={{
                              color:
                                holding.type === "stock" ? colors.primary : "#F59E0B",
                            }}
                            className="text-xs font-semibold"
                          >
                            {holding.type.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-sm text-muted">{holding.name}</Text>
                    </View>

                    <View className="items-end">
                      <Text className="text-lg font-bold text-foreground">
                        ${holding.currentValue.toFixed(2)}
                      </Text>
                      <Text
                        style={{
                          color: holding.gainLoss >= 0 ? colors.success : colors.error,
                        }}
                        className="text-sm font-semibold"
                      >
                        {holding.gainLoss >= 0 ? "+" : ""}$
                        {holding.gainLoss.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{ backgroundColor: colors.background }}
                    className="rounded-xl p-3"
                  >
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-xs text-muted">Quantity</Text>
                      <Text className="text-sm font-semibold text-foreground">
                        {holding.quantity.toFixed(4)}
                      </Text>
                    </View>

                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-xs text-muted">Current Price</Text>
                      <Text className="text-sm font-semibold text-foreground">
                        ${holding.currentPrice.toFixed(2)}
                      </Text>
                    </View>

                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-xs text-muted">Purchase Price</Text>
                      <Text className="text-sm font-semibold text-foreground">
                        ${holding.purchasePrice.toFixed(2)}
                      </Text>
                    </View>

                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs text-muted">Gain/Loss</Text>
                      <Text
                        style={{
                          color: holding.gainLoss >= 0 ? colors.success : colors.error,
                        }}
                        className="text-sm font-bold"
                      >
                        {holding.gainLossPercentage >= 0 ? "+" : ""}
                        {holding.gainLossPercentage.toFixed(2)}%
                      </Text>
                    </View>
                  </View>

                  <View className="mt-3">
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className="text-xs text-muted">Portfolio Weight</Text>
                      <Text className="text-xs font-semibold text-foreground">
                        {holding.weight.toFixed(1)}%
                      </Text>
                    </View>
                    <View className="h-2 bg-muted/20 rounded-full overflow-hidden">
                      <View
                        style={{
                          width: `${holding.weight}%`,
                          backgroundColor: colors.primary,
                        }}
                        className="h-full"
                      />
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {/* Add Holding Form */}
          {showAddForm ? (
            <View
              style={{ backgroundColor: colors.surface }}
              className="rounded-2xl p-5"
            >
              <Text className="text-lg font-bold text-foreground mb-4">
                Add New Holding
              </Text>

              <View className="gap-4">
                <View>
                  <Text className="text-sm text-muted mb-2">Symbol *</Text>
                  <TextInput
                    value={newHolding.symbol}
                    onChangeText={(text) =>
                      setNewHolding({ ...newHolding, symbol: text.toUpperCase() })
                    }
                    placeholder="e.g., AAPL, BTC"
                    placeholderTextColor={colors.muted}
                    style={{
                      backgroundColor: colors.background,
                      color: colors.foreground,
                    }}
                    className="rounded-xl px-4 py-3 text-base"
                  />
                </View>

                <View>
                  <Text className="text-sm text-muted mb-2">Name *</Text>
                  <TextInput
                    value={newHolding.name}
                    onChangeText={(text) =>
                      setNewHolding({ ...newHolding, name: text })
                    }
                    placeholder="e.g., Apple Inc., Bitcoin"
                    placeholderTextColor={colors.muted}
                    style={{
                      backgroundColor: colors.background,
                      color: colors.foreground,
                    }}
                    className="rounded-xl px-4 py-3 text-base"
                  />
                </View>

                <View>
                  <Text className="text-sm text-muted mb-2">Type *</Text>
                  <View className="flex-row gap-3">
                    <Pressable
                      onPress={() => setNewHolding({ ...newHolding, type: "stock" })}
                      style={{
                        backgroundColor:
                          newHolding.type === "stock"
                            ? colors.primary
                            : colors.background,
                      }}
                      className="flex-1 rounded-xl px-4 py-3"
                    >
                      <Text
                        style={{
                          color:
                            newHolding.type === "stock"
                              ? colors.background
                              : colors.foreground,
                        }}
                        className="text-center font-semibold"
                      >
                        Stock
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setNewHolding({ ...newHolding, type: "crypto" })}
                      style={{
                        backgroundColor:
                          newHolding.type === "crypto"
                            ? colors.primary
                            : colors.background,
                      }}
                      className="flex-1 rounded-xl px-4 py-3"
                    >
                      <Text
                        style={{
                          color:
                            newHolding.type === "crypto"
                              ? colors.background
                              : colors.foreground,
                        }}
                        className="text-center font-semibold"
                      >
                        Crypto
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <View>
                  <Text className="text-sm text-muted mb-2">Quantity *</Text>
                  <TextInput
                    value={newHolding.quantity}
                    onChangeText={(text) =>
                      setNewHolding({ ...newHolding, quantity: text })
                    }
                    placeholder="0.00"
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                    style={{
                      backgroundColor: colors.background,
                      color: colors.foreground,
                    }}
                    className="rounded-xl px-4 py-3 text-base"
                  />
                </View>

                <View>
                  <Text className="text-sm text-muted mb-2">Purchase Price *</Text>
                  <TextInput
                    value={newHolding.purchasePrice}
                    onChangeText={(text) =>
                      setNewHolding({ ...newHolding, purchasePrice: text })
                    }
                    placeholder="0.00"
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                    style={{
                      backgroundColor: colors.background,
                      color: colors.foreground,
                    }}
                    className="rounded-xl px-4 py-3 text-base"
                  />
                </View>

                <View className="flex-row gap-3">
                  <Pressable
                    onPress={() => setShowAddForm(false)}
                    style={({ pressed }) => [
                      {
                        backgroundColor: colors.background,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                    className="flex-1 rounded-xl px-4 py-3"
                  >
                    <Text
                      style={{ color: colors.foreground }}
                      className="text-center font-semibold"
                    >
                      Cancel
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleAddHolding}
                    style={({ pressed }) => [
                      {
                        backgroundColor: colors.primary,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                    className="flex-1 rounded-xl px-4 py-3"
                  >
                    <Text
                      style={{ color: colors.background }}
                      className="text-center font-semibold"
                    >
                      Add Holding
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowAddForm(true);
              }}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              className="rounded-xl px-6 py-4"
            >
              <Text
                style={{ color: colors.background }}
                className="text-center font-bold text-base"
              >
                + Add New Holding
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
