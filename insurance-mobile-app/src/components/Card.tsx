import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { theme, spacing } from '../utils/theme';

export interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  variant?: 'elevated' | 'outlined' | 'filled';
  padding?: 'none' | 'small' | 'medium' | 'large';
}

export function Card({
  children,
  style,
  onPress,
  variant = 'elevated',
  padding = 'medium',
}: CardProps) {
  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'outlined':
        return {
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
          elevation: 0,
          shadowOpacity: 0,
        };
      case 'filled':
        return {
          backgroundColor: theme.colors.background,
          elevation: 0,
          shadowOpacity: 0,
        };
      default:
        return {
          backgroundColor: theme.colors.surface,
          elevation: 2,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        };
    }
  };

  const getPaddingStyles = (): ViewStyle => {
    switch (padding) {
      case 'none':
        return { padding: 0 };
      case 'small':
        return { padding: spacing.sm };
      case 'large':
        return { padding: spacing.lg };
      default:
        return { padding: spacing.md };
    }
  };

  const cardContent = (
    <View style={[styles.card, getVariantStyles(), getPaddingStyles(), style]}>
      {children}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {cardContent}
      </TouchableOpacity>
    );
  }

  return cardContent;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.roundness,
    overflow: 'hidden',
  },
});

export default Card;
