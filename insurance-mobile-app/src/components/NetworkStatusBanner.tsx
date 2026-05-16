import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNetworkStatus } from '../hooks/useOfflineSync';
import { spacing, typography, theme } from '../utils/theme';

export function NetworkStatusBanner() {
  const { isOnline, pendingCount, syncNow } = useNetworkStatus();
  const [visible, setVisible] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const slideAnim = useState(new Animated.Value(-60))[0];

  useEffect(() => {
    if (!isOnline || pendingCount > 0) {
      setVisible(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -60,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    }
  }, [isOnline, pendingCount, slideAnim]);

  const handleSync = async () => {
    if (syncing || !isOnline) return;
    setSyncing(true);
    try {
      await syncNow();
    } finally {
      setSyncing(false);
    }
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        isOnline ? styles.pendingContainer : styles.offlineContainer,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.content}>
        <Icon
          name={isOnline ? 'cloud-sync' : 'cloud-off-outline'}
          size={20}
          color="#fff"
        />
        <Text style={styles.text}>
          {isOnline
            ? `${pendingCount} pending ${pendingCount === 1 ? 'change' : 'changes'}`
            : 'You are offline'}
        </Text>
      </View>
      {isOnline && pendingCount > 0 && (
        <TouchableOpacity
          style={styles.syncButton}
          onPress={handleSync}
          disabled={syncing}
        >
          <Icon
            name={syncing ? 'loading' : 'sync'}
            size={16}
            color="#fff"
          />
          <Text style={styles.syncText}>{syncing ? 'Syncing...' : 'Sync Now'}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

export function OfflineIndicator() {
  const { isOnline } = useNetworkStatus();

  if (isOnline) return null;

  return (
    <View style={styles.indicator}>
      <Icon name="cloud-off-outline" size={14} color={theme.colors.warning} />
      <Text style={styles.indicatorText}>Offline</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    zIndex: 1000,
  },
  offlineContainer: {
    backgroundColor: theme.colors.error,
  },
  pendingContainer: {
    backgroundColor: theme.colors.warning,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    ...typography.small,
    color: '#fff',
    marginLeft: spacing.sm,
    fontWeight: '600',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: theme.roundness,
  },
  syncText: {
    ...typography.small,
    color: '#fff',
    marginLeft: spacing.xs,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.warning + '20',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: theme.roundness,
  },
  indicatorText: {
    ...typography.small,
    color: theme.colors.warning,
    marginLeft: spacing.xs,
    fontWeight: '600',
  },
});

export default NetworkStatusBanner;
