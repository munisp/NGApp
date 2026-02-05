import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useThemeContext } from "@/lib/theme-provider";

export default function ThemeSettingsScreen() {
  const colors = useColors();
  const { themePreference, setThemePreference, colorScheme } = useThemeContext();
  const [selectedPreference, setSelectedPreference] = useState(themePreference);

  useEffect(() => {
    setSelectedPreference(themePreference);
  }, [themePreference]);

  const handlePreferenceChange = async (preference: "light" | "dark" | "system") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPreference(preference);
    await setThemePreference(preference);
  };

  const options = [
    {
      value: "light" as const,
      label: "Light",
      description: "Always use light theme",
      icon: "☀️",
    },
    {
      value: "dark" as const,
      label: "Dark",
      description: "Always use dark theme",
      icon: "🌙",
    },
    {
      value: "system" as const,
      label: "System",
      description: "Follow device settings",
      icon: "📱",
    },
  ];

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View>
            <Text className="text-2xl font-bold text-foreground">Appearance</Text>
            <Text className="text-base text-muted mt-2">
              Choose how the app looks on your device
            </Text>
          </View>

          {/* Current Theme Display */}
          <View
            className="rounded-xl p-4 border"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            <Text className="text-sm font-medium text-muted mb-1">Current Theme</Text>
            <Text className="text-xl font-bold text-foreground capitalize">
              {colorScheme === "light" ? "☀️ Light" : "🌙 Dark"}
            </Text>
            {themePreference === "system" && (
              <Text className="text-sm text-muted mt-1">
                Following system preference
              </Text>
            )}
          </View>

          {/* Theme Options */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Theme Preference</Text>
            
            {options.map((option) => {
              const isSelected = selectedPreference === option.value;
              
              return (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => handlePreferenceChange(option.value)}
                  className="rounded-xl p-4 border"
                  style={{
                    backgroundColor: isSelected ? colors.primary + "20" : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  }}
                >
                  <View className="flex-row items-center gap-3">
                    <Text className="text-3xl">{option.icon}</Text>
                    <View className="flex-1">
                      <Text
                        className="text-lg font-semibold"
                        style={{
                          color: isSelected ? colors.primary : colors.foreground,
                        }}
                      >
                        {option.label}
                      </Text>
                      <Text className="text-sm text-muted mt-1">
                        {option.description}
                      </Text>
                    </View>
                    {isSelected && (
                      <View
                        className="w-6 h-6 rounded-full items-center justify-center"
                        style={{ backgroundColor: colors.primary }}
                      >
                        <Text className="text-white text-xs font-bold">✓</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Info Box */}
          <View
            className="rounded-xl p-4"
            style={{ backgroundColor: colors.primary + "10" }}
          >
            <Text className="text-sm text-foreground leading-relaxed">
              💡 <Text className="font-semibold">Tip:</Text> The "System" option
              automatically switches between light and dark themes based on your
              device settings. This helps reduce eye strain in different lighting
              conditions.
            </Text>
          </View>

          {/* Preview Section */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Preview</Text>
            
            <View
              className="rounded-xl p-4 border"
              style={{
                backgroundColor: colors.background,
                borderColor: colors.border,
              }}
            >
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-lg font-bold text-foreground">
                  Sample Card
                </Text>
                <View
                  className="px-3 py-1 rounded-full"
                  style={{ backgroundColor: colors.primary }}
                >
                  <Text className="text-white text-xs font-semibold">Active</Text>
                </View>
              </View>
              
              <Text className="text-base text-foreground mb-2">
                This is how text will appear in the {colorScheme} theme.
              </Text>
              
              <Text className="text-sm text-muted">
                Secondary text uses a muted color for better hierarchy.
              </Text>
              
              <View className="flex-row gap-2 mt-4">
                <View
                  className="flex-1 rounded-lg p-3"
                  style={{ backgroundColor: colors.surface }}
                >
                  <Text className="text-xs text-muted mb-1">Balance</Text>
                  <Text className="text-lg font-bold text-foreground">$5,420.50</Text>
                </View>
                <View
                  className="flex-1 rounded-lg p-3"
                  style={{ backgroundColor: colors.surface }}
                >
                  <Text className="text-xs text-muted mb-1">Savings</Text>
                  <Text className="text-lg font-bold" style={{ color: colors.success }}>
                    +$250.00
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Bottom Spacing */}
          <View className="h-8" />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
