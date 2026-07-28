import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { theme, spacing, typography } from '../utils/theme';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
    
    // Log to analytics/crash reporting service
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <Icon name="alert-circle" size={64} color={theme.colors.error} />
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            We're sorry, but something unexpected happened. Please try again.
          </Text>
          
          <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
            <Icon name="refresh" size={20} color="#fff" />
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>

          {__DEV__ && this.state.error && (
            <ScrollView style={styles.errorDetails}>
              <Text style={styles.errorTitle}>Error Details (Dev Only):</Text>
              <Text style={styles.errorText}>{this.state.error.toString()}</Text>
              {this.state.errorInfo && (
                <Text style={styles.errorStack}>
                  {this.state.errorInfo.componentStack}
                </Text>
              )}
            </ScrollView>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
  icon?: string;
}

export function ErrorMessage({ message, onRetry, icon = 'alert-circle' }: ErrorMessageProps) {
  return (
    <View style={styles.errorMessage}>
      <Icon name={icon} size={48} color={theme.colors.error} />
      <Text style={styles.errorMessageText}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryButtonSmall} onPress={onRetry}>
          <Text style={styles.retryTextSmall}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export function EmptyState({ title, message, icon = 'inbox', action }: EmptyStateProps) {
  return (
    <View style={styles.emptyState}>
      <Icon name={icon} size={64} color={theme.colors.textSecondary} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {message && <Text style={styles.emptyMessage}>{message}</Text>}
      {action && (
        <TouchableOpacity style={styles.actionButton} onPress={action.onPress}>
          <Text style={styles.actionText}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: theme.colors.background,
  },
  title: {
    ...typography.h2,
    color: theme.colors.text,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    color: theme.colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: theme.roundness,
    marginTop: spacing.xl,
  },
  retryText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  errorDetails: {
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    maxHeight: 200,
    width: '100%',
  },
  errorTitle: {
    ...typography.caption,
    color: theme.colors.error,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.small,
    color: theme.colors.error,
  },
  errorStack: {
    ...typography.small,
    color: theme.colors.textSecondary,
    marginTop: spacing.sm,
    fontFamily: 'monospace',
  },
  errorMessage: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorMessageText: {
    ...typography.body,
    color: theme.colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  retryButtonSmall: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  retryTextSmall: {
    ...typography.body,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    ...typography.h3,
    color: theme.colors.text,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  emptyMessage: {
    ...typography.body,
    color: theme.colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  actionButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.roundness,
  },
  actionText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '600',
  },
});

export default ErrorBoundary;
