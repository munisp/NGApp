import { ScrollView, Text, View, TouchableOpacity, TextInput, RefreshControl, Platform } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  getStockQuote,
  getMultipleQuotes,
  placeOrder,
  getPortfolio,
  getOrders,
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  cancelOrder,
  calculateCommission,
  type StockQuote,
  type TradeOrder,
  type Portfolio,
} from "@/utils/stock-trading";

export default function StockTradingScreen() {
  const colors = useColors();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [watchlist, setWatchlist] = useState<StockQuote[]>([]);
  const [orders, setOrders] = useState<TradeOrder[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockQuote | null>(null);
  const [orderType, setOrderType] = useState<"buy" | "sell">("buy");
  const [priceType, setPriceType] = useState<"market" | "limit" | "stop-loss">("market");
  const [quantity, setQuantity] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [newSymbol, setNewSymbol] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"watchlist" | "portfolio" | "orders">("watchlist");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [portfolioData, ordersData, watchlistSymbols] = await Promise.all([
      getPortfolio(),
      getOrders(),
      getWatchlist(),
    ]);

    setPortfolio(portfolioData);
    setOrders(ordersData);

    const quotes = await getMultipleQuotes(watchlistSymbols);
    setWatchlist(quotes);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleSelectStock = async (symbol: string) => {
    const quote = await getStockQuote(symbol);
    setSelectedStock(quote);
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedStock || !quantity) return;

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) return;

    const commission = calculateCommission(qty, selectedStock.price);

    try {
      await placeOrder({
        symbol: selectedStock.symbol,
        type: orderType,
        orderType: priceType,
        quantity: qty,
        price: priceType === "limit" ? parseFloat(limitPrice) : undefined,
        stopPrice: priceType === "stop-loss" ? parseFloat(stopPrice) : undefined,
        totalAmount: selectedStock.price * qty + commission,
        commission,
      });

      setQuantity("");
      setLimitPrice("");
      setStopPrice("");
      setSelectedStock(null);
      await loadData();
    } catch (error) {
      console.error("Failed to place order:", error);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    await cancelOrder(orderId);
    await loadData();
  };

  const handleAddToWatchlist = async () => {
    if (!newSymbol.trim()) return;
    await addToWatchlist(newSymbol.toUpperCase());
    setNewSymbol("");
    await loadData();
  };

  const handleRemoveFromWatchlist = async (symbol: string) => {
    await removeFromWatchlist(symbol);
    await loadData();
  };

  const estimatedTotal =
    selectedStock && quantity
      ? (priceType === "limit" && limitPrice
          ? parseFloat(limitPrice)
          : selectedStock.price) *
          parseInt(quantity) +
        calculateCommission(parseInt(quantity), selectedStock.price)
      : 0;

  return (
    <ScreenContainer className="p-4">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Header */}
        <View className="mb-6">
          <Text className="text-3xl font-bold text-foreground">Stock Trading</Text>
          <Text className="text-sm text-muted mt-1">Real-time trading with live quotes</Text>
        </View>

        {/* Portfolio Summary */}
        {portfolio && (
          <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
            <Text className="text-base font-semibold text-foreground mb-3">Portfolio Summary</Text>
            <View className="flex-row justify-between mb-2">
              <Text className="text-sm text-muted">Total Value</Text>
              <Text className="text-base font-bold text-foreground">${portfolio.totalValue.toFixed(2)}</Text>
            </View>
            <View className="flex-row justify-between mb-2">
              <Text className="text-sm text-muted">Cash Balance</Text>
              <Text className="text-base font-semibold text-foreground">${portfolio.cashBalance.toFixed(2)}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm text-muted">Total Gain/Loss</Text>
              <Text
                className={`text-base font-bold ${
                  portfolio.totalGainLoss >= 0 ? "text-success" : "text-error"
                }`}
              >
                ${portfolio.totalGainLoss.toFixed(2)} ({portfolio.totalGainLossPercent.toFixed(2)}%)
              </Text>
            </View>
          </View>
        )}

        {/* Tabs */}
        <View className="flex-row mb-4 bg-surface rounded-xl p-1">
          {(["watchlist", "portfolio", "orders"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg ${activeTab === tab ? "bg-primary" : ""}`}
            >
              <Text
                className={`text-center font-semibold capitalize ${
                  activeTab === tab ? "text-background" : "text-muted"
                }`}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Watchlist Tab */}
        {activeTab === "watchlist" && (
          <View>
            {/* Add Symbol */}
            <View className="flex-row mb-4">
              <TextInput
                value={newSymbol}
                onChangeText={setNewSymbol}
                placeholder="Enter symbol (e.g., AAPL)"
                placeholderTextColor={colors.muted}
                className="flex-1 bg-surface border border-border rounded-lg px-4 py-3 text-foreground mr-2"
              />
              <TouchableOpacity
                onPress={handleAddToWatchlist}
                className="bg-primary rounded-lg px-6 justify-center"
              >
                <Text className="text-background font-semibold">Add</Text>
              </TouchableOpacity>
            </View>

            {/* Watchlist */}
            {watchlist.map((stock) => (
              <TouchableOpacity
                key={stock.symbol}
                onPress={() => handleSelectStock(stock.symbol)}
                className="bg-surface rounded-xl p-4 mb-3 border border-border"
              >
                <View className="flex-row justify-between items-center mb-2">
                  <View className="flex-1">
                    <Text className="text-lg font-bold text-foreground">{stock.symbol}</Text>
                    <Text className="text-xs text-muted">{stock.name}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleRemoveFromWatchlist(stock.symbol)}>
                    <Text className="text-error text-xs">Remove</Text>
                  </TouchableOpacity>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-2xl font-bold text-foreground">${stock.price.toFixed(2)}</Text>
                  <View className="items-end">
                    <Text
                      className={`text-base font-semibold ${
                        stock.change >= 0 ? "text-success" : "text-error"
                      }`}
                    >
                      {stock.change >= 0 ? "+" : ""}${stock.change.toFixed(2)}
                    </Text>
                    <Text
                      className={`text-sm ${stock.changePercent >= 0 ? "text-success" : "text-error"}`}
                    >
                      {stock.changePercent >= 0 ? "+" : ""}
                      {stock.changePercent.toFixed(2)}%
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Portfolio Tab */}
        {activeTab === "portfolio" && portfolio && (
          <View>
            {portfolio.holdings.length === 0 ? (
              <View className="bg-surface rounded-xl p-6 items-center">
                <Text className="text-muted text-center">No holdings yet. Start trading to build your portfolio.</Text>
              </View>
            ) : (
              portfolio.holdings.map((holding) => (
                <TouchableOpacity
                  key={holding.symbol}
                  onPress={() => handleSelectStock(holding.symbol)}
                  className="bg-surface rounded-xl p-4 mb-3 border border-border"
                >
                  <View className="flex-row justify-between items-center mb-2">
                    <View>
                      <Text className="text-lg font-bold text-foreground">{holding.symbol}</Text>
                      <Text className="text-xs text-muted">{holding.name}</Text>
                    </View>
                    <Text className="text-sm text-muted">{holding.quantity} shares</Text>
                  </View>
                  <View className="flex-row justify-between items-center">
                    <View>
                      <Text className="text-sm text-muted">Current: ${holding.currentPrice.toFixed(2)}</Text>
                      <Text className="text-sm text-muted">Avg Cost: ${holding.averageCost.toFixed(2)}</Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-lg font-bold text-foreground">${holding.totalValue.toFixed(2)}</Text>
                      <Text
                        className={`text-sm font-semibold ${
                          holding.gainLoss >= 0 ? "text-success" : "text-error"
                        }`}
                      >
                        {holding.gainLoss >= 0 ? "+" : ""}${holding.gainLoss.toFixed(2)} (
                        {holding.gainLossPercent.toFixed(2)}%)
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <View>
            {orders.length === 0 ? (
              <View className="bg-surface rounded-xl p-6 items-center">
                <Text className="text-muted text-center">No orders yet.</Text>
              </View>
            ) : (
              orders.map((order) => (
                <View key={order.id} className="bg-surface rounded-xl p-4 mb-3 border border-border">
                  <View className="flex-row justify-between items-center mb-2">
                    <View>
                      <Text className="text-lg font-bold text-foreground">
                        {order.type.toUpperCase()} {order.symbol}
                      </Text>
                      <Text className="text-xs text-muted">
                        {order.orderType.charAt(0).toUpperCase() + order.orderType.slice(1)} Order
                      </Text>
                    </View>
                    <View
                      className={`px-3 py-1 rounded-full ${
                        order.status === "executed"
                          ? "bg-success"
                          : order.status === "pending"
                          ? "bg-warning"
                          : "bg-error"
                      }`}
                    >
                      <Text className="text-background text-xs font-semibold capitalize">{order.status}</Text>
                    </View>
                  </View>
                  <View className="flex-row justify-between items-center">
                    <View>
                      <Text className="text-sm text-muted">Qty: {order.quantity}</Text>
                      {order.executedPrice && (
                        <Text className="text-sm text-muted">Price: ${order.executedPrice.toFixed(2)}</Text>
                      )}
                    </View>
                    <View className="items-end">
                      <Text className="text-base font-bold text-foreground">${order.totalAmount.toFixed(2)}</Text>
                      {order.status === "pending" && (
                        <TouchableOpacity onPress={() => handleCancelOrder(order.id)}>
                          <Text className="text-error text-xs mt-1">Cancel</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Order Form (when stock selected) */}
        {selectedStock && (
          <View className="bg-surface rounded-2xl p-4 mt-4 border border-border">
            <Text className="text-xl font-bold text-foreground mb-4">
              Trade {selectedStock.symbol}
            </Text>

            {/* Buy/Sell Toggle */}
            <View className="flex-row mb-4 bg-background rounded-xl p-1">
              {(["buy", "sell"] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setOrderType(type)}
                  className={`flex-1 py-2 rounded-lg ${
                    orderType === type ? (type === "buy" ? "bg-success" : "bg-error") : ""
                  }`}
                >
                  <Text
                    className={`text-center font-semibold capitalize ${
                      orderType === type ? "text-background" : "text-muted"
                    }`}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Order Type */}
            <View className="flex-row mb-4">
              {(["market", "limit", "stop-loss"] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setPriceType(type)}
                  className={`flex-1 py-2 rounded-lg mr-2 ${
                    priceType === type ? "bg-primary" : "bg-background"
                  }`}
                >
                  <Text
                    className={`text-center text-xs font-semibold ${
                      priceType === type ? "text-background" : "text-muted"
                    }`}
                  >
                    {type === "stop-loss" ? "Stop" : type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Quantity */}
            <TextInput
              value={quantity}
              onChangeText={setQuantity}
              placeholder="Quantity"
              keyboardType="numeric"
              placeholderTextColor={colors.muted}
              className="bg-background border border-border rounded-lg px-4 py-3 text-foreground mb-3"
            />

            {/* Limit Price */}
            {priceType === "limit" && (
              <TextInput
                value={limitPrice}
                onChangeText={setLimitPrice}
                placeholder="Limit Price"
                keyboardType="numeric"
                placeholderTextColor={colors.muted}
                className="bg-background border border-border rounded-lg px-4 py-3 text-foreground mb-3"
              />
            )}

            {/* Stop Price */}
            {priceType === "stop-loss" && (
              <TextInput
                value={stopPrice}
                onChangeText={setStopPrice}
                placeholder="Stop Price"
                keyboardType="numeric"
                placeholderTextColor={colors.muted}
                className="bg-background border border-border rounded-lg px-4 py-3 text-foreground mb-3"
              />
            )}

            {/* Estimated Total */}
            {quantity && (
              <View className="bg-background rounded-lg p-3 mb-4">
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted">Estimated Total</Text>
                  <Text className="text-base font-bold text-foreground">${estimatedTotal.toFixed(2)}</Text>
                </View>
              </View>
            )}

            {/* Place Order Button */}
            <TouchableOpacity
              onPress={handlePlaceOrder}
              className={`${
                orderType === "buy" ? "bg-success" : "bg-error"
              } rounded-xl py-4 items-center`}
            >
              <Text className="text-background font-bold text-lg">
                {orderType === "buy" ? "Buy" : "Sell"} {selectedStock.symbol}
              </Text>
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              onPress={() => setSelectedStock(null)}
              className="mt-3 py-3 items-center"
            >
              <Text className="text-muted font-semibold">Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
