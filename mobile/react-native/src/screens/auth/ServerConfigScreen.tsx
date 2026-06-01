import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOW } from "../../utils/theme";
import { getBaseUrl, setBaseUrl } from "../../utils/config";

export default function ServerConfigScreen() {
  const navigation = useNavigation<any>();
  const [url, setUrl] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    getBaseUrl().then(setUrl);
  }, []);

  async function testAndSave() {
    if (!url.trim()) { Alert.alert("Validation", "Server URL is required"); return; }
    setTesting(true);
    try {
      const res = await fetch(`${url.trim()}/api/health`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await setBaseUrl(url.trim());
      Alert.alert("Success", "Server URL saved successfully", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert("Connection Failed", `Could not reach server: ${err.message}\n\nSave anyway?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Save Anyway", onPress: async () => { await setBaseUrl(url.trim()); navigation.goBack(); } },
      ]);
    } finally {
      setTesting(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={[styles.card, SHADOW.md]}>
        <Icon name="server-network" size={32} color={COLORS.primary} style={{ marginBottom: SPACING.md }} />
        <Text style={styles.title}>Server Configuration</Text>
        <Text style={styles.subtitle}>Enter the base URL of your OG-RMM deployment.</Text>
        <Text style={styles.label}>Server URL</Text>
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={setUrl}
          placeholder="https://your-og-rmm.example.com"
          placeholderTextColor={COLORS.textMuted}
          autoCapitalize="none"
          keyboardType="url"
        />
        <TouchableOpacity style={styles.saveBtn} onPress={testAndSave} disabled={testing}>
          {testing ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Test & Save</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, justifyContent: "center", padding: SPACING.xl },
  card: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl },
  title: { fontSize: FONT_SIZE.xl, fontWeight: "700", color: COLORS.text, marginBottom: SPACING.sm },
  subtitle: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginBottom: SPACING.lg },
  label: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginBottom: 4 },
  input: { backgroundColor: COLORS.background, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, color: COLORS.text, fontSize: FONT_SIZE.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, alignItems: "center" },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: FONT_SIZE.md },
});
