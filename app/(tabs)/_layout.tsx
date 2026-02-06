import { Tabs, Slot, usePathname, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState, useEffect, useCallback } from "react";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Platform, View, Text, TouchableOpacity, ScrollView, useWindowDimensions } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { CommandPalette } from "@/components/command-palette";
import { ErrorBoundary } from "@/components/error-boundary";

interface NavItem {
  name: string;
  title: string;
  href: string;
  icon: string;
  section?: string;
}

const NAV_ITEMS: NavItem[] = [
  { name: "index", title: "Home", href: "/", icon: "house.fill", section: "Main" },
  { name: "dashboard", title: "Dashboard", href: "/dashboard", icon: "chevron.left.forwardslash.chevron.right", section: "Main" },
  { name: "accounts", title: "Accounts", href: "/accounts", icon: "creditcard.fill", section: "Finance" },
  { name: "payments", title: "Payments", href: "/payments", icon: "arrow.left.arrow.right.circle.fill", section: "Finance" },
  { name: "transactions", title: "Transactions", href: "/transactions", icon: "doc.text.fill", section: "Finance" },
  { name: "account-management", title: "Account Mgmt", href: "/account-management", icon: "building.columns.fill", section: "Finance" },
  { name: "budgets", title: "Budgets", href: "/budgets", icon: "chart.bar.fill", section: "Planning" },
  { name: "budget-analytics", title: "Analytics", href: "/budget-analytics", icon: "chart.bar.fill", section: "Planning" },
  { name: "budget-insights", title: "Budget Insights", href: "/budget-insights", icon: "chart.bar.fill", section: "Planning" },
  { name: "budget-recommendations", title: "Recommendations", href: "/budget-recommendations", icon: "lightbulb.fill", section: "Planning" },
  { name: "savings-goals", title: "Savings Goals", href: "/savings-goals", icon: "star.fill", section: "Planning" },
  { name: "expense-categories", title: "Categories", href: "/expense-categories", icon: "folder.fill", section: "Planning" },
  { name: "spending-alerts", title: "Spending Alerts", href: "/spending-alerts", icon: "bell.fill", section: "Planning" },
  { name: "bnpl", title: "BNPL", href: "/bnpl", icon: "creditcard.fill", section: "Services" },
  { name: "bnpl-checkout", title: "Checkout", href: "/bnpl-checkout", icon: "cart.fill", section: "Services" },
  { name: "credit-score", title: "Credit Score", href: "/credit-score", icon: "chart.bar.fill", section: "Services" },
  { name: "credit-score-dashboard", title: "Score Dashboard", href: "/credit-score-dashboard", icon: "chart.line.uptrend.xyaxis", section: "Services" },
  { name: "open-banking", title: "Open Banking", href: "/open-banking", icon: "building.columns.fill", section: "Services" },
  { name: "financial-health", title: "Financial Health", href: "/financial-health", icon: "heart.circle.fill", section: "Services" },
  { name: "challenges", title: "Challenges", href: "/challenges", icon: "star.fill", section: "Services" },
  { name: "bill-reminders", title: "Bill Reminders", href: "/bill-reminders", icon: "calendar", section: "Services" },
  { name: "insights", title: "Insights", href: "/insights", icon: "lightbulb.fill", section: "More" },
  { name: "profile", title: "Profile", href: "/profile", icon: "person.fill", section: "More" },
  { name: "admin-kyc", title: "KYC Admin", href: "/admin-kyc", icon: "checkmark.shield.fill", section: "More" },
  { name: "developer", title: "Developer", href: "/developer", icon: "chevron.left.forwardslash.chevron.right", section: "More" },
  { name: "settings", title: "Settings", href: "/settings", icon: "gear", section: "More" },
];

