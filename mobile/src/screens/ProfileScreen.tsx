import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../services/api";

export function ProfileScreen() {
  const { data: authData } = useQuery({
    queryKey: ["auth-verify"],
    queryFn: async () => { try { const r = await fetch(`${process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000"}/api/v2/auth/verify`, { headers: { Authorization: `Bearer ${await (api as any).token}` } }); return r.ok ? r.json() : null; } catch { return null; } },
    staleTime: 60_000,
  });
  const logoutMutation = useMutation({ mutationFn: () => api.logout(), onSuccess: () => Alert.alert("Logged Out") });
  const user = (authData as any)?.user;

  return (
    <ScrollView style={s.container}>
      <Text style={s.title}>Profile</Text>
      <View style={s.card}>
        <View style={s.avatar}><Text style={s.avatarText}>{(user?.email ?? "U")[0].toUpperCase()}</Text></View>
        <Text style={s.name}>{user?.displayName ?? user?.email ?? "NDSEP User"}</Text>
        <Text style={s.role}>{user?.role ?? "user"}</Text>
      </View>
      <View style={s.card}>
        <Text style={s.label}>Email</Text><Text style={s.value}>{user?.email ?? "—"}</Text>
        <Text style={s.label}>Role</Text><Text style={s.value}>{user?.role ?? "—"}</Text>
        <Text style={s.label}>User ID</Text><Text style={s.value}>{user?.id ?? "—"}</Text>
      </View>
      <TouchableOpacity style={s.logoutBtn} onPress={() => logoutMutation.mutate()}>
        <Text style={s.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a", padding: 16 },
  title: { color: "#fff", fontSize: 24, fontWeight: "700", marginBottom: 16 },
  card: { backgroundColor: "#111827", borderRadius: 8, padding: 16, marginBottom: 16, alignItems: "center" },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#3b82f6", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  avatarText: { color: "#fff", fontSize: 28, fontWeight: "700" },
  name: { color: "#fff", fontSize: 18, fontWeight: "600" },
  role: { color: "#9ca3af", fontSize: 14, textTransform: "capitalize" },
  label: { color: "#9ca3af", fontSize: 12, marginTop: 12, alignSelf: "flex-start" },
  value: { color: "#fff", fontSize: 16, alignSelf: "flex-start" },
  logoutBtn: { backgroundColor: "#ef4444", borderRadius: 8, padding: 14, alignItems: "center" },
  logoutText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
