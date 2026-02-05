import { ScrollView, Text, View, Pressable, TextInput, Alert } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  searchTransactions,
  getSearchSuggestions,
  saveSearchQuery,
  getFilterPresets,
  getTransactionStatistics,
  getActiveFiltersCount,
  clearAllFilters,
  formatFilterSummary,
  type TransactionFilters,
  type Transaction,
} from "@/utils/transaction-search";

export default function TransactionSearchScreen() {
  const colors = useColors();
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<TransactionFilters>({});
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [results, setResults] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [presets, setPresets] = useState<any[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  
  // Mock transactions
  const mockTransactions: Transaction[] = [
    {
      id: "1",
      description: "Grocery Store Purchase",
      amount: -45.50,
      type: "expense",
      category: "Food",
      date: Date.now() - 86400000,
      status: "completed",
      merchant: "Whole Foods",
    },
    {
      id: "2",
      description: "Salary Deposit",
      amount: 3000.00,
      type: "income",
      category: "Salary",
      date: Date.now() - 172800000,
      status: "completed",
    },
    {
      id: "3",
      description: "Electric Bill Payment",
      amount: -120.00,
      type: "expense",
      category: "Utilities",
      date: Date.now() - 259200000,
      status: "completed",
      merchant: "Power Company",
    },
    {
      id: "4",
      description: "Online Shopping",
      amount: -89.99,
      type: "expense",
      category: "Shopping",
      date: Date.now() - 345600000,
      status: "completed",
      merchant: "Amazon",
    },
    {
      id: "5",
      description: "Freelance Payment",
      amount: 500.00,
      type: "income",
      category: "Freelance",
      date: Date.now() - 432000000,
      status: "completed",
    },
  ];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    performSearch();
  }, [searchQuery, filters]);

  const loadData = async () => {
    const [presetsData] = await Promise.all([getFilterPresets()]);
    
    setPresets(presetsData);
    setResults(mockTransactions);
    setStats(getTransactionStatistics(mockTransactions));
  };

  const performSearch = async () => {
    const filtered = searchTransactions(mockTransactions, {
      ...filters,
      search_query: searchQuery,
    });
    
    setResults(filtered);
    setStats(getTransactionStatistics(filtered));
    
    if (searchQuery.trim()) {
      const suggestionList = await getSearchSuggestions(searchQuery);
      setSuggestions(suggestionList);
    } else {
      setSuggestions([]);
    }
  };

  const handleSearch = async () => {
    if (searchQuery.trim()) {
      await saveSearchQuery(searchQuery);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleApplyPreset = (preset: any) => {
    setFilters(preset.filters);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleClearFilters = () => {
    setFilters(clearAllFilters());
    setSearchQuery("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const activeFiltersCount = getActiveFiltersCount({ ...filters, search_query: searchQuery });

  if (showFilters) {
    return (
      <ScreenContainer className="p-6">
        <ScrollView showsVerticalScrollIndicator={false}>
          <View className="gap-6">
            <View className="flex-row items-center justify-between">
              <Text className="text-2xl font-bold text-foreground">Filters</Text>
              <Pressable onPress={() => setShowFilters(false)}>
                <Text className="text-base text-muted">Done</Text>
              </Pressable>
            </View>

            {/* Filter Presets */}
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">Quick Filters</Text>
              
              {presets.map((preset, index) => (
                <Pressable
                  key={index}
                  onPress={() => {
                    handleApplyPreset(preset);
                    setShowFilters(false);
                  }}
                  style={({ pressed }) => [
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  className="rounded-xl p-4 border"
                >
                  <Text className="text-base font-semibold text-foreground">{preset.name}</Text>
                </Pressable>
              ))}
            </View>

            {/* Clear Filters */}
            {activeFiltersCount > 0 && (
              <Pressable
                onPress={() => {
                  handleClearFilters();
                  setShowFilters(false);
                }}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.error + "20",
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                className="rounded-xl py-3"
              >
                <Text
                  style={{ color: colors.error }}
                  className="text-center font-semibold text-base"
                >
                  Clear All Filters
                </Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          <View className="gap-2">
            <Text className="text-2xl font-bold text-foreground">Search Transactions</Text>
            <Text className="text-sm text-muted">Find transactions with filters</Text>
          </View>

          {/* Search Input */}
          <View className="gap-2">
            <View className="flex-row gap-2">
              <View className="flex-1">
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={handleSearch}
                  placeholder="Search by description, merchant..."
                  returnKeyType="search"
                  style={{
                    backgroundColor: colors.surface,
                    color: colors.foreground,
                    borderColor: colors.border,
                  }}
                  className="border rounded-xl px-4 py-3 text-base"
                  placeholderTextColor={colors.muted}
                />
              </View>
              
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowFilters(true);
                }}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                className="w-12 h-12 rounded-xl items-center justify-center"
              >
                <Text className="text-xl">🔍</Text>
                {activeFiltersCount > 0 && (
                  <View
                    style={{ backgroundColor: colors.error }}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full items-center justify-center"
                  >
                    <Text style={{ color: colors.background }} className="text-xs font-bold">
                      {activeFiltersCount}
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>

            {/* Search Suggestions */}
            {suggestions.length > 0 && (
              <View className="gap-2">
                {suggestions.map((suggestion, index) => (
                  <Pressable
                    key={index}
                    onPress={() => {
                      setSearchQuery(suggestion);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={({ pressed }) => [
                      {
                        backgroundColor: colors.surface,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                    className="px-4 py-2 rounded-lg"
                  >
                    <Text className="text-sm text-muted">{suggestion}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Active Filters Summary */}
            {activeFiltersCount > 0 && (
              <View
                style={{ backgroundColor: colors.primary + "20" }}
                className="rounded-lg p-3"
              >
                <Text className="text-sm text-foreground">
                  {formatFilterSummary({ ...filters, search_query: searchQuery })}
                </Text>
              </View>
            )}
          </View>

          {/* Statistics */}
          {stats && (
            <View className="flex-row gap-3">
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Results</Text>
                <Text className="text-2xl font-bold text-foreground">{stats.total_count}</Text>
              </View>
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Net Amount</Text>
                <Text
                  style={{ color: stats.net_amount >= 0 ? colors.success : colors.error }}
                  className="text-2xl font-bold"
                >
                  ${Math.abs(stats.net_amount).toFixed(0)}
                </Text>
              </View>
            </View>
          )}

          {/* Results */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">
              {results.length} Transactions
            </Text>
            
            {results.length > 0 ? (
              results.map((tx) => (
                <View
                  key={tx.id}
                  style={{ backgroundColor: colors.surface }}
                  className="rounded-xl p-4 border border-border"
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-foreground">
                        {tx.description}
                      </Text>
                      <Text className="text-sm text-muted">
                        {tx.merchant || tx.category} • {new Date(tx.date).toLocaleDateString()}
                      </Text>
                    </View>
                    
                    <View className="items-end">
                      <Text
                        style={{
                          color: tx.type === "income" ? colors.success : colors.foreground,
                        }}
                        className="text-lg font-bold"
                      >
                        {tx.type === "income" ? "+" : ""}${Math.abs(tx.amount).toFixed(2)}
                      </Text>
                      <View
                        style={{
                          backgroundColor:
                            tx.status === "completed"
                              ? colors.success + "20"
                              : colors.warning + "20",
                        }}
                        className="px-2 py-0.5 rounded-full"
                      >
                        <Text
                          style={{
                            color: tx.status === "completed" ? colors.success : colors.warning,
                          }}
                          className="text-xs font-semibold"
                        >
                          {tx.status}
                        </Text>
                      </View>
                    </View>
                  </View>
                  
                  <View className="flex-row items-center gap-2">
                    <View
                      style={{ backgroundColor: colors.primary + "20" }}
                      className="px-2 py-1 rounded-full"
                    >
                      <Text
                        style={{ color: colors.primary }}
                        className="text-xs font-semibold"
                      >
                        {tx.category}
                      </Text>
                    </View>
                    <View
                      style={{
                        backgroundColor:
                          tx.type === "income" ? colors.success + "20" : colors.error + "20",
                      }}
                      className="px-2 py-1 rounded-full"
                    >
                      <Text
                        style={{
                          color: tx.type === "income" ? colors.success : colors.error,
                        }}
                        className="text-xs font-semibold"
                      >
                        {tx.type}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <View className="items-center py-12">
                <Text className="text-6xl mb-4">🔍</Text>
                <Text className="text-lg font-semibold text-foreground mb-2">
                  No Results Found
                </Text>
                <Text className="text-sm text-muted text-center">
                  Try adjusting your search or filters
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
