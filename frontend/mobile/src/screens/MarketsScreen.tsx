import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { colors, spacing, fontSize, borderRadius } from "../styles/theme";
import { useMarkets } from "../hooks/useApi";
import Icon from "../components/Icon";
import type { IconName } from "../components/Icon";

type Category = "all" | "agricultural" | "precious_metals" | "energy" | "carbon_credits";

const SYMBOL_ICONS: Record<string, IconName> = {
  MAIZE: "wheat", WHEAT: "wheat", COFFEE: "coffee", COCOA: "coffee",
  SOYBEAN: "leaf", GOLD: "gem", SILVER: "gem",
  CRUDE_OIL: "droplet", NAT_GAS: "flame", CARBON: "leaf",
};

const SYMBOL_COLORS: Record<string, string> = {
  MAIZE: "#F59E0B", WHEAT: "#D97706", COFFEE: "#92400E", COCOA: "#78350F",
  SOYBEAN: "#059669", GOLD: "#EAB308", SILVER: "#94A3B8",
  CRUDE_OIL: "#3B82F6", NAT_GAS: "#EF4444", CARBON: "#10B981",
};

const FALLBACK_COMMODITIES = [
  { symbol: "MAIZE", name: "Maize (Corn)", category: "agricultural" as const, price: 285.5, change: 1.15, vol: "45.2K" },
  { symbol: "WHEAT", name: "Wheat", category: "agricultural" as const, price: 342.75, change: -0.72, vol: "32.1K" },
  { symbol: "COFFEE", name: "Coffee Arabica", category: "agricultural" as const, price: 4520.0, change: 1.01, vol: "18.9K" },
  { symbol: "COCOA", name: "Cocoa", category: "agricultural" as const, price: 3890.0, change: -0.38, vol: "12.4K" },
  { symbol: "SOYBEAN", name: "Soybeans", category: "agricultural" as const, price: 465.5, change: 1.25, vol: "28.7K" },
  { symbol: "GOLD", name: "Gold", category: "precious_metals" as const, price: 2345.6, change: 0.53, vol: "89.2K" },
  { symbol: "SILVER", name: "Silver", category: "precious_metals" as const, price: 28.45, change: -1.11, vol: "54.3K" },
  { symbol: "CRUDE_OIL", name: "Crude Oil (WTI)", category: "energy" as const, price: 78.42, change: 1.59, vol: "125.8K" },
  { symbol: "NAT_GAS", name: "Natural Gas", category: "energy" as const, price: 2.845, change: -2.23, vol: "67.4K" },
  { symbol: "CARBON", name: "Carbon Credits", category: "carbon_credits" as const, price: 65.2, change: 1.32, vol: "15.6K" },
];

const CATEGORY_MAP: Record<string, Category> = {
  Agricultural: "agricultural",
  Metals: "precious_metals",
  Energy: "energy",
  Carbon: "carbon_credits",
};

const CATEGORY_ICONS: Record<Category, IconName> = {
  all: "layers",
  agricultural: "wheat",
  precious_metals: "gem",
  energy: "flame",
  carbon_credits: "leaf",
};

const categories: { key: Category; label: string }[] = [
  { key: "all", label: "All" },
  { key: "agricultural", label: "Agri" },
  { key: "precious_metals", label: "Metals" },
  { key: "energy", label: "Energy" },
  { key: "carbon_credits", label: "Carbon" },
];

