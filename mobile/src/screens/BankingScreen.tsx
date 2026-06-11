import React from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

export function BankingScreen() {
  const { data: transactions = [], isLoading, refetch } = useQuery({
    queryKey: ["banking-transactions"],
    queryFn: () => api.getBankingTransactions(),
    staleTime: 30_000,
  });
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "#10b981";
      case "pending_edd": case "pending": return "#f59e0b";
      case "flagged": case "rejected": return "#ef4444";
      default: return "#6b7280";
    }
  };

  const formatAmount = (n: number, currency?: string) => `${currency === "USD" ? "$" : "₦"}${(n || 0).toLocaleString()}`;

  if (isLoading) return <View style={s.container}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}>
      <Text style={s.title}>Banking & Payments</Text>
      <Text style={s.subtitle}>NIP/RTGS Monitoring — CBN AML Compliance</Text>

      <View style={s.stats}>
        <View style={s.statCard}><Text style={s.statNum}>{transactions.length}</Text><Text style={s.statLabel}>Transactions</Text></View>
        <View style={s.statCard}><Text style={[s.statNum, { color: "#10b981" }]}>{transactions.filter((t: any) => t.status === "completed").length}</Text><Text style={s.statLabel}>Completed</Text></View>
      </View>

      {transactions.map((tx: any) => (
        <View key={tx.id} style={s.card}>
          <View style={s.cardHeader}>
            <View>
              <Text style={s.cardTitle}>{tx.transaction_type ?? tx.transactionType ?? "TX"} #{tx.id}</Text>
              <Text style={s.cardAmount}>{formatAmount(tx.amount, tx.currency)}</Text>
            </View>
            <View style={[s.badge, { backgroundColor: getStatusColor(tx.status) + "20" }]}>
              <Text style={[s.badgeText, { color: getStatusColor(tx.status) }]}>{(tx.status ?? "unknown").replace(/_/g, " ")}</Text>
            </View>
          </View>
        </View>
      ))}
      {transactions.length === 0 && <Text style={s.empty}>No transactions found</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a", padding: 16 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#9ca3af", fontSize: 14, marginBottom: 16 },
  stats: { flexDirection: "row", gap: 12, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: "#111827", borderRadius: 8, padding: 12, alignItems: "center" },
  statNum: { color: "#fff", fontSize: 16, fontWeight: "700" },
  statLabel: { color: "#9ca3af", fontSize: 11 },
  card: { backgroundColor: "#111827", borderRadius: 8, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  cardTitle: { color: "#fff", fontSize: 14, fontWeight: "600" },
  cardAmount: { color: "#10b981", fontSize: 18, fontWeight: "700", marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  empty: { color: "#6b7280", textAlign: "center", marginTop: 32 },
});
