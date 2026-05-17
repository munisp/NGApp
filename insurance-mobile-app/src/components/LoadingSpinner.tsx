import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet, ViewStyle } from 'react-native';
import { theme, spacing, typography } from '../utils/theme';

export interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  message?: string;
  fullScreen?: boolean;
  overlay?: boolean;
  style?: ViewStyle;
}

export function LoadingSpinner({
  size = 'large',
  color = theme.colors.primary,
  message,
  fullScreen = false,
  overlay = false,
  style,
}: LoadingSpinnerProps) {
  const content = (
    <View style={[styles.container, fullScreen && styles.fullScreen, style]}>
      <ActivityIndicator size={size} color={color} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );

  if (overlay) {
    return <View style={styles.overlay}>{content}</View>;
  }

  return content;
}

export function LoadingSkeleton({
  width,
  height,
  borderRadius = theme.roundness,
  style,
}: {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        styles.skeleton,
        { width, height, borderRadius },
        style,
      ]}
    />
  );
}

export function LoadingCard({ lines = 3 }: { lines?: number }) {
  return (
    <View style={styles.loadingCard}>
      <View style={styles.loadingCardHeader}>
        <LoadingSkeleton width={48} height={48} borderRadius={24} />
        <View style={styles.loadingCardHeaderText}>
          <LoadingSkeleton width="60%" height={16} />
          <LoadingSkeleton width="40%" height={12} style={{ marginTop: spacing.xs }} />
        </View>
      </View>
      {Array.from({ length: lines }).map((_, index) => (
        <LoadingSkeleton
          key={index}
          width={index === lines - 1 ? '70%' : '100%'}
          height={12}
          style={{ marginTop: spacing.sm }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  message: {
    ...typography.body,
    color: theme.colors.text,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  skeleton: {
    backgroundColor: theme.colors.border,
    opacity: 0.5,
  },
  loadingCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  loadingCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingCardHeaderText: {
    flex: 1,
    marginLeft: spacing.md,
  },
});

export default LoadingSpinner;
