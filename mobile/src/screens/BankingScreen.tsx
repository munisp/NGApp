import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";

interface Transaction {
  id: number;
  type: string;
  amount: number;
  status: string;
  channel: string;
  reference: string;
  amlFlag: string | null;
}

export function BankingScreen() {
  const [transactions] = React.useState<Transaction[]>([
    { id: 1, type: "NIP", amount: 2500000, status: "completed", channel: "Mobile", reference: "NIP-2026-001", amlFlag: null },
    { id: 2, type: "RTGS", amount: 150000000, status: "pending_edd", channel: "Corporate", reference: "RTGS-2026-002", amlFlag: "EDD Required (>₦100M)" },
    { id: 3, type: "NIP", amount: 4800000, status: "flagged", channel: "Internet", reference: "NIP-2026-003", amlFlag: "Structuring Pattern" },
    { id: 4, type: "NIP", amount: 850000, status: "completed", channel: "USSD", reference: "NIP-2026-004", amlFlag: null },
    { id: 5, type: "RTGS", amount: 75000000, status: "completed", channel: "Corporate", reference: "RTGS-2026-005", amlFlag: null },
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "#10b981";
      case "pending_edd": return "#f59e0b";
      case "flagged": return "#ef4444";
      default: return "#6b7280";
    }
  };

  const formatAmount = (n: number) => "₦" + n.toLocaleString();

  return (
    <ScrollView style={s.container}>
      <Text style={s.title}>Banking & Payments</Text>
      <Text style={s.subtitle}>NIP/RTGS Monitoring — CBN AML Compliance</Text>

      <View style={s.stats}>
        <View style={s.statCard}><Text style={s.statNum}>{transactions.length}</Text><Text style={s.statLabel}>Transactions</Text></View>
        <View style={s.statCard}><Text style={[s.statNum, { color: "#ef4444" }]}>{transactions.filter(t => t.amlFlag).length}</Text><Text style={s.statLabel}>AML Flags</Text></View>
        <View style={s.statCard}><Text style={[s.statNum, { color: "#10b981" }]}>{formatAmount(transactions.reduce((a, t) => a + t.amount, 0))}</Text><Text style={s.statLabel}>Volume</Text></View>
      </View>

      {transactions.map(tx => (
        <View key={tx.id} style={[s.card, tx.amlFlag ? s.cardFlagged : null]}>
          <View style={s.cardHeader}>
            <View>
              <Text style={s.cardTitle}>{tx.type} — {tx.reference}</Text>
              <Text style={s.cardAmount}>{formatAmount(tx.amount)}</Text>
            </View>
            <View style={[s.badge, { backgroundColor: getStatusColor(tx.status) + "20" }]}>
              <Text style={[s.badgeText, { color: getStatusColor(tx.status) }]}>{tx.status.replace("_", " ")}</Text>
            </View>
          </View>
          <Text style={s.cardMeta}>Channel: {tx.channel}</Text>
          {tx.amlFlag && <Text style={s.amlFlag}>⚠ {tx.amlFlag}</Text>}
        </View>
      ))}
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
  cardFlagged: { borderLeftWidth: 3, borderLeftColor: "#ef4444" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  cardTitle: { color: "#fff", fontSize: 14, fontWeight: "600" },
  cardAmount: { color: "#10b981", fontSize: 18, fontWeight: "700", marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  cardMeta: { color: "#9ca3af", fontSize: 13, marginTop: 4 },
  amlFlag: { color: "#ef4444", fontSize: 12, fontWeight: "600", marginTop: 8 },
});
