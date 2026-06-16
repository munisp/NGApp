import React from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity, TextInput, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";

export function DSARScreen() {
  const queryClient = useQueryClient();
  const { data: dsars = [], isLoading, refetch } = useQuery({
    queryKey: ["dsar-list"],
    queryFn: () => api.getDSARList(),
    staleTime: 30_000,
  });
  const [refreshing, setRefreshing] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [subjectName, setSubjectName] = React.useState("");
  const [details, setDetails] = React.useState("");

  const onRefresh = React.useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);

  const submitMutation = useMutation({
    mutationFn: () => api.submitDSAR({ subjectName, requestType: "access", organizationId: "1", details }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["dsar-list"] }); setShowForm(false); setSubjectName(""); setDetails(""); Alert.alert("Success", "DSAR submitted"); },
  });

  const getStatusColor = (s: string) => { switch (s) { case "completed": return "#10b981"; case "pending": return "#f59e0b"; case "overdue": return "#ef4444"; default: return "#6b7280"; } };

  if (isLoading) return <View style={s.container}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}>
      <Text style={s.title}>DSAR Requests</Text>
      <Text style={s.subtitle}>Data Subject Access Requests — NDPA Art. 35</Text>
      <TouchableOpacity style={s.btn} onPress={() => setShowForm(!showForm)}><Text style={s.btnText}>{showForm ? "Cancel" : "New DSAR"}</Text></TouchableOpacity>
      {showForm && (
        <View style={s.form}>
          <TextInput style={s.input} placeholder="Subject Name" placeholderTextColor="#6b7280" value={subjectName} onChangeText={setSubjectName} />
          <TextInput style={[s.input, { height: 80 }]} placeholder="Details" placeholderTextColor="#6b7280" value={details} onChangeText={setDetails} multiline />
          <TouchableOpacity style={[s.btn, { backgroundColor: "#3b82f6" }]} onPress={() => submitMutation.mutate()}><Text style={s.btnText}>Submit</Text></TouchableOpacity>
        </View>
      )}
      {(dsars as any[]).map((d: any) => (
        <View key={d.id} style={s.card}>
          <View style={s.row}><Text style={s.cardTitle}>{d.citizen_name ?? d.citizenName ?? `Request #${d.id}`}</Text><Text style={[s.status, { color: getStatusColor(d.status) }]}>{d.status}</Text></View>
          <Text style={s.meta}>Type: {d.request_type ?? d.requestType ?? "access"}</Text>
        </View>
      ))}
      {dsars.length === 0 && <Text style={s.empty}>No DSAR requests found</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a", padding: 16 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#9ca3af", fontSize: 14, marginBottom: 16 },
  card: { backgroundColor: "#111827", borderRadius: 8, padding: 16, marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "600" },
  status: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  meta: { color: "#9ca3af", fontSize: 12, marginTop: 8 },
  empty: { color: "#6b7280", textAlign: "center", marginTop: 32 },
  btn: { backgroundColor: "#1f2937", borderRadius: 8, padding: 12, alignItems: "center", marginBottom: 16 },
  btnText: { color: "#fff", fontWeight: "600" },
  form: { marginBottom: 16 },
  input: { backgroundColor: "#111827", color: "#fff", borderRadius: 8, padding: 12, marginBottom: 8 },
});
