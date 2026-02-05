import { View, Text, TouchableOpacity, ScrollView, Switch, Alert } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  exportTransactions,
  shareExportedFile,
  getExportStatistics,
  getAvailableCategories,
  getDefaultExportOptions,
  formatCurrency,
  type ExportFormat,
  type ExportOptions,
} from "@/utils/expense-export";

export default function ExportScreen() {
  const colors = useColors();
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [includeIncome, setIncludeIncome] = useState(true);
  const [includeExpenses, setIncludeExpenses] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [statistics, setStatistics] = useState({
    totalTransactions: 0,
    totalIncome: 0,
    totalExpenses: 0,
    netAmount: 0,
    dateRange: "All time",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    updateStatistics();
  }, [format, includeIncome, includeExpenses, selectedCategories]);

  const loadData = async () => {
    setIsLoading(true);
    const categories = await getAvailableCategories();
    setAvailableCategories(categories);
    await updateStatistics();
    setIsLoading(false);
  };

  const updateStatistics = async () => {
    const options: ExportOptions = {
      format,
      includeIncome,
      includeExpenses,
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
    };

    const stats = await getExportStatistics(options);
    setStatistics(stats);
  };

  const handleToggleCategory = (category: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const handleExport = async () => {
    if (!includeIncome && !includeExpenses) {
      Alert.alert("Error", "Please select at least one transaction type to export");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsExporting(true);

    const options: ExportOptions = {
      format,
      includeIncome,
      includeExpenses,
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
    };

    const result = await exportTransactions(options);

    if (result.success && result.filePath) {
      Alert.alert(
        "Export Successful",
        `${statistics.totalTransactions} transactions exported`,
        [
          { text: "OK", style: "default" },
          {
            text: "Share",
            onPress: async () => {
              const shareResult = await shareExportedFile(result.filePath!);
              if (!shareResult.success) {
                Alert.alert("Error", shareResult.error || "Failed to share file");
              }
            },
          },
        ]
      );
    } else {
      Alert.alert("Export Failed", result.error || "Unknown error occurred");
    }

    setIsExporting(false);
  };

  if (isLoading) {
    return (
      <ScreenContainer className="p-6 items-center justify-center">
        <Text className="text-lg text-muted">Loading...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View>
            <Text className="text-2xl font-bold text-foreground">Export Transactions</Text>
            <Text className="text-base text-muted mt-2">
              Export your transaction history for record-keeping
            </Text>
          </View>

          {/* Format Selection */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Export Format</Text>
            <View className="flex-row gap-3">
              {[
                { value: "csv" as ExportFormat, label: "CSV", description: "For Excel, Numbers" },
                {
                  value: "excel" as ExportFormat,
                  label: "Excel",
                  description: "Optimized for Microsoft Excel",
                },
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setFormat(option.value);
                  }}
                  className="flex-1 rounded-xl p-4 border"
                  style={{
                    backgroundColor: format === option.value ? colors.primary + "10" : colors.surface,
                    borderColor: format === option.value ? colors.primary : colors.border,
                    borderWidth: format === option.value ? 2 : 1,
                  }}
                >
                  <Text
                    className="text-base font-semibold mb-1"
                    style={{
                      color: format === option.value ? colors.primary : colors.foreground,
                    }}
                  >
                    {option.label}
                  </Text>
                  <Text className="text-xs text-muted">{option.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Transaction Types */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Include</Text>
            
            <View
              className="rounded-xl p-4 border"
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
              }}
            >
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-base text-foreground">Income</Text>
                <Switch
                  value={includeIncome}
                  onValueChange={(value) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIncludeIncome(value);
                  }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={includeIncome ? "#FFFFFF" : "#F4F3F4"}
                />
              </View>
              
              <View className="flex-row items-center justify-between">
                <Text className="text-base text-foreground">Expenses</Text>
                <Switch
                  value={includeExpenses}
                  onValueChange={(value) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIncludeExpenses(value);
                  }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={includeExpenses ? "#FFFFFF" : "#F4F3F4"}
                />
              </View>
            </View>
          </View>

          {/* Categories Filter */}
          {availableCategories.length > 0 && (
            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-semibold text-foreground">Categories</Text>
                {selectedCategories.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedCategories([]);
                    }}
                  >
                    <Text className="text-sm font-semibold" style={{ color: colors.primary }}>
                      Clear
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View className="flex-row flex-wrap gap-2">
                {availableCategories.map((category) => {
                  const isSelected = selectedCategories.includes(category);
                  return (
                    <TouchableOpacity
                      key={category}
                      onPress={() => handleToggleCategory(category)}
                      className="rounded-full px-4 py-2 border"
                      style={{
                        backgroundColor: isSelected ? colors.primary + "10" : colors.surface,
                        borderColor: isSelected ? colors.primary : colors.border,
                      }}
                    >
                      <Text
                        className="text-sm font-medium"
                        style={{
                          color: isSelected ? colors.primary : colors.foreground,
                        }}
                      >
                        {category}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Statistics Preview */}
          <View
            className="rounded-xl p-4 border"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            <Text className="text-base font-semibold text-foreground mb-3">Export Preview</Text>
            
            <View className="gap-2">
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted">Period</Text>
                <Text className="text-sm font-medium text-foreground">
                  {statistics.dateRange}
                </Text>
              </View>

              <View className="flex-row justify-between">
                <Text className="text-sm text-muted">Transactions</Text>
                <Text className="text-sm font-medium text-foreground">
                  {statistics.totalTransactions}
                </Text>
              </View>

              {includeIncome && (
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted">Total Income</Text>
                  <Text className="text-sm font-medium" style={{ color: colors.success }}>
                    {formatCurrency(statistics.totalIncome)}
                  </Text>
                </View>
              )}

              {includeExpenses && (
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted">Total Expenses</Text>
                  <Text className="text-sm font-medium" style={{ color: colors.error }}>
                    {formatCurrency(statistics.totalExpenses)}
                  </Text>
                </View>
              )}

              {includeIncome && includeExpenses && (
                <View className="flex-row justify-between pt-2 border-t" style={{ borderColor: colors.border }}>
                  <Text className="text-sm font-semibold text-foreground">Net Amount</Text>
                  <Text
                    className="text-sm font-bold"
                    style={{
                      color: statistics.netAmount >= 0 ? colors.success : colors.error,
                    }}
                  >
                    {formatCurrency(statistics.netAmount)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Export Button */}
          <TouchableOpacity
            onPress={handleExport}
            disabled={isExporting || statistics.totalTransactions === 0}
            className="rounded-xl p-4 items-center"
            style={{
              backgroundColor:
                isExporting || statistics.totalTransactions === 0
                  ? colors.border
                  : colors.primary,
            }}
          >
            <Text className="text-base font-semibold text-white">
              {isExporting
                ? "Exporting..."
                : statistics.totalTransactions === 0
                ? "No Transactions to Export"
                : `Export ${statistics.totalTransactions} Transactions`}
            </Text>
          </TouchableOpacity>

          {/* Info */}
          <View
            className="rounded-xl p-4"
            style={{ backgroundColor: colors.surface }}
          >
            <Text className="text-sm text-muted leading-relaxed">
              Exported files will include transaction date, description, amount, type, category,
              account, and notes. A summary with totals will be included at the end.
            </Text>
          </View>

          {/* Bottom Spacing */}
          <View className="h-8" />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
