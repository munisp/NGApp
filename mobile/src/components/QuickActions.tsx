import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";

interface Action {
  label: string;
  icon: string;
  onPress: () => void;
}

interface Props {
  actions: Action[];
}

export function QuickActions({ actions }: Props) {
  return (
    <View style={styles.container}>
      {actions.map((action) => (
        <TouchableOpacity key={action.label} style={styles.action} onPress={action.onPress}>
          <View style={styles.iconContainer}>
            <Feather name={action.icon as any} size={20} color="#10b981" />
          </View>
          <Text style={styles.label}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, marginTop: 20 },
  action: { alignItems: "center", gap: 6 },
  iconContainer: { width: 48, height: 48, borderRadius: 12, backgroundColor: "#064e3b", justifyContent: "center", alignItems: "center" },
  label: { color: "#9ca3af", fontSize: 11 },
});
