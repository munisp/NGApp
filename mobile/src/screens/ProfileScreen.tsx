import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";

export function ProfileScreen() {
  return (
    <ScrollView style={s.container}>
      <View style={s.header}>
        <View style={s.avatar}><Text style={s.avatarText}>DA</Text></View>
        <Text style={s.name}>Demo Admin</Text>
        <Text style={s.role}>Platform Administrator</Text>
      </View>
      <View style={s.card}>
        <Text style={s.label}>Email</Text><Text style={s.value}>admin@ndsep.gov.ng</Text>
        <Text style={s.label}>Organization</Text><Text style={s.value}>NDPC — National Data Protection Commission</Text>
        <Text style={s.label}>Role</Text><Text style={s.value}>admin</Text>
        <Text style={s.label}>Member Since</Text><Text style={s.value}>January 2024</Text>
        <Text style={s.label}>Last Login</Text><Text style={s.value}>{new Date().toLocaleString()}</Text>
      </View>
      <TouchableOpacity style={s.logoutBtn}><Text style={s.logoutText}>Sign Out</Text></TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  header: { padding: 20, alignItems: "center" },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#10b981", justifyContent: "center", alignItems: "center" },
  avatarText: { color: "#fff", fontSize: 28, fontWeight: "700" },
  name: { color: "#fff", fontSize: 22, fontWeight: "700", marginTop: 12 },
  role: { color: "#9ca3af", fontSize: 14, marginTop: 4 },
  card: { backgroundColor: "#111827", borderRadius: 12, padding: 16, marginHorizontal: 16, marginBottom: 12 },
  label: { color: "#6b7280", fontSize: 12, marginTop: 12 },
  value: { color: "#e5e7eb", fontSize: 15, fontWeight: "500" },
  logoutBtn: { backgroundColor: "#dc2626", borderRadius: 8, padding: 14, marginHorizontal: 16, marginTop: 20, alignItems: "center" },
  logoutText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
