import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  icon: string;
  section: string;
  keywords: string[];
}

const COMMANDS: CommandItem[] = [
  { id: 'home', title: 'Home', subtitle: 'Overview & quick actions', href: '/', icon: 'house.fill', section: 'Main', keywords: ['home', 'main', 'overview'] },
  { id: 'dashboard', title: 'Dashboard', subtitle: 'Analytics & metrics', href: '/dashboard', icon: 'chevron.left.forwardslash.chevron.right', section: 'Main', keywords: ['dashboard', 'analytics', 'stats'] },
  { id: 'accounts', title: 'Accounts', subtitle: 'View your accounts', href: '/accounts', icon: 'creditcard.fill', section: 'Finance', keywords: ['accounts', 'bank', 'balance'] },
  { id: 'payments', title: 'Payments', subtitle: 'Send & receive money', href: '/payments', icon: 'arrow.left.arrow.right.circle.fill', section: 'Finance', keywords: ['payments', 'send', 'transfer', 'money'] },
  { id: 'transactions', title: 'Transactions', subtitle: 'Transaction history', href: '/transactions', icon: 'doc.text.fill', section: 'Finance', keywords: ['transactions', 'history', 'records'] },
  { id: 'budgets', title: 'Budgets', subtitle: 'Budget management', href: '/budgets', icon: 'chart.bar.fill', section: 'Planning', keywords: ['budgets', 'spending', 'limits'] },
  { id: 'savings', title: 'Savings Goals', subtitle: 'Track your savings', href: '/savings-goals', icon: 'star.fill', section: 'Planning', keywords: ['savings', 'goals', 'targets'] },
  { id: 'analytics', title: 'Budget Analytics', subtitle: 'Spending analysis', href: '/budget-analytics', icon: 'chart.bar.fill', section: 'Planning', keywords: ['analytics', 'analysis', 'charts'] },
  { id: 'bnpl', title: 'BNPL', subtitle: 'Buy now pay later', href: '/bnpl', icon: 'creditcard.fill', section: 'Services', keywords: ['bnpl', 'buy', 'pay later', 'installment'] },
  { id: 'credit', title: 'Credit Score', subtitle: 'Check your score', href: '/credit-score', icon: 'chart.bar.fill', section: 'Services', keywords: ['credit', 'score', 'rating'] },
  { id: 'banking', title: 'Open Banking', subtitle: 'Connected accounts', href: '/open-banking', icon: 'building.columns.fill', section: 'Services', keywords: ['banking', 'open', 'connected'] },
  { id: 'health', title: 'Financial Health', subtitle: 'Wellness score', href: '/financial-health', icon: 'heart.circle.fill', section: 'Services', keywords: ['health', 'wellness', 'financial'] },
  { id: 'bills', title: 'Bill Reminders', subtitle: 'Upcoming bills', href: '/bill-reminders', icon: 'calendar', section: 'Services', keywords: ['bills', 'reminders', 'due'] },
  { id: 'profile', title: 'Profile', subtitle: 'Your account', href: '/profile', icon: 'person.fill', section: 'More', keywords: ['profile', 'account', 'user'] },
  { id: 'settings', title: 'Settings', subtitle: 'App preferences', href: '/settings', icon: 'gear', section: 'More', keywords: ['settings', 'preferences', 'config'] },
  { id: 'insights', title: 'Insights', subtitle: 'AI spending insights', href: '/insights', icon: 'lightbulb.fill', section: 'More', keywords: ['insights', 'ai', 'tips'] },
];

interface CommandPaletteProps {
  visible: boolean;
  onClose: () => void;
}

export function CommandPalette({ visible, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width > 768;

  const filtered = useMemo(() => {
    if (!query.trim()) return COMMANDS;
    const q = query.toLowerCase();
    return COMMANDS.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(q) ||
        cmd.subtitle?.toLowerCase().includes(q) ||
        cmd.keywords.some((kw) => kw.includes(q))
    );
  }, [query]);

  const handleSelect = useCallback(
    (item: CommandItem) => {
      setQuery('');
      onClose();
      router.push(item.href as any);
    },
    [onClose]
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
      }
      if (e.key === 'Escape' && visible) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    for (const item of filtered) {
      if (!groups[item.section]) groups[item.section] = [];
      groups[item.section].push(item);
    }
    return groups;
  }, [filtered]);

  const modalWidth = isDesktop ? Math.min(560, width * 0.5) : width * 0.92;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-start',
          alignItems: 'center',
          paddingTop: isDesktop ? 120 : 80,
        }}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={{
            width: modalWidth,
            maxHeight: 480,
            backgroundColor: colors.background,
            borderRadius: 16,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.15,
            shadowRadius: 24,
            elevation: 12,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <IconSymbol size={18} name="magnifyingglass" color={colors.text + '66'} />
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder="Search pages..."
              placeholderTextColor={colors.text + '66'}
              style={{
                flex: 1,
                paddingVertical: 14,
                paddingHorizontal: 12,
                fontSize: 15,
                color: colors.text,
                outlineStyle: 'none',
              } as any}
            />
            {Platform.OS === 'web' && (
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 4,
                  backgroundColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 11, color: colors.text + '88', fontFamily: 'monospace' }}>ESC</Text>
              </View>
            )}
          </View>

          <ScrollView style={{ maxHeight: 400 }} keyboardShouldPersistTaps="handled">
            {filtered.length === 0 ? (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: colors.text + '66' }}>No results found</Text>
              </View>
            ) : (
              Object.entries(grouped).map(([section, items]) => (
                <View key={section}>
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '600',
                      color: colors.text,
                      opacity: 0.4,
                      paddingHorizontal: 16,
                      paddingTop: 12,
                      paddingBottom: 4,
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                    }}
                  >
                    {section}
                  </Text>
                  {items.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => handleSelect(item)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 10,
                        paddingHorizontal: 16,
                        marginHorizontal: 8,
                        borderRadius: 8,
                      }}
                    >
                      <IconSymbol size={18} name={item.icon as any} color={colors.tint} />
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text }}>
                          {item.title}
                        </Text>
                        {item.subtitle && (
                          <Text style={{ fontSize: 11, color: colors.text + '88', marginTop: 1 }}>
                            {item.subtitle}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ))
            )}
            <View style={{ height: 8 }} />
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
