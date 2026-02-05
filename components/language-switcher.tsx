import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const LANGUAGES = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "sw", name: "Kiswahili", flag: "🇰🇪" },
  { code: "ha", name: "Hausa", flag: "🇳🇬" },
  { code: "yo", name: "Yorùbá", flag: "🇳🇬" },
  { code: "ig", name: "Igbo", flag: "🇳🇬" },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleLanguageChange = async (languageCode: string) => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await i18n.changeLanguage(languageCode);
    setIsExpanded(false);
  };

  const currentLanguage = LANGUAGES.find((lang) => lang.code === i18n.language) || LANGUAGES[0];

  if (!isExpanded) {
    return (
      <TouchableOpacity
        onPress={() => setIsExpanded(true)}
        className="flex-row items-center gap-2 px-4 py-2 bg-surface rounded-full border border-border"
        style={{ alignSelf: "flex-start" }}
      >
        <Text className="text-2xl">{currentLanguage.flag}</Text>
        <Text className="text-foreground font-medium">{currentLanguage.name}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View className="bg-surface rounded-2xl border border-border p-2 shadow-sm">
      <ScrollView showsVerticalScrollIndicator={false}>
        {LANGUAGES.map((language) => {
          const isSelected = language.code === i18n.language;
          return (
            <TouchableOpacity
              key={language.code}
              onPress={() => handleLanguageChange(language.code)}
              className={`flex-row items-center gap-3 px-4 py-3 rounded-xl ${
                isSelected ? "bg-primary" : "bg-transparent"
              }`}
              style={{ opacity: isSelected ? 1 : 0.7 }}
            >
              <Text className="text-2xl">{language.flag}</Text>
              <Text
                className={`font-medium ${
                  isSelected ? "text-background" : "text-foreground"
                }`}
              >
                {language.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <TouchableOpacity
        onPress={() => setIsExpanded(false)}
        className="mt-2 px-4 py-2 bg-background rounded-xl"
      >
        <Text className="text-muted text-center font-medium">Close</Text>
      </TouchableOpacity>
    </View>
  );
}
