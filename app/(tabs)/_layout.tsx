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

interface SidebarNavItem {
  title: string;
  href: string;
  icon: string;
  section: string;
}

const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  { title: "Home", href: "/", icon: "house.fill", section: "Main" },
  { title: "Dashboard", href: "/dashboard", icon: "chevron.left.forwardslash.chevron.right", section: "Main" },
  { title: "Profile", href: "/profile", icon: "person.fill", section: "Main" },
  { title: "Settings", href: "/settings", icon: "gear", section: "Main" },

  { title: "Accounts", href: "/accounts", icon: "creditcard.fill", section: "Core Banking" },
  { title: "Account Mgmt", href: "/account-management", icon: "building.columns.fill", section: "Core Banking" },
  { title: "Transactions", href: "/transactions", icon: "doc.text.fill", section: "Core Banking" },
  { title: "Cards", href: "/(cards)", icon: "creditcard.fill", section: "Core Banking" },
  { title: "Family Accounts", href: "/(family-accounts)", icon: "person.2.fill", section: "Core Banking" },
  { title: "Joint Accounts", href: "/(joint)", icon: "person.2.fill", section: "Core Banking" },
  { title: "Net Worth", href: "/(net-worth)", icon: "chart.line.uptrend.xyaxis", section: "Core Banking" },
  { title: "Digital Identity", href: "/(digital-identity)", icon: "person.text.rectangle", section: "Core Banking" },
  { title: "Estate Vault", href: "/(estate-vault)", icon: "lock.shield.fill", section: "Core Banking" },
  { title: "Open Banking", href: "/open-banking", icon: "building.columns.fill", section: "Core Banking" },

  { title: "Payments", href: "/payments", icon: "arrow.left.arrow.right.circle.fill", section: "Payments & Transfers" },
  { title: "Send Money", href: "/(payment)/send", icon: "paperplane.fill", section: "Payments & Transfers" },
  { title: "QR Payments", href: "/(qr-payments-enhanced)", icon: "qrcode", section: "Payments & Transfers" },
  { title: "Bill Splitting", href: "/(split-bill-enhanced)", icon: "rectangle.split.3x1.fill", section: "Payments & Transfers" },
  { title: "Payment Requests", href: "/(payment-requests)", icon: "arrow.down.circle.fill", section: "Payments & Transfers" },
  { title: "Remittance Credit", href: "/(remittance-credit)", icon: "globe", section: "Payments & Transfers" },
  { title: "Currency Exchange", href: "/(currency)", icon: "coloncurrencysign.circle.fill", section: "Payments & Transfers" },
  { title: "Scheduled", href: "/(schedule)", icon: "clock.fill", section: "Payments & Transfers" },
  { title: "Bill Reminders", href: "/bill-reminders", icon: "calendar", section: "Payments & Transfers" },
  { title: "Bills", href: "/(bills)", icon: "doc.text.fill", section: "Payments & Transfers" },

  { title: "KYC Verification", href: "/(profile)/kyc", icon: "checkmark.shield.fill", section: "KYC / KYB" },
  { title: "Video Liveness", href: "/(profile)/kyc-video-liveness", icon: "video.fill", section: "KYC / KYB" },
  { title: "KYC Status", href: "/(profile)/kyc-status", icon: "doc.badge.checkmark", section: "KYC / KYB" },
  { title: "KYB Verification", href: "/(kyb-verification)", icon: "building.2.fill", section: "KYC / KYB" },
  { title: "KYC Admin", href: "/admin-kyc", icon: "checkmark.shield.fill", section: "KYC / KYB" },
  { title: "Admin BNPL", href: "/admin-bnpl", icon: "doc.badge.gearshape.fill", section: "KYC / KYB" },

  { title: "BNPL", href: "/bnpl", icon: "creditcard.fill", section: "Lending & Credit" },
  { title: "BNPL Checkout", href: "/bnpl-checkout", icon: "cart.fill", section: "Lending & Credit" },
  { title: "Credit Score", href: "/credit-score", icon: "chart.bar.fill", section: "Lending & Credit" },
  { title: "Score Dashboard", href: "/credit-score-dashboard", icon: "chart.line.uptrend.xyaxis", section: "Lending & Credit" },
  { title: "P2P Lending", href: "/(p2p-lending)", icon: "person.2.fill", section: "Lending & Credit" },
  { title: "Lending Circles", href: "/(lending-circles)", icon: "circle.grid.3x3.fill", section: "Lending & Credit" },
  { title: "School Fees", href: "/(school-fees)", icon: "graduationcap.fill", section: "Lending & Credit" },
  { title: "Rent Now Pay Later", href: "/(rent-now-pay-later)", icon: "house.fill", section: "Lending & Credit" },
  { title: "Debt Payoff", href: "/(debt-payoff)", icon: "arrow.down.right.circle.fill", section: "Lending & Credit" },

  { title: "Savings Goals", href: "/savings-goals", icon: "star.fill", section: "Savings & Investments" },
  { title: "Trading", href: "/(trading)", icon: "chart.line.uptrend.xyaxis", section: "Savings & Investments" },
  { title: "Portfolio", href: "/(portfolio-analytics)", icon: "chart.pie.fill", section: "Savings & Investments" },
  { title: "Robo-Advisor", href: "/(robo-advisor)/questionnaire", icon: "brain", section: "Savings & Investments" },
  { title: "Wealth", href: "/(wealth)", icon: "banknote.fill", section: "Savings & Investments" },
  { title: "Retirement", href: "/(retirement)", icon: "figure.walk", section: "Savings & Investments" },
  { title: "Savings Circles", href: "/(savings-circles)", icon: "circle.grid.3x3.fill", section: "Savings & Investments" },
  { title: "Savings Roundup", href: "/(savings-roundup)", icon: "arrow.up.circle.fill", section: "Savings & Investments" },
  { title: "Crypto Wallet", href: "/(crypto-wallet)", icon: "bitcoinsign.circle.fill", section: "Savings & Investments" },
  { title: "Gamified Goals", href: "/(gamified-goals)", icon: "gamecontroller.fill", section: "Savings & Investments" },

  { title: "Budgets", href: "/budgets", icon: "chart.bar.fill", section: "Budgeting & Expenses" },
  { title: "Budget Analytics", href: "/budget-analytics", icon: "chart.bar.fill", section: "Budgeting & Expenses" },
  { title: "Budget Insights", href: "/budget-insights", icon: "chart.bar.fill", section: "Budgeting & Expenses" },
  { title: "Recommendations", href: "/budget-recommendations", icon: "lightbulb.fill", section: "Budgeting & Expenses" },
  { title: "Categories", href: "/expense-categories", icon: "folder.fill", section: "Budgeting & Expenses" },
  { title: "Spending Alerts", href: "/spending-alerts", icon: "bell.fill", section: "Budgeting & Expenses" },
  { title: "Expense Forecast", href: "/(expense-forecast)", icon: "chart.line.uptrend.xyaxis", section: "Budgeting & Expenses" },
  { title: "Subscriptions", href: "/(subscription-manager)", icon: "repeat.circle.fill", section: "Budgeting & Expenses" },
  { title: "Bill Negotiation", href: "/(bill-negotiation)", icon: "bubble.left.and.bubble.right.fill", section: "Budgeting & Expenses" },

  { title: "Insurance", href: "/(insurance-enhanced)", icon: "shield.fill", section: "Insurance & Health" },
  { title: "Health Installment", href: "/(health-installment)", icon: "cross.case.fill", section: "Insurance & Health" },
  { title: "Agric Insurance", href: "/(agricultural-insurance)", icon: "leaf.fill", section: "Insurance & Health" },
  { title: "Health Score", href: "/(health-score)", icon: "heart.text.square.fill", section: "Insurance & Health" },
  { title: "Wellness", href: "/(wellness-score)", icon: "figure.walk", section: "Insurance & Health" },
  { title: "Financial Health", href: "/financial-health", icon: "heart.circle.fill", section: "Insurance & Health" },

  { title: "Tax Planning", href: "/(tax)", icon: "doc.text.fill", section: "Tax & Financial Planning" },
  { title: "Tax Optimization", href: "/(tax-optimization)", icon: "arrow.up.forward.circle.fill", section: "Tax & Financial Planning" },
  { title: "Tax Export", href: "/(tax-export)", icon: "square.and.arrow.up.fill", section: "Tax & Financial Planning" },
  { title: "Financial Advisor", href: "/(advisor)", icon: "person.fill.questionmark", section: "Tax & Financial Planning" },
  { title: "Advisor Matching", href: "/(advisor-matching)", icon: "person.2.wave.2.fill", section: "Tax & Financial Planning" },

  { title: "Mobile Money", href: "/(p2p)", icon: "iphone", section: "African Markets" },
  { title: "Community Fund", href: "/(community-fund)", icon: "person.3.fill", section: "African Markets" },
  { title: "Airtime Collateral", href: "/(airtime-collateral)", icon: "phone.fill", section: "African Markets" },
  { title: "Land Tokenization", href: "/(land-tokenization)", icon: "map.fill", section: "African Markets" },
  { title: "Forward Selling", href: "/(forward-selling)", icon: "leaf.fill", section: "African Markets" },
  { title: "Livestock Registry", href: "/(livestock-registry)", icon: "hare.fill", section: "African Markets" },
  { title: "Solar ATM", href: "/(solar-atm)", icon: "sun.max.fill", section: "African Markets" },
  { title: "Disaster Relief", href: "/(disaster-relief)", icon: "exclamationmark.triangle.fill", section: "African Markets" },
  { title: "Transport Fare", href: "/(transport-fare)", icon: "bus.fill", section: "African Markets" },
  { title: "Water Service", href: "/(water-service)", icon: "drop.fill", section: "African Markets" },
  { title: "Utility Arbitrage", href: "/(utility-arbitrage)", icon: "bolt.fill", section: "African Markets" },
  { title: "Micro Royalties", href: "/(micro-royalties)", icon: "music.note", section: "African Markets" },

  { title: "Fraud Radar", href: "/fraud-dashboard", icon: "shield.lefthalf.filled", section: "Fraud Detection" },
  { title: "Fraud Scoring", href: "/fraud-scoring", icon: "gauge.with.dots.needle.bottom.50percent", section: "Fraud Detection" },
  { title: "Rules Engine", href: "/fraud-rules", icon: "list.bullet.rectangle.fill", section: "Fraud Detection" },
  { title: "Risk Insights", href: "/fraud-insights", icon: "lightbulb.max.fill", section: "Fraud Detection" },
  { title: "Investigation", href: "/fraud-investigation", icon: "magnifyingglass.circle.fill", section: "Fraud Detection" },
  { title: "Model Retraining", href: "/fraud-retraining", icon: "arrow.triangle.2.circlepath", section: "Fraud Detection" },

  { title: "Merchant Portal", href: "/(merchant)", icon: "storefront.fill", section: "Merchant & Business" },
  { title: "Gateway Settings", href: "/(payment-gateway-settings)", icon: "gearshape.2.fill", section: "Merchant & Business" },
  { title: "Cashback", href: "/(cashback)", icon: "arrow.counterclockwise.circle.fill", section: "Merchant & Business" },

  { title: "Insights", href: "/insights", icon: "lightbulb.fill", section: "AI & Analytics" },
  { title: "Insights Dashboard", href: "/(insights)", icon: "chart.bar.fill", section: "AI & Analytics" },
  { title: "Analytics", href: "/(analytics)", icon: "chart.xyaxis.line", section: "AI & Analytics" },
  { title: "Predictive Alerts", href: "/(predictive-alerts)", icon: "bell.badge.fill", section: "AI & Analytics" },
  { title: "Smart Notifications", href: "/(smart-notifications)", icon: "bell.badge.waveform.fill", section: "AI & Analytics" },
  { title: "Challenges", href: "/challenges", icon: "star.fill", section: "AI & Analytics" },
  { title: "Spending Challenges", href: "/(spending-challenges)", icon: "flag.fill", section: "AI & Analytics" },
  { title: "Challenges Hub", href: "/(challenges)", icon: "trophy.fill", section: "AI & Analytics" },
  { title: "Voice Commands", href: "/(voice)", icon: "mic.fill", section: "AI & Analytics" },
  { title: "Loyalty Rewards", href: "/(loyalty)", icon: "gift.fill", section: "AI & Analytics" },
  { title: "Financial News", href: "/(news)", icon: "newspaper.fill", section: "AI & Analytics" },
  { title: "Investment News", href: "/(investment-news)", icon: "newspaper.fill", section: "AI & Analytics" },
  { title: "Referral Program", href: "/(referral)", icon: "person.badge.plus", section: "AI & Analytics" },
  { title: "Referral Rewards", href: "/(referral-rewards-enhanced)", icon: "gift.circle.fill", section: "AI & Analytics" },
  { title: "Financial Literacy", href: "/(financial-literacy)", icon: "book.fill", section: "AI & Analytics" },
  { title: "Education", href: "/(education)", icon: "graduationcap.fill", section: "AI & Analytics" },

  { title: "Account Details", href: "/(account)/list", icon: "list.bullet", section: "Core Banking" },
  { title: "Account Number", href: "/(accounts)/account-number", icon: "number.circle.fill", section: "Core Banking" },
  { title: "Family Banking", href: "/(family)", icon: "figure.2.and.child.holdinghands", section: "Core Banking" },
  { title: "QR Scan", href: "/(qr)/scan", icon: "qrcode.viewfinder", section: "Payments & Transfers" },
  { title: "Bill Split", href: "/(bill-splitting)", icon: "rectangle.split.2x1.fill", section: "Payments & Transfers" },
  { title: "Split Expenses", href: "/(split)", icon: "divide.circle.fill", section: "Payments & Transfers" },
  { title: "Recurring Payments", href: "/(recurring)", icon: "arrow.clockwise.circle.fill", section: "Payments & Transfers" },
  { title: "Templates", href: "/(templates)", icon: "doc.on.doc.fill", section: "Payments & Transfers" },
  { title: "Bill Reminders Hub", href: "/(bill-reminders)", icon: "bell.circle.fill", section: "Payments & Transfers" },
  { title: "Receipts", href: "/(receipts)", icon: "doc.text.image.fill", section: "Payments & Transfers" },
  { title: "KYC Enhanced", href: "/(kyc-enhanced)", icon: "checkmark.seal.fill", section: "KYC / KYB" },
  { title: "KYC Resubmit", href: "/(kyc-resubmit)", icon: "arrow.uturn.forward.circle.fill", section: "KYC / KYB" },
  { title: "KYC Review", href: "/(admin-kyc-review)", icon: "doc.text.magnifyingglass", section: "KYC / KYB" },
  { title: "Credit Details", href: "/(credit)", icon: "chart.bar.doc.horizontal.fill", section: "Lending & Credit" },
  { title: "Credit Score Alt", href: "/(credit-score)", icon: "gauge.medium", section: "Lending & Credit" },
  { title: "Loans", href: "/(loans)", icon: "banknote.fill", section: "Lending & Credit" },
  { title: "Savings Hub", href: "/(savings)", icon: "banknote.fill", section: "Savings & Investments" },
  { title: "Goals", href: "/(goals)", icon: "target", section: "Savings & Investments" },
  { title: "Investments", href: "/(investments)", icon: "chart.line.uptrend.xyaxis.circle.fill", section: "Savings & Investments" },
  { title: "Portfolio Enhanced", href: "/(portfolio-enhanced)", icon: "chart.pie.fill", section: "Savings & Investments" },
  { title: "Budget Detail", href: "/(budget)", icon: "chart.bar.fill", section: "Budgeting & Expenses" },
  { title: "Budget Alerts", href: "/(budget-alerts)", icon: "bell.badge.fill", section: "Budgeting & Expenses" },
  { title: "Expense Categories", href: "/(expense-categories)", icon: "tag.fill", section: "Budgeting & Expenses" },
  { title: "Categories Mgmt", href: "/(categories)", icon: "tray.full.fill", section: "Budgeting & Expenses" },
  { title: "Spending Limits", href: "/(spending-limits)", icon: "exclamationmark.circle.fill", section: "Budgeting & Expenses" },
  { title: "Subscriptions Alt", href: "/(subscriptions)", icon: "repeat.circle.fill", section: "Budgeting & Expenses" },
  { title: "Insurance Hub", href: "/(insurance)", icon: "shield.lefthalf.filled", section: "Insurance & Health" },
  { title: "Health Dashboard", href: "/(health-dashboard)", icon: "heart.text.square.fill", section: "Insurance & Health" },
  { title: "Wellness Hub", href: "/(wellness)", icon: "leaf.circle.fill", section: "Insurance & Health" },
  { title: "Calendar", href: "/(calendar)", icon: "calendar", section: "Tools & Utilities" },
  { title: "Calendar Widget", href: "/(calendar-widget)", icon: "calendar.badge.clock", section: "Tools & Utilities" },
  { title: "Notifications", href: "/(notifications)/center", icon: "bell.fill", section: "Tools & Utilities" },
  { title: "System Notifications", href: "/(notifications-system)", icon: "bell.badge.fill", section: "Tools & Utilities" },
  { title: "Quick Actions", href: "/(quick-actions)", icon: "bolt.circle.fill", section: "Tools & Utilities" },
  { title: "Transaction Search", href: "/(transaction-search)", icon: "magnifyingglass", section: "Tools & Utilities" },
  { title: "Reports", href: "/(reports)", icon: "doc.richtext.fill", section: "Tools & Utilities" },
  { title: "Export Data", href: "/(export)", icon: "square.and.arrow.up.fill", section: "Tools & Utilities" },
  { title: "App Settings", href: "/(settings)", icon: "gearshape.fill", section: "Tools & Utilities" },

  { title: "Fraud Monitor", href: "/(admin)/fraud-monitor-live", icon: "shield.lefthalf.filled", section: "Admin" },
  { title: "Fraud Analytics", href: "/(admin)/fraud-analytics", icon: "chart.bar.xaxis", section: "Admin" },
  { title: "Fraud Patterns", href: "/(admin)/fraud-patterns", icon: "magnifyingglass.circle.fill", section: "Admin" },
  { title: "Developer", href: "/developer", icon: "chevron.left.forwardslash.chevron.right", section: "Admin" },
];

