import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, fontSize, borderRadius } from "../styles/theme";
import { useStakeholderTypes } from "../hooks/useApi";
import Icon from "../components/Icon";
import type { IconName } from "../components/Icon";

const CATEGORY_ICONS: Record<string, IconName> = {
  trading_finance: "briefcase",
  agriculture: "wheat",
  mining_metals: "gem",
  energy: "flame",
  infrastructure: "package",
  commodity_finance: "dollar",
};

const CATEGORY_COLORS: Record<string, string> = {
  trading_finance: colors.info,
  agriculture: colors.up,
  mining_metals: "#94A3B8",
  energy: colors.warning,
  infrastructure: colors.purple,
  commodity_finance: "#EAB308",
};

const CATEGORY_LABELS: Record<string, string> = {
  trading_finance: "Trading & Finance",
  agriculture: "Agriculture",
  mining_metals: "Mining & Metals",
  energy: "Energy",
  infrastructure: "Infrastructure",
  commodity_finance: "Commodity Finance",
};

interface StakeholderType {
  id: string;
  name: string;
  category: string;
  description: string;
  kyb_required: boolean;
  estimated_time: string;
  simplified_kyc?: boolean;
}

export default function OnboardingScreen() {
  const { data, loading } = useStakeholderTypes();
  const types: StakeholderType[] = ((data as Record<string, unknown>)?.types ?? data ?? []) as StakeholderType[];
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.brand.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  const categories = [...new Set(types.map((t) => t.category))];
  const filtered = selectedCategory ? types.filter((t) => t.category === selectedCategory) : types;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Onboarding</Text>
          <Text style={styles.subtitle}>Choose your stakeholder type to begin</Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Types</Text>
            <Text style={styles.summaryValue}>{types.length}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Categories</Text>
            <Text style={styles.summaryValue}>{categories.length}</Text>
          </View>
        </View>

        {/* Category Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
          <TouchableOpacity
            style={[styles.filterChip, !selectedCategory && styles.filterChipActive]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={[styles.filterChipText, !selectedCategory && styles.filterChipTextActive]}>All</Text>
          </TouchableOpacity>
          {categories.map((cat) => {
            const iconName = CATEGORY_ICONS[cat] || "layers";
            const color = CATEGORY_COLORS[cat] || colors.text.muted;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.filterChip, selectedCategory === cat && styles.filterChipActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Icon name={iconName} size={14} color={selectedCategory === cat ? colors.white : color} />
                <Text style={[styles.filterChipText, selectedCategory === cat && styles.filterChipTextActive]}>
                  {CATEGORY_LABELS[cat] || cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Stakeholder Types */}
        {filtered.map((type) => {
          const catColor = CATEGORY_COLORS[type.category] || colors.text.muted;
          const catIcon = CATEGORY_ICONS[type.category] || "layers";
          return (
            <TouchableOpacity key={type.id} style={styles.card} activeOpacity={0.7}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconBg, { backgroundColor: catColor + "20" }]}>
                  <Icon name={catIcon} size={18} color={catColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.typeName}>{type.name}</Text>
                  <Text style={styles.typeDesc} numberOfLines={2}>{type.description}</Text>
                </View>
                <Icon name="chevron-right" size={18} color={colors.text.muted} />
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Icon name="clock" size={12} color={colors.text.muted} />
                  <Text style={styles.metaText}>{type.estimated_time}</Text>
                </View>
                {type.kyb_required && (
                  <View style={[styles.metaBadge, { backgroundColor: colors.warning + "20" }]}>
                    <Text style={[styles.metaBadgeText, { color: colors.warning }]}>KYB Required</Text>
                  </View>
                )}
                {type.simplified_kyc && (
                  <View style={[styles.metaBadge, { backgroundColor: colors.up + "20" }]}>
                    <Text style={[styles.metaBadgeText, { color: colors.up }]}>Simplified</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text.primary },
  subtitle: { fontSize: fontSize.sm, color: colors.text.muted, marginTop: 2 },
  summaryRow: { flexDirection: "row", paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.sm },
  summaryCard: { flex: 1, backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  summaryLabel: { fontSize: fontSize.xs, color: colors.text.muted },
  summaryValue: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary, marginTop: 4 },
  filterScroll: { marginTop: spacing.lg },
  filterContent: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  filterChip: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
  filterChipText: { fontSize: fontSize.xs, fontWeight: "600", color: colors.text.secondary },
  filterChipTextActive: { color: colors.white },
  card: { marginHorizontal: spacing.xl, marginTop: spacing.md, backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconBg: { width: 42, height: 42, borderRadius: borderRadius.md, alignItems: "center", justifyContent: "center" },
  typeName: { fontSize: fontSize.md, fontWeight: "700", color: colors.text.primary },
  typeDesc: { fontSize: fontSize.xs, color: colors.text.muted, marginTop: 2, lineHeight: 16 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  metaItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  metaText: { fontSize: fontSize.xs, color: colors.text.muted },
  metaBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.full },
  metaBadgeText: { fontSize: fontSize.xs, fontWeight: "700" },
});
