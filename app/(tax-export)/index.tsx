import { ScrollView, Text, View, Pressable, Alert, ActivityIndicator, TextInput } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:3000";

interface TaxAuthority {
  name: string;
  tin_label: string;
  currency: string;
  tax_year: string;
}

const COUNTRIES = [
  { id: "nigeria", name: "Nigeria", flag: "🇳🇬" },
  { id: "kenya", name: "Kenya", flag: "🇰🇪" },
  { id: "ghana", name: "Ghana", flag: "🇬🇭" },
  { id: "south_africa", name: "South Africa", flag: "🇿🇦" },
];

export default function TaxExportScreen() {
  const colors = useColors();
  const [selectedCountry, setSelectedCountry] = useState("nigeria");
  const [taxYear, setTaxYear] = useState(new Date().getFullYear().toString());
  const [taxpayerName, setTaxpayerName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [authorities, setAuthorities] = useState<Record<string, TaxAuthority>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadAuthorities();
    loadUserInfo();
  }, []);

  const loadAuthorities = async () => {
    try {
      const response = await axios.post(
        `${API_URL}/api/trpc/taxExport.getAuthorities`,
        {},
        { timeout: 5000 }
      );

      setAuthorities(response.data.result.data);
    } catch (error) {
      console.error("Failed to load tax authorities:", error);
    }
  };

  const loadUserInfo = async () => {
    try {
      const userJson = await AsyncStorage.getItem("user_profile");
      if (userJson) {
        const user = JSON.parse(userJson);
        setTaxpayerName(user.name || "");
      }
    } catch (error) {
      console.error("Failed to load user info:", error);
    }
  };

  const handleGenerateReport = async () => {
    if (!taxpayerName || !taxId) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    const year = parseInt(taxYear);
    if (isNaN(year) || year < 2000 || year > new Date().getFullYear()) {
      Alert.alert("Error", "Please enter a valid tax year");
      return;
    }

    setIsGenerating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Load transactions from AsyncStorage
      const transactionsJson = await AsyncStorage.getItem("transactions");
      const allTransactions = transactionsJson ? JSON.parse(transactionsJson) : [];

      // Filter transactions for the tax year
      const yearStart = new Date(year, 0, 1).getTime();
      const yearEnd = new Date(year, 11, 31, 23, 59, 59).getTime();

      const yearTransactions = allTransactions.filter(
        (t: any) => t.date >= yearStart && t.date <= yearEnd
      );

      if (yearTransactions.length === 0) {
        Alert.alert(
          "No Data",
          `No transactions found for ${year}. Please select a different year.`
        );
        setIsGenerating(false);
        return;
      }

      // Generate tax report
      const response = await axios.post(
        `${API_URL}/api/trpc/taxExport.generateReport`,
        {
          country: selectedCountry,
          tax_year: year,
          taxpayer_name: taxpayerName,
          tax_id: taxId,
          transactions: yearTransactions.map((t: any) => ({
            id: t.id,
            type: t.type === "debit" ? "debit" : "credit",
            amount: t.amount,
            category: t.category || "other",
            date: t.date,
            description: t.description || "",
          })),
        },
        { timeout: 15000 }
      );

      const report = response.data.result.data;

      // Save report as text file
      const fileName = `tax_report_${selectedCountry}_${year}.txt`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, report.formatted_text);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Share the file
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(filePath, {
          mimeType: "text/plain",
          dialogTitle: "Share Tax Report",
        });
      } else {
        Alert.alert(
          "Success",
          `Tax report generated successfully!\n\nSaved to: ${fileName}\n\nTotal Income: ${report.currency} ${report.income.total.toLocaleString()}\nEstimated Tax: ${report.currency} ${report.estimated_tax.toLocaleString()}`
        );
      }
    } catch (error: any) {
      console.error("Failed to generate tax report:", error);
      Alert.alert("Error", "Failed to generate tax report. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const currentAuthority = authorities[selectedCountry];

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View>
            <Text className="text-2xl font-bold text-foreground mb-2">
              Tax Document Export
            </Text>
            <Text className="text-sm text-muted">
              Generate country-specific tax reports for African tax authorities
            </Text>
          </View>

          {/* Country Selection */}
          <View>
            <Text className="text-base font-semibold text-foreground mb-3">
              Select Country *
            </Text>

            <View className="gap-3">
              {COUNTRIES.map((country) => (
                <Pressable
                  key={country.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedCountry(country.id);
                  }}
                  style={({ pressed }) => [
                    {
                      backgroundColor:
                        selectedCountry === country.id
                          ? colors.primary + "20"
                          : colors.surface,
                      borderWidth: 2,
                      borderColor:
                        selectedCountry === country.id ? colors.primary : "transparent",
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  className="rounded-2xl p-4"
                >
                  <View className="flex-row items-center gap-3">
                    <Text className="text-3xl">{country.flag}</Text>
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-foreground">
                        {country.name}
                      </Text>
                      {authorities[country.id] && (
                        <Text className="text-xs text-muted mt-1">
                          {authorities[country.id].name}
                        </Text>
                      )}
                    </View>
                    {selectedCountry === country.id && (
                      <Text className="text-xl">✓</Text>
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Tax Authority Info */}
          {currentAuthority && (
            <View
              style={{ backgroundColor: colors.primary + "10" }}
              className="rounded-2xl p-5"
            >
              <View className="flex-row items-center gap-2 mb-3">
                <Text className="text-xl">ℹ️</Text>
                <Text className="text-base font-semibold text-foreground">
                  Tax Authority Information
                </Text>
              </View>

              <View className="gap-2">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted">Authority</Text>
                  <Text className="text-sm font-semibold text-foreground flex-1 text-right">
                    {currentAuthority.name}
                  </Text>
                </View>

                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted">ID Label</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {currentAuthority.tin_label}
                  </Text>
                </View>

                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted">Currency</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {currentAuthority.currency}
                  </Text>
                </View>

                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted">Tax Year</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {currentAuthority.tax_year}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Taxpayer Information */}
          <View
            style={{ backgroundColor: colors.surface }}
            className="rounded-2xl p-5"
          >
            <Text className="text-base font-semibold text-foreground mb-4">
              Taxpayer Information
            </Text>

            <View className="gap-4">
              <View>
                <Text className="text-sm text-muted mb-2">Full Name *</Text>
                <TextInput
                  value={taxpayerName}
                  onChangeText={setTaxpayerName}
                  placeholder="Enter your full name"
                  placeholderTextColor={colors.muted}
                  style={{
                    backgroundColor: colors.background,
                    color: colors.foreground,
                  }}
                  className="rounded-xl px-4 py-3 text-base"
                />
              </View>

              <View>
                <Text className="text-sm text-muted mb-2">
                  {currentAuthority?.tin_label || "Tax ID"} *
                </Text>
                <TextInput
                  value={taxId}
                  onChangeText={setTaxId}
                  placeholder="Enter your tax ID"
                  placeholderTextColor={colors.muted}
                  style={{
                    backgroundColor: colors.background,
                    color: colors.foreground,
                  }}
                  className="rounded-xl px-4 py-3 text-base"
                />
              </View>

              <View>
                <Text className="text-sm text-muted mb-2">Tax Year *</Text>
                <TextInput
                  value={taxYear}
                  onChangeText={setTaxYear}
                  placeholder="2024"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  style={{
                    backgroundColor: colors.background,
                    color: colors.foreground,
                  }}
                  className="rounded-xl px-4 py-3 text-base"
                />
              </View>
            </View>
          </View>

          {/* Generate Button */}
          <Pressable
            onPress={handleGenerateReport}
            disabled={isGenerating}
            style={({ pressed }) => [
              {
                backgroundColor: colors.primary,
                opacity: pressed || isGenerating ? 0.7 : 1,
              },
            ]}
            className="rounded-xl px-6 py-4"
          >
            {isGenerating ? (
              <View className="flex-row items-center justify-center gap-3">
                <ActivityIndicator color={colors.background} />
                <Text
                  style={{ color: colors.background }}
                  className="text-center font-bold text-base"
                >
                  Generating Report...
                </Text>
              </View>
            ) : (
              <Text
                style={{ color: colors.background }}
                className="text-center font-bold text-base"
              >
                📄 Generate Tax Report
              </Text>
            )}
          </Pressable>

          {/* Disclaimer */}
          <View
            style={{ backgroundColor: colors.warning + "10" }}
            className="rounded-2xl p-5"
          >
            <View className="flex-row items-start gap-2">
              <Text className="text-xl">⚠️</Text>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Important Disclaimer
                </Text>
                <Text className="text-xs text-muted leading-relaxed">
                  This tax report is generated for informational purposes only and
                  provides estimated tax calculations based on your transaction data.
                  It is not a substitute for professional tax advice. Please consult
                  with a qualified tax professional or accountant for accurate tax
                  filing and compliance with local tax laws.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