const NAV_ITEMS: NavItem[] = SIDEBAR_NAV_ITEMS.map((item, idx) => ({
  name: `nav-${idx}`,
  title: item.title,
  href: item.href,
  icon: item.icon,
  section: item.section,
}));

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
      <Tabs.Screen name="payments" options={{ title: "Payments", tabBarIcon: ({ color }) => <IconSymbol size={28} name="arrow.left.arrow.right.circle.fill" color={color} /> }} />
      <Tabs.Screen name="budgets" options={{ title: "Budget", tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.bar.fill" color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} /> }} />
      <Tabs.Screen name="dashboard" options={{ href: null }} />
      <Tabs.Screen name="admin-kyc" options={{ href: null }} />
      <Tabs.Screen name="admin-bnpl" options={{ href: null }} />
      <Tabs.Screen name="bnpl" options={{ href: null }} />
      <Tabs.Screen name="bnpl-checkout" options={{ href: null }} />
      <Tabs.Screen name="open-banking" options={{ href: null }} />
      <Tabs.Screen name="credit-score" options={{ href: null }} />
      <Tabs.Screen name="credit-score-dashboard" options={{ href: null }} />
      <Tabs.Screen name="developer" options={{ href: null }} />
      <Tabs.Screen name="transactions" options={{ href: null }} />
      <Tabs.Screen name="account-management" options={{ href: null }} />
      <Tabs.Screen name="insights" options={{ href: null }} />
      <Tabs.Screen name="budget-analytics" options={{ href: null }} />
      <Tabs.Screen name="savings-goals" options={{ href: null }} />
      <Tabs.Screen name="challenges" options={{ href: null }} />
      <Tabs.Screen name="financial-health" options={{ href: null }} />
      <Tabs.Screen name="budget-insights" options={{ href: null }} />
      <Tabs.Screen name="spending-alerts" options={{ href: null }} />
      <Tabs.Screen name="budget-recommendations" options={{ href: null }} />
      <Tabs.Screen name="expense-categories" options={{ href: null }} />
      <Tabs.Screen name="bill-reminders" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}

export default function TabLayout() {
  if (Platform.OS === "web") {
    return <WebSidebarLayout />;
  }
  return <MobileTabLayout />;
}
