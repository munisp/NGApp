/**
 * LoginScreen — OAuth login for the React Native app.
 * Opens the Manus OAuth portal in an in-app browser, then
 * exchanges the returned code for a session token.
 */
import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Linking, Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOW } from "../../utils/theme";
import { getBaseUrl, setAuthToken } from "../../utils/config";
import { trpc } from "../../api/trpc";

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    try {
      const baseUrl = await getBaseUrl();
      const loginUrl = `${baseUrl}/api/oauth/login?redirect=${encodeURIComponent(`${baseUrl}/api/oauth/callback`)}`;
      await Linking.openURL(loginUrl);
    } catch (err) {
      Alert.alert("Login Error", "Could not open login page. Check your server URL in Settings.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Logo / Brand */}
      <View style={styles.brand}>
        <View style={styles.logoCircle}>
          <Icon name="oil" size={40} color={COLORS.primary} />
        </View>
        <Text style={styles.appName}>OG-RMM</Text>
        <Text style={styles.tagline}>Oil & Gas Remote Monitoring</Text>
      </View>

      {/* Login card */}
      <View style={[styles.card, SHADOW.md]}>
        <Text style={styles.cardTitle}>Sign In</Text>
        <Text style={styles.cardSubtitle}>
          Use your organisation credentials to access the platform.
        </Text>

        <TouchableOpacity
          style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Icon name="login" size={20} color="#fff" />
              <Text style={styles.loginBtnText}>Sign in with Manus OAuth</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.configBtn}
          onPress={() => navigation.navigate("ServerConfig")}
        >
          <Icon name="server-network" size={16} color={COLORS.textSecondary} />
          <Text style={styles.configBtnText}>Configure server URL</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>v1.0.0 · OG-RMM Platform</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, justifyContent: "center", padding: SPACING.xl },
  brand: { alignItems: "center", marginBottom: SPACING.xxl },
  logoCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary + "20", justifyContent: "center", alignItems: "center", marginBottom: SPACING.md },
  appName: { fontSize: 32, fontWeight: "800", color: COLORS.text, letterSpacing: 2 },
  tagline: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginTop: 4 },
  card: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, gap: SPACING.md },
  cardTitle: { fontSize: FONT_SIZE.xxl, fontWeight: "700", color: COLORS.text },
  cardSubtitle: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, lineHeight: 22 },
  loginBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm, backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.lg, paddingVertical: SPACING.md },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: "#fff", fontSize: FONT_SIZE.md, fontWeight: "700" },
  configBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm, paddingVertical: SPACING.sm },
  configBtnText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  footer: { textAlign: "center", color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: SPACING.xl },
});
