import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, RadioButton, Card } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { i18n, Language, t } from '../../services/i18n';
import { spacing, typography, theme } from '../../utils/theme';

export default function LanguageSettingsScreen({ navigation }: any) {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(i18n.getLanguage());
  const [saving, setSaving] = useState(false);

  const languages = i18n.getAvailableLanguages();

  const handleLanguageChange = async (language: Language) => {
    setSaving(true);
    setSelectedLanguage(language);
    await i18n.setLanguage(language);
    setSaving(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings.language')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.description}>
          Select your preferred language. The app will display content in your chosen language.
        </Text>

        <Card style={styles.card}>
          <Card.Content>
            <RadioButton.Group
              onValueChange={(value) => handleLanguageChange(value as Language)}
              value={selectedLanguage}
            >
              {languages.map((language, index) => (
                <View key={language.code}>
                  <TouchableOpacity
                    style={styles.languageItem}
                    onPress={() => handleLanguageChange(language.code)}
                  >
                    <View style={styles.languageInfo}>
                      <Text style={styles.languageName}>{language.name}</Text>
                      <Text style={styles.languageNative}>{language.nativeName}</Text>
                    </View>
                    <RadioButton value={language.code} color={theme.colors.primary} />
                  </TouchableOpacity>
                  {index < languages.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </RadioButton.Group>
          </Card.Content>
        </Card>

        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Preview</Text>
          <View style={styles.previewContent}>
            <Text style={styles.previewLabel}>{t('common.welcome')}</Text>
            <Text style={styles.previewLabel}>{t('nav.dashboard')}</Text>
            <Text style={styles.previewLabel}>{t('nav.policies')}</Text>
            <Text style={styles.previewLabel}>{t('nav.claims')}</Text>
            <Text style={styles.previewLabel}>{t('nav.payments')}</Text>
          </View>
        </View>

        <Text style={styles.infoText}>
          Some content may still appear in English if translations are not available.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h3,
    color: theme.colors.text,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  description: {
    ...typography.body,
    color: theme.colors.textSecondary,
    marginBottom: spacing.lg,
  },
  card: {
    marginBottom: spacing.lg,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    ...typography.body,
    fontWeight: '600',
    color: theme.colors.text,
  },
  languageNative: {
    ...typography.small,
    color: theme.colors.textSecondary,
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
  previewCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  previewTitle: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
  },
  previewContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  previewLabel: {
    ...typography.body,
    color: theme.colors.text,
    backgroundColor: theme.colors.primary + '15',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: theme.roundness,
  },
  infoText: {
    ...typography.small,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
});
