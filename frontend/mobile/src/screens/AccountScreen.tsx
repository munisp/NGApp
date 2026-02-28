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
import { colors, spacing, fontSize, borderRadius, shadows } from "../styles/theme";
import Icon from "../components/Icon";
import type { IconName } from "../components/Icon";

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

  const statusItems: { label: string; value: string; positive: boolean; icon: IconName }[] = [
    { label: "KYC Verified", value: "Verified", positive: true, icon: "shield" },
    { label: "Email Verified", value: "Yes", positive: true, icon: "mail" },
    { label: "Phone Verified", value: "Yes", positive: true, icon: "phone" },
    { label: "2FA Enabled", value: "No", positive: false, icon: "lock" },
  ];

  const settingsMenu: { label: string; icon: IconName; color: string; bg: string; subtitle?: string; onPress?: () => void }[] = [
    { label: "Notification Preferences", icon: "bell", color: colors.warning, bg: "rgba(245, 158, 11, 0.12)", onPress: () => (navigation as any).navigate("Notifications") },
    { label: "Biometric Authentication", icon: "fingerprint", color: colors.purple, bg: "rgba(139, 92, 246, 0.12)", onPress: handleBiometric },
    { label: "Display & Language", icon: "globe", color: colors.info, bg: "rgba(59, 130, 246, 0.12)" },
    { label: "Default Currency", icon: "credit-card", color: colors.brand.primary, bg: "rgba(16, 185, 129, 0.12)", subtitle: "USD" },
  ];

  const securityMenu: { label: string; icon: IconName; color: string; bg: string; subtitle?: string }[] = [
    { label: "Change Password", icon: "key", color: colors.warning, bg: "rgba(245, 158, 11, 0.12)" },
    { label: "Two-Factor Authentication", icon: "shield", color: colors.brand.primary, bg: "rgba(16, 185, 129, 0.12)" },
    { label: "Active Sessions", icon: "phone", color: colors.info, bg: "rgba(59, 130, 246, 0.12)", subtitle: "2 devices" },
    { label: "API Keys", icon: "settings", color: colors.text.secondary, bg: "rgba(148, 163, 184, 0.12)" },
  ];

  const supportMenu: { label: string; icon: IconName; color: string; bg: string }[] = [
    { label: "Help Center", icon: "help-circle", color: colors.info, bg: "rgba(59, 130, 246, 0.12)" },
    { label: "Contact Support", icon: "message", color: colors.brand.primary, bg: "rgba(16, 185, 129, 0.12)" },
    { label: "Terms & Conditions", icon: "receipt", color: colors.text.secondary, bg: "rgba(148, 163, 184, 0.12)" },
    { label: "Privacy Policy", icon: "lock", color: colors.purple, bg: "rgba(139, 92, 246, 0.12)" },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Account</Text>
          <TouchableOpacity style={styles.headerButton}>
            <Icon name="settings" size={20} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>AT</Text>
            </View>
            <View style={styles.avatarBadge}>
              <Icon name="check" size={10} color={colors.white} />
            </View>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>Alex Trader</Text>
            <Text style={styles.profileEmail}>trader@nexcom.exchange</Text>
            <View style={styles.tierBadge}>
              <Icon name="star" size={10} color={colors.brand.primary} />
              <Text style={styles.tierText}>RETAIL TRADER</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.editButton}>
            <Icon name="edit" size={16} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Account Status */}
        <View style={styles.statusCard}>
          <View style={styles.statusTitleRow}>
            <Icon name="shield" size={16} color={colors.brand.primary} />
            <Text style={styles.statusTitle}>Account Status</Text>
          </View>
          {statusItems.map((item) => (
            <View key={item.label} style={statusStyles.row}>
              <View style={statusStyles.labelRow}>
                <Icon name={item.icon} size={14} color={colors.text.muted} />
                <Text style={statusStyles.label}>{item.label}</Text>
              </View>
              <View style={[statusStyles.badge, item.positive ? statusStyles.badgePositive : statusStyles.badgeNegative]}>
                {item.positive && <Icon name="check" size={10} color={colors.up} />}
                <Text style={[statusStyles.badgeText, item.positive ? statusStyles.textPositive : statusStyles.textNegative]}>
                  {item.value}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Settings */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Settings</Text>
          {settingsMenu.map((item) => (
            <MenuItem key={item.label} {...item} />
          ))}
        </View>

        {/* Security */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Security</Text>
          {securityMenu.map((item) => (
            <MenuItem key={item.label} {...item} />
          ))}
        </View>

        {/* Support */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Support</Text>
          {supportMenu.map((item) => (
            <MenuItem key={item.label} {...item} />
          ))}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
          <Icon name="log-out" size={18} color={colors.down} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>NEXCOM Exchange v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({ label, icon, color, bg, subtitle, onPress }: {
  label: string;
  icon: IconName;
  color: string;
  bg: string;
  subtitle?: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={menuStyles.item} onPress={onPress} activeOpacity={0.7}>
      <View style={menuStyles.left}>
        <View style={[menuStyles.iconBg, { backgroundColor: bg }]}>
          <Icon name={icon} size={16} color={color} />
        </View>
        <Text style={menuStyles.label}>{label}</Text>
      </View>
      <View style={menuStyles.right}>
        {subtitle && <Text style={menuStyles.subtitle}>{subtitle}</Text>}
        <Icon name="chevron-right" size={16} color={colors.text.muted} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  headerButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bg.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text.primary },
  profileCard: { flexDirection: "row", alignItems: "center", marginHorizontal: spacing.xl, marginTop: spacing.xl, backgroundColor: colors.bg.card, borderRadius: borderRadius.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, ...shadows.md },
  avatarContainer: { position: "relative" },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brand.primary, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: fontSize.xl, fontWeight: "800", color: colors.white },
  avatarBadge: { position: "absolute", bottom: -2, right: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.up, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.bg.card },
  profileInfo: { flex: 1, marginLeft: spacing.lg },
  profileName: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary },
  profileEmail: { fontSize: fontSize.sm, color: colors.text.muted, marginTop: 2 },
  tierBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: spacing.sm, backgroundColor: colors.brand.subtle, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3, alignSelf: "flex-start" },
  tierText: { fontSize: fontSize.xs, fontWeight: "700", color: colors.brand.primary },
  editButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bg.elevated, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  statusCard: { marginHorizontal: spacing.xl, marginTop: spacing.lg, backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  statusTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  statusTitle: { fontSize: fontSize.md, fontWeight: "700", color: colors.text.primary },
  menuSection: { marginTop: spacing.xxl, paddingHorizontal: spacing.xl },
  menuSectionTitle: { fontSize: fontSize.xs, fontWeight: "700", color: colors.text.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: spacing.sm, marginLeft: spacing.xs },
  logoutButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginHorizontal: spacing.xl, marginTop: spacing.xxxl, backgroundColor: "rgba(239, 68, 68, 0.10)", borderRadius: borderRadius.lg, paddingVertical: spacing.lg, borderWidth: 1, borderColor: "rgba(239, 68, 68, 0.15)" },
  logoutText: { fontSize: fontSize.md, fontWeight: "700", color: colors.down },
  version: { textAlign: "center", fontSize: fontSize.xs, color: colors.text.muted, marginTop: spacing.xl, marginBottom: spacing.xxxl },
});

const statusStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm },
  labelRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  label: { fontSize: fontSize.sm, color: colors.text.secondary },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  badgePositive: { backgroundColor: "rgba(16, 185, 129, 0.12)" },
  badgeNegative: { backgroundColor: "rgba(239, 68, 68, 0.12)" },
  badgeText: { fontSize: fontSize.xs, fontWeight: "700" },
  textPositive: { color: colors.up },
  textNegative: { color: colors.down },
});

const menuStyles = StyleSheet.create({
  item: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.xs, borderWidth: 1, borderColor: colors.border },
  left: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconBg: { width: 36, height: 36, borderRadius: borderRadius.sm, alignItems: "center", justifyContent: "center" },
  label: { fontSize: fontSize.md, color: colors.text.primary, fontWeight: "500" },
  right: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  subtitle: { fontSize: fontSize.sm, color: colors.text.muted },
});