export default function MarketsScreen() {
  const navigation = useNavigation();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const { data: marketsData } = useMarkets();

  // Map API data to display format, fall back to hardcoded data
  const commodities = useMemo(() => {
    const apiCommodities = (marketsData as any)?.commodities;
    if (apiCommodities && apiCommodities.length > 0) {
      return apiCommodities.map((c: any) => ({
        symbol: c.symbol,
        name: c.name,
        category: CATEGORY_MAP[c.category] || "agricultural",
        price: c.lastPrice,
        change: c.changePercent24h,
        vol: c.volume24h > 1000 ? `${(c.volume24h / 1000).toFixed(1)}K` : String(c.volume24h),
      }));
    }
    return FALLBACK_COMMODITIES;
  }, [marketsData]);

  const filtered = commodities
    .filter((c: any) => category === "all" || c.category === category)
    .filter((c: any) =>
      c.symbol.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Markets</Text>
          <Text style={styles.subtitle}>{filtered.length} commodities</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerButton}>
            <Icon name="star" size={20} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={18} color={colors.text.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search commodities..."
          placeholderTextColor={colors.text.muted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Icon name="x" size={16} color={colors.text.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categories}
        contentContainerStyle={styles.categoriesContent}
      >
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            style={[styles.categoryPill, category === cat.key && styles.categoryActive]}
            onPress={() => setCategory(cat.key)}
            activeOpacity={0.7}
          >
            <Icon
              name={CATEGORY_ICONS[cat.key]}
              size={14}
              color={category === cat.key ? colors.brand.primary : colors.text.muted}
            />
            <Text style={[styles.categoryText, category === cat.key && styles.categoryTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Commodity List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.symbol}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const iconName = SYMBOL_ICONS[item.symbol] || "circle-dot";
          const iconColor = SYMBOL_COLORS[item.symbol] || colors.text.muted;
          return (
            <TouchableOpacity
              style={styles.commodityRow}
              activeOpacity={0.7}
              onPress={() => (navigation as any).navigate("TradeDetail", { symbol: item.symbol })}
            >
              <View style={styles.commodityLeft}>
                <View style={[styles.commodityIconBg, { backgroundColor: iconColor + "18" }]}>
                  <Icon name={iconName} size={18} color={iconColor} />
                </View>
                <View>
                  <Text style={styles.commoditySymbol}>{item.symbol}</Text>
                  <Text style={styles.commodityName}>{item.name}</Text>
                </View>
              </View>
              <View style={styles.commodityRight}>
                <Text style={styles.commodityPrice}>${item.price.toLocaleString()}</Text>
                <View style={[styles.changeBadge, { backgroundColor: item.change >= 0 ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)" }]}>
                  <Icon
                    name={item.change >= 0 ? "trending-up" : "trending-down"}
                    size={10}
                    color={item.change >= 0 ? colors.up : colors.down}
                  />
                  <Text style={[styles.commodityChange, { color: item.change >= 0 ? colors.up : colors.down }]}>
                    {item.change >= 0 ? "+" : ""}{item.change.toFixed(2)}%
                  </Text>
                </View>
              </View>
              <Icon name="chevron-right" size={16} color={colors.text.muted} />
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  headerRight: { flexDirection: "row", gap: spacing.sm },
  headerButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bg.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text.primary },
  subtitle: { fontSize: fontSize.sm, color: colors.text.muted, marginTop: 2 },
  searchContainer: { flexDirection: "row", alignItems: "center", marginHorizontal: spacing.xl, marginTop: spacing.lg, backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, gap: spacing.sm },
  searchInput: { flex: 1, height: 46, color: colors.text.primary, fontSize: fontSize.md },
  categories: { marginTop: spacing.lg },
  categoriesContent: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  categoryPill: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border },
  categoryActive: { backgroundColor: colors.brand.subtle, borderColor: colors.brand.primary },
  categoryText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text.muted },
  categoryTextActive: { color: colors.brand.primary },
  listContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: 100 },
  commodityRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  commodityLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 },
  commodityIconBg: { width: 42, height: 42, borderRadius: borderRadius.md, alignItems: "center", justifyContent: "center" },
  commoditySymbol: { fontSize: fontSize.md, fontWeight: "700", color: colors.text.primary },
  commodityName: { fontSize: fontSize.xs, color: colors.text.muted, marginTop: 1 },
  commodityRight: { alignItems: "flex-end", marginRight: spacing.sm },
  commodityPrice: { fontSize: fontSize.md, fontWeight: "700", color: colors.text.primary, fontVariant: ["tabular-nums"] },
  changeBadge: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: borderRadius.xs, paddingHorizontal: spacing.xs, paddingVertical: 2, marginTop: 3 },
  commodityChange: { fontSize: fontSize.xs, fontWeight: "700" },
});
