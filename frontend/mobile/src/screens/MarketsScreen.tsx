import React, { useState } from "react";
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

type Category = "all" | "agricultural" | "precious_metals" | "energy" | "carbon_credits";

const commodities = [
  { symbol: "MAIZE", name: "Maize (Corn)", category: "agricultural" as const, price: 285.5, change: 1.15, vol: "45.2K", icon: "🌾" },
  { symbol: "WHEAT", name: "Wheat", category: "agricultural" as const, price: 342.75, change: -0.72, vol: "32.1K", icon: "🌾" },
  { symbol: "COFFEE", name: "Coffee Arabica", category: "agricultural" as const, price: 4520.0, change: 1.01, vol: "18.9K", icon: "☕" },
  { symbol: "COCOA", name: "Cocoa", category: "agricultural" as const, price: 3890.0, change: -0.38, vol: "12.4K", icon: "🍫" },
  { symbol: "SOYBEAN", name: "Soybeans", category: "agricultural" as const, price: 465.5, change: 1.25, vol: "28.7K", icon: "🌱" },
  { symbol: "GOLD", name: "Gold", category: "precious_metals" as const, price: 2345.6, change: 0.53, vol: "89.2K", icon: "🥇" },
  { symbol: "SILVER", name: "Silver", category: "precious_metals" as const, price: 28.45, change: -1.11, vol: "54.3K", icon: "🥈" },
  { symbol: "CRUDE_OIL", name: "Crude Oil (WTI)", category: "energy" as const, price: 78.42, change: 1.59, vol: "125.8K", icon: "🛢" },
  { symbol: "NAT_GAS", name: "Natural Gas", category: "energy" as const, price: 2.845, change: -2.23, vol: "67.4K", icon: "🔥" },
  { symbol: "CARBON", name: "Carbon Credits", category: "carbon_credits" as const, price: 65.2, change: 1.32, vol: "15.6K", icon: "🌿" },
];

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

  const filtered = commodities
    .filter((c) => category === "all" || c.category === category)
    .filter((c) =>
      c.symbol.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Markets</Text>
        <Text style={styles.subtitle}>{filtered.length} commodities</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search commodities..."
          placeholderTextColor={colors.text.muted}
          value={search}
          onChangeText={setSearch}
        />
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
          >
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
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.commodityRow}
            onPress={() => (navigation as any).navigate("TradeDetail", { symbol: item.symbol })}
          >
            <View style={styles.commodityLeft}>
              <Text style={styles.commodityIcon}>{item.icon}</Text>
              <View>
                <Text style={styles.commoditySymbol}>{item.symbol}</Text>
                <Text style={styles.commodityName}>{item.name}</Text>
              </View>
            </View>
            <View style={styles.commodityRight}>
              <Text style={styles.commodityPrice}>${item.price.toLocaleString()}</Text>
              <Text style={[styles.commodityChange, { color: item.change >= 0 ? colors.up : colors.down }]}>
                {item.change >= 0 ? "+" : ""}{item.change.toFixed(2)}%
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text.primary },
  subtitle: { fontSize: fontSize.sm, color: colors.text.muted, marginTop: 2 },
  searchContainer: { flexDirection: "row", alignItems: "center", marginHorizontal: spacing.xl, marginTop: spacing.lg, backgroundColor: colors.bg.card, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md },
  searchIcon: { fontSize: 16, marginRight: spacing.sm },
  searchInput: { flex: 1, height: 44, color: colors.text.primary, fontSize: fontSize.md },
  categories: { marginTop: spacing.lg },
  categoriesContent: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  categoryPill: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border },
  categoryActive: { backgroundColor: colors.brand.subtle, borderColor: colors.brand.primary },
  categoryText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text.muted },
  categoryTextActive: { color: colors.brand.primary },
  listContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: 100 },
  commodityRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.bg.card, borderRadius: borderRadius.md, padding: spacing.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  commodityLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  commodityIcon: { fontSize: 28 },
  commoditySymbol: { fontSize: fontSize.md, fontWeight: "700", color: colors.text.primary },
  commodityName: { fontSize: fontSize.xs, color: colors.text.muted, marginTop: 1 },
  commodityRight: { alignItems: "flex-end" },
  commodityPrice: { fontSize: fontSize.md, fontWeight: "600", color: colors.text.primary, fontVariant: ["tabular-nums"] },
  commodityChange: { fontSize: fontSize.sm, fontWeight: "600", marginTop: 2 },
});
