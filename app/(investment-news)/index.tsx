import { ScrollView, Text, View, Pressable, ActivityIndicator, Linking, RefreshControl } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  fetchFinancialNews,
  fetchMarketData,
  analyzePortfolioSentiment,
  getEarningsCalendar,
  getAnalystRecommendations,
  type NewsArticle,
  type MarketUpdate,
} from "@/utils/investment-news";

export default function InvestmentNewsScreen() {
  const colors = useColors();
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [marketData, setMarketData] = useState<MarketUpdate[]>([]);
  const [sentiment, setSentiment] = useState<{
    overall: "positive" | "neutral" | "negative";
    summary: string;
  } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Mock portfolio symbols
  const portfolioSymbols = ["AAPL", "MSFT", "GOOGL", "TSLA", "BTC", "ETH"];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [newsData, marketDataResult, sentimentResult] = await Promise.all([
        fetchFinancialNews(portfolioSymbols),
        fetchMarketData(portfolioSymbols),
        analyzePortfolioSentiment(portfolioSymbols),
      ]);

      setNews(newsData);
      setMarketData(marketDataResult);
      setSentiment({ overall: sentimentResult.overall, summary: sentimentResult.summary });
    } catch (error) {
      console.error("Failed to load investment news:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const handleOpenArticle = async (url: string) => {
    try {
      await Linking.openURL(url);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error("Failed to open article:", error);
    }
  };

  const filteredNews =
    selectedCategory === "all"
      ? news
      : news.filter((article) => article.category === selectedCategory);

  const categories = [
    { id: "all", label: "All News", icon: "📰" },
    { id: "market", label: "Markets", icon: "📈" },
    { id: "earnings", label: "Earnings", icon: "💰" },
    { id: "analysis", label: "Analysis", icon: "📊" },
    { id: "crypto", label: "Crypto", icon: "₿" },
    { id: "economy", label: "Economy", icon: "🌍" },
  ];

  const getSentimentColor = (sentiment?: "positive" | "neutral" | "negative") => {
    if (!sentiment) return colors.muted;
    return sentiment === "positive"
      ? colors.success
      : sentiment === "negative"
      ? colors.error
      : colors.warning;
  };

  const getSentimentIcon = (sentiment?: "positive" | "neutral" | "negative") => {
    if (!sentiment) return "⚪";
    return sentiment === "positive" ? "🟢" : sentiment === "negative" ? "🔴" : "🟡";
  };

  if (isLoading) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-base text-muted mt-4">Loading investment news...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        <View className="gap-6">
          {/* Header */}
          <View>
            <Text className="text-2xl font-bold text-foreground mb-2">Investment News</Text>
            <Text className="text-sm text-muted">Stay updated with market trends and portfolio insights</Text>
          </View>

          {/* Market Data Ticker */}
          {marketData.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-3">
              {marketData.map((stock) => (
                <View
                  key={stock.symbol}
                  style={{ backgroundColor: colors.surface }}
                  className="rounded-2xl p-4 min-w-[140px]"
                >
                  <Text className="text-xs text-muted mb-1">{stock.symbol}</Text>
                  <Text className="text-lg font-bold text-foreground mb-1">
                    ${stock.price.toFixed(2)}
                  </Text>
                  <View className="flex-row items-center gap-1">
                    <Text
                      style={{ color: stock.change >= 0 ? colors.success : colors.error }}
                      className="text-sm font-semibold"
                    >
                      {stock.change >= 0 ? "+" : ""}
                      {stock.changePercent.toFixed(2)}%
                    </Text>
                    <Text className="text-xs">{stock.change >= 0 ? "📈" : "📉"}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Portfolio Sentiment */}
          {sentiment && (
            <View
              style={{ backgroundColor: getSentimentColor(sentiment.overall) + "20" }}
              className="rounded-2xl p-5"
            >
              <View className="flex-row items-center gap-2 mb-3">
                <Text className="text-2xl">{getSentimentIcon(sentiment.overall)}</Text>
                <Text className="text-lg font-bold text-foreground">Portfolio Sentiment</Text>
              </View>
              <Text className="text-sm text-foreground leading-relaxed">{sentiment.summary}</Text>
            </View>
          )}

          {/* Category Filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-3">
            {categories.map((category) => (
              <Pressable
                key={category.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedCategory(category.id);
                }}
                style={({ pressed }) => [
                  {
                    backgroundColor:
                      selectedCategory === category.id ? colors.primary : colors.surface,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                className="rounded-full px-4 py-2 flex-row items-center gap-2"
              >
                <Text className="text-base">{category.icon}</Text>
                <Text
                  style={{
                    color:
                      selectedCategory === category.id ? colors.background : colors.foreground,
                  }}
                  className="font-semibold"
                >
                  {category.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* News Articles */}
          <View>
            <Text className="text-lg font-bold text-foreground mb-4">
              {selectedCategory === "all" ? "Latest News" : categories.find((c) => c.id === selectedCategory)?.label}
            </Text>

            {filteredNews.length === 0 ? (
              <View
                style={{ backgroundColor: colors.surface }}
                className="rounded-2xl p-8 items-center"
              >
                <Text className="text-4xl mb-3">📰</Text>
                <Text className="text-base text-muted text-center">
                  No news articles found for this category
                </Text>
              </View>
            ) : (
              filteredNews.map((article) => (
                <Pressable
                  key={article.id}
                  onPress={() => handleOpenArticle(article.url)}
                  style={({ pressed }) => [
                    {
                      backgroundColor: colors.surface,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  className="rounded-2xl p-5 mb-4"
                >
                  {/* Article Header */}
                  <View className="flex-row items-start justify-between mb-3">
                    <View className="flex-1 pr-3">
                      <Text className="text-base font-bold text-foreground leading-snug mb-2">
                        {article.title}
                      </Text>
                      <Text className="text-sm text-muted leading-relaxed">
                        {article.summary}
                      </Text>
                    </View>

                    {article.sentiment && (
                      <View className="items-center">
                        <Text className="text-2xl">{getSentimentIcon(article.sentiment)}</Text>
                      </View>
                    )}
                  </View>

                  {/* Article Meta */}
                  <View className="flex-row items-center justify-between pt-3 border-t border-border">
                    <View className="flex-row items-center gap-3">
                      <Text className="text-xs text-muted">{article.source}</Text>
                      <Text className="text-xs text-muted">
                        {new Date(article.publishedAt).toLocaleDateString()}
                      </Text>
                    </View>

                    {article.symbols && article.symbols.length > 0 && (
                      <View className="flex-row gap-2">
                        {article.symbols.slice(0, 3).map((symbol) => (
                          <View
                            key={symbol}
                            style={{ backgroundColor: colors.primary + "20" }}
                            className="rounded-full px-2 py-1"
                          >
                            <Text
                              style={{ color: colors.primary }}
                              className="text-xs font-bold"
                            >
                              {symbol}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Read More Indicator */}
                  <View className="flex-row items-center gap-1 mt-3">
                    <Text style={{ color: colors.primary }} className="text-sm font-semibold">
                      Read full article
                    </Text>
                    <Text style={{ color: colors.primary }} className="text-sm">
                      →
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