function WebSidebarLayout() {
  const colors = useColors();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const [collapsed, setCollapsed] = useState(false);
  const [commandPaletteVisible, setCommandPaletteVisible] = useState(false);

  const isTablet = width >= 768 && width < 1024;
  const sidebarWidth = collapsed ? 64 : 240;

  useEffect(() => {
    setCollapsed(isTablet);
  }, [isTablet]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteVisible(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/" || pathname === "";
    return pathname.startsWith(href);
  };

  const sections = NAV_ITEMS.reduce<Record<string, NavItem[]>>((acc, item) => {
    const section = item.section || "Other";
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {});

  return (
    <ErrorBoundary>
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: colors.background }}>
        <View
          style={{
            width: sidebarWidth,
            backgroundColor: colors.background,
            borderRightWidth: 1,
            borderRightColor: colors.border,
            paddingTop: 16,
          }}
        >
          <View style={{ paddingHorizontal: collapsed ? 12 : 20, paddingBottom: collapsed ? 12 : 20, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            {!collapsed && (
              <View>
                <Text style={{ fontSize: 18, fontWeight: "700", color: colors.tint }}>
                  African Fintech
                </Text>
                <Text style={{ fontSize: 11, color: colors.text, opacity: 0.5, marginTop: 2 }}>
                  Financial Platform
                </Text>
              </View>
            )}
            <TouchableOpacity
              onPress={() => setCollapsed(!collapsed)}
              style={{ padding: 6, borderRadius: 6, backgroundColor: colors.border + "44" }}
            >
              <IconSymbol size={16} name={collapsed ? "sidebar.right" : "sidebar.left"} color={colors.text + "88"} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => setCommandPaletteVisible(true)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              margin: collapsed ? 8 : 12,
              padding: collapsed ? 8 : 10,
              borderRadius: 8,
              backgroundColor: colors.border + "33",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <IconSymbol size={14} name="magnifyingglass" color={colors.text + "66"} />
            {!collapsed && (
              <>
                <Text style={{ marginLeft: 8, fontSize: 13, color: colors.text + "66", flex: 1 }}>
                  Search...
                </Text>
                <Text style={{ fontSize: 11, color: colors.text + "44", fontFamily: Platform.OS === "web" ? "monospace" : undefined }}>
                  Ctrl+K
                </Text>
              </>
            )}
          </TouchableOpacity>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {Object.entries(sections).map(([sectionName, items]) => (
              <View key={sectionName} style={{ paddingTop: 12 }}>
                {!collapsed && (
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "600",
                      color: colors.text,
                      opacity: 0.4,
                      paddingHorizontal: 20,
                      paddingBottom: 4,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    {sectionName}
                  </Text>
                )}
                {items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <TouchableOpacity
                      key={item.name}
                      onPress={() => router.push(item.href as any)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: collapsed ? "center" : "flex-start",
                        paddingVertical: 8,
                        paddingHorizontal: collapsed ? 0 : 20,
                        marginHorizontal: collapsed ? 4 : 8,
                        borderRadius: 8,
                        backgroundColor: active ? (colors.tint + "15") : "transparent",
                      }}
                    >
                      <IconSymbol
                        size={collapsed ? 20 : 18}
                        name={item.icon as any}
                        color={active ? colors.tint : (colors.text + "99")}
                      />
                      {!collapsed && (
                        <Text
                          style={{
                            marginLeft: 10,
                            fontSize: 13,
                            fontWeight: active ? "600" : "400",
                            color: active ? colors.tint : colors.text,
                          }}
                        >
                          {item.title}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>

        <View style={{ flex: 1, backgroundColor: colors.surface || "#f5f5f5" }}>
          <Slot />
        </View>

        <CommandPalette visible={commandPaletteVisible} onClose={() => setCommandPaletteVisible(false)} />
      </View>
    </ErrorBoundary>
  );
}

function MobileTabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} /> }} />
      <Tabs.Screen name="accounts" options={{ title: "Accounts", tabBarIcon: ({ color }) => <IconSymbol size={28} name="creditcard.fill" color={color} /> }} />
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard", tabBarIcon: ({ color }) => <IconSymbol size={28} name="chevron.left.forwardslash.chevron.right" color={color} /> }} />
      <Tabs.Screen name="payments" options={{ title: "Payments", tabBarIcon: ({ color }) => <IconSymbol size={28} name="arrow.left.arrow.right.circle.fill" color={color} /> }} />
      <Tabs.Screen name="admin-kyc" options={{ title: "KYC Admin", tabBarIcon: ({ color }) => <IconSymbol size={28} name="checkmark.shield.fill" color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} /> }} />
      <Tabs.Screen name="bnpl" options={{ title: "BNPL", tabBarIcon: ({ color }) => <IconSymbol size={28} name="creditcard.fill" color={color} /> }} />
      <Tabs.Screen name="bnpl-checkout" options={{ title: "Checkout", tabBarIcon: ({ color }) => <IconSymbol size={28} name="cart.fill" color={color} /> }} />
      <Tabs.Screen name="open-banking" options={{ title: "Banking", tabBarIcon: ({ color }) => <IconSymbol size={28} name="building.columns.fill" color={color} /> }} />
      <Tabs.Screen name="credit-score" options={{ title: "Credit", tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.bar.fill" color={color} /> }} />
      <Tabs.Screen name="credit-score-dashboard" options={{ title: "Score", tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.line.uptrend.xyaxis" color={color} /> }} />
      <Tabs.Screen name="developer" options={{ title: "Developer", tabBarIcon: ({ color }) => <IconSymbol size={28} name="chevron.left.forwardslash.chevron.right" color={color} /> }} />
      <Tabs.Screen name="transactions" options={{ title: "Transactions", tabBarIcon: ({ color }) => <IconSymbol size={28} name="doc.text.fill" color={color} /> }} />
      <Tabs.Screen name="account-management" options={{ title: "Accounts", tabBarIcon: ({ color }) => <IconSymbol size={28} name="building.columns.fill" color={color} /> }} />
      <Tabs.Screen name="insights" options={{ title: "Insights", tabBarIcon: ({ color }) => <IconSymbol size={28} name="lightbulb.fill" color={color} /> }} />
      <Tabs.Screen name="budgets" options={{ title: "Budgets", tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.bar.fill" color={color} /> }} />
      <Tabs.Screen name="budget-analytics" options={{ title: "Analytics", tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.bar.fill" color={color} /> }} />
      <Tabs.Screen name="savings-goals" options={{ title: "Savings", tabBarIcon: ({ color }) => <IconSymbol size={28} name="star.fill" color={color} /> }} />
      <Tabs.Screen name="challenges" options={{ title: "Challenges", tabBarIcon: ({ color }) => <IconSymbol size={28} name="star.fill" color={color} /> }} />
      <Tabs.Screen name="financial-health" options={{ title: "Health", tabBarIcon: ({ color }) => <IconSymbol size={28} name="heart.circle.fill" color={color} /> }} />
      <Tabs.Screen name="budget-insights" options={{ title: "Insights", tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.bar.fill" color={color} /> }} />
      <Tabs.Screen name="spending-alerts" options={{ title: "Alerts", tabBarIcon: ({ color }) => <IconSymbol size={28} name="bell.fill" color={color} /> }} />
      <Tabs.Screen name="budget-recommendations" options={{ title: "Recommendations", tabBarIcon: ({ color }) => <IconSymbol size={28} name="lightbulb.fill" color={color} /> }} />
      <Tabs.Screen name="expense-categories" options={{ title: "Categories", tabBarIcon: ({ color }) => <IconSymbol size={28} name="folder.fill" color={color} /> }} />
      <Tabs.Screen name="bill-reminders" options={{ title: "Bills", tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: ({ color }) => <IconSymbol size={28} name="gear" color={color} /> }} />
    </Tabs>
  );
}

export default function TabLayout() {
  if (Platform.OS === "web") {
    return <WebSidebarLayout />;
  }
  return <MobileTabLayout />;
}
