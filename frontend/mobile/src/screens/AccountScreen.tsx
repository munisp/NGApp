import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { colors, spacing, fontSize, borderRadius } from "../styles/theme";

export default function AccountScreen() {
  const navigation = useNavigation();

  const handleBiometric = () => {
    Alert.alert("Biometric Auth", "Face ID / Fingerprint authentication would be configured here");
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive" },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Account</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>AT</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>Alex Trader</Text>
            <Text style={styles.profileEmail}>trader@nexcom.exchange</Text>
            <View style={styles.tierBadge}>
              <Text style={styles.tierText}>RETAIL TRADER</Text>
            </View>
          </View>
        </View>

        {/* Account Status */}
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Account Status</Text>
          <StatusRow label="KYC Verified" value="Verified" positive />
          <StatusRow label="Email Verified" value="Yes" positive />
          <StatusRow label="Phone Verified" value="Yes" positive />
          <StatusRow label="2FA Enabled" value="No" positive={false} />
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Settings</Text>
          <MenuItem label="Notification Preferences" icon="🔔" onPress={() => (navigation as any).navigate("Notifications")} />
          <MenuItem label="Biometric Authentication" icon="🔐" onPress={handleBiometric} />
          <MenuItem label="Display & Language" icon="🌐" />
          <MenuItem label="Default Currency" icon="💱" subtitle="USD" />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Security</Text>
          <MenuItem label="Change Password" icon="🔑" />
          <MenuItem label="Two-Factor Authentication" icon="🛡" />
          <MenuItem label="Active Sessions" icon="📱" subtitle="2 devices" />
          <MenuItem label="API Keys" icon="⚙️" />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Support</Text>
          <MenuItem label="Help Center" icon="❓" />
          <MenuItem label="Contact Support" icon="💬" />
          <MenuItem label="Terms & Conditions" icon="📄" />
          <MenuItem label="Privacy Policy" icon="🔒" />
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>NEXCOM Exchange v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusRow({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return (
    <View style={statusStyles.row}>
      <Text style={statusStyles.label}>{label}</Text>
      <View style={[statusStyles.badge, positive ? statusStyles.badgePositive : statusStyles.badgeNegative]}>
        <Text style={[statusStyles.badgeText, positive ? statusStyles.textPositive : statusStyles.textNegative]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function MenuItem({ label, icon, subtitle, onPress }: {
  label: string;
  icon: string;
  subtitle?: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={menuStyles.item} onPress={onPress}>
      <View style={menuStyles.left}>
        <Text style={menuStyles.icon}>{icon}</Text>
        <Text style={menuStyles.label}>{label}</Text>
      </View>
      <View style={menuStyles.right}>
        {subtitle && <Text style={menuStyles.subtitle}>{subtitle}</Text>}
        <Text style={menuStyles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text.primary },
  profileCard: { flexDirection: "row", alignItems: "center", marginHorizontal: spacing.xl, marginTop: spacing.xl, backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brand.primary, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: fontSize.xl, fontWeight: "700", color: colors.white },
  profileInfo: { marginLeft: spacing.lg },
  profileName: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary },
  profileEmail: { fontSize: fontSize.sm, color: colors.text.muted, marginTop: 2 },
  tierBadge: { marginTop: spacing.sm, backgroundColor: colors.brand.subtle, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2, alignSelf: "flex-start" },
  tierText: { fontSize: fontSize.xs, fontWeight: "700", color: colors.brand.primary },
  statusCard: { marginHorizontal: spacing.xl, marginTop: spacing.lg, backgroundColor: colors.bg.card, borderRadius: borderRadius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  statusTitle: { fontSize: fontSize.md, fontWeight: "700", color: colors.text.primary, marginBottom: spacing.md },
  menuSection: { marginTop: spacing.xxl, paddingHorizontal: spacing.xl },
  menuSectionTitle: { fontSize: fontSize.xs, fontWeight: "600", color: colors.text.muted, textTransform: "uppercase", marginBottom: spacing.sm, marginLeft: spacing.xs },
  logoutButton: { marginHorizontal: spacing.xl, marginTop: spacing.xxxl, backgroundColor: "rgba(239, 68, 68, 0.15)", borderRadius: borderRadius.md, paddingVertical: spacing.lg, alignItems: "center" },
  logoutText: { fontSize: fontSize.md, fontWeight: "600", color: colors.down },
  version: { textAlign: "center", fontSize: fontSize.xs, color: colors.text.muted, marginTop: spacing.xl, marginBottom: spacing.xxxl },
});

const statusStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm },
  label: { fontSize: fontSize.sm, color: colors.text.secondary },
  badge: { borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgePositive: { backgroundColor: "rgba(34, 197, 94, 0.15)" },
  badgeNegative: { backgroundColor: "rgba(239, 68, 68, 0.15)" },
  badgeText: { fontSize: fontSize.xs, fontWeight: "600" },
  textPositive: { color: colors.up },
  textNegative: { color: colors.down },
});

const menuStyles = StyleSheet.create({
  item: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.bg.card, borderRadius: borderRadius.md, padding: spacing.lg, marginBottom: 1, borderWidth: 1, borderColor: colors.border },
  left: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  icon: { fontSize: 20 },
  label: { fontSize: fontSize.md, color: colors.text.primary },
  right: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  subtitle: { fontSize: fontSize.sm, color: colors.text.muted },
  chevron: { fontSize: 20, color: colors.text.muted },
});
