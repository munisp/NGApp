import React, { useCallback, useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Alert } from 'react-native';
import {
  Appbar,
  List,
  Text,
  ActivityIndicator,
  Divider,
  useTheme,
  Button,
  MD3Theme,
} from 'react-native-paper';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// --- MOCK IMPORTS (Replace with actual project imports) ---
// Assume '@/services/api' exports a tRPC client named 'trpc'
// and '@/utils/theme' exports a theme object.
const trpc = {
  notifications: {
    list: {
      useQuery: (options?: any) => {
        // Mock data and state for demonstration
        const mockNotifications = [
          { id: '1', title: 'Claim Approved', body: 'Your claim #12345 has been approved and payment is being processed.', isRead: false, createdAt: new Date(Date.now() - 3600000), entityType: 'claim', entityId: '12345' },
          { id: '2', title: 'Policy Renewal Due', body: 'Your auto policy is due for renewal on 2026-03-01.', isRead: false, createdAt: new Date(Date.now() - 7200000), entityType: 'policy', entityId: 'P9876' },
          { id: '3', title: 'Account Update', body: 'Please review and update your contact information.', isRead: true, createdAt: new Date(Date.now() - 86400000), entityType: 'account', entityId: 'A001' },
          { id: '4', title: 'New Document Available', body: 'Your annual statement is now available in the documents section.', isRead: false, createdAt: new Date(Date.now() - 172800000), entityType: 'account', entityId: 'A001' },
        ];
        const [data, setData] = useState(mockNotifications);
        const [isLoading, setIsLoading] = useState(true);
        const [isError, setIsError] = useState(false);
        const [isRefetching, setIsRefetching] = useState(false);

        React.useEffect(() => {
          setTimeout(() => {
            setIsLoading(false);
          }, 1000);
        }, []);

        const refetch = () => {
          setIsRefetching(true);
          return new Promise((resolve) => {
            setTimeout(() => {
              setData(prev => prev.map(n => ({ ...n, isRead: false }))); // Mock refetch to reset read status
              setIsRefetching(false);
              resolve(true);
            }, 1500);
          });
        };

        return { data, isLoading, isError, refetch, isRefetching };
      },
    },
    markAsRead: {
      useMutation: (options?: any) => {
        return {
          mutate: (id: string) => {
            console.log(`Mock: Marking notification ${id} as read`);
            // Simulate API call success
            options?.onSuccess?.();
          },
          isLoading: false,
          isError: false,
        };
      },
    },
    markAllAsRead: {
      useMutation: (options?: any) => {
        return {
          mutate: () => {
            console.log('Mock: Marking all notifications as read');
            // Simulate API call success
            options?.onSuccess?.();
          },
          isLoading: false,
          isError: false,
        };
      },
    },
  },
};

// Mock theme import
const theme = useTheme() as MD3Theme;

// Mock Toast utility for success/error notifications
const Toast = {
  success: (message: string) => console.log(`TOAST SUCCESS: ${message}`),
  error: (message: string) => console.log(`TOAST ERROR: ${message}`),
};

// --- TYPES ---

type EntityType = 'policy' | 'claim' | 'account';

interface Notification {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: Date;
  entityType: EntityType;
  entityId: string;
}

// Mock Navigation types
type RootStackParamList = {
  Notifications: undefined;
  PolicyDetails: { id: string };
  ClaimDetails: { id: string };
  AccountSettings: undefined;
  // Add other screens as needed
};

type NotificationsScreenNavigationProp = NavigationProp<RootStackParamList, 'Notifications'>;

// --- CONSTANTS ---

const NOTIFICATIONS_QUERY_KEY = ['notifications', 'list'];

// --- SCREEN COMPONENT ---

const NotificationsScreen: React.FC = () => {
  const navigation = useNavigation<NotificationsScreenNavigationProp>();
  const queryClient = useQueryClient();
  const appTheme = useTheme();

  // 1. Data Fetching (List)
  const {
    data: notifications,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = trpc.notifications.list.useQuery(
    // Example of using react-query options
    {
      staleTime: 1000 * 60 * 5, // 5 minutes
      onError: (error: any) => {
        Toast.error(`Failed to load notifications: ${error.message}`);
      },
    }
  );

  // 2. Mutation (Mark Single as Read)
  const markAsReadMutation = trpc.notifications.markAsRead.useMutation({
    onSuccess: (_, notificationId) => {
      // Invalidate the list query to refetch or manually update cache
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      Toast.success('Notification marked as read.');
    },
    onError: (error: any) => {
      Toast.error(`Failed to mark as read: ${error.message}`);
    },
  });

  // 3. Mutation (Mark All as Read)
  const markAllAsReadMutation = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: () => {
      // Invalidate the list query to refetch
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      Toast.success('All notifications marked as read.');
    },
    onError: (error: any) => {
      Toast.error(`Failed to mark all as read: ${error.message}`);
    },
  });

  const handleMarkAsRead = useCallback((id: string) => {
    markAsReadMutation.mutate(id);
  }, [markAsReadMutation]);

  const handleMarkAllAsRead = useCallback(() => {
    Alert.alert(
      'Mark All as Read',
      'Are you sure you want to mark all notifications as read?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark All',
          onPress: () => markAllAsReadMutation.mutate(),
          style: 'destructive',
        },
      ]
    );
  }, [markAllAsReadMutation]);

  const handleNavigate = useCallback((notification: Notification) => {
    handleMarkAsRead(notification.id); // Mark as read on tap

    switch (notification.entityType) {
      case 'policy':
        navigation.navigate('PolicyDetails', { id: notification.entityId });
        break;
      case 'claim':
        navigation.navigate('ClaimDetails', { id: notification.entityId });
        break;
      case 'account':
        navigation.navigate('AccountSettings'); // Assuming account notifications navigate to a general settings screen
        break;
      default:
        // Fallback or no-op
        break;
    }
  }, [navigation, handleMarkAsRead]);

  const renderNotification = ({ item }: { item: Notification }) => (
    <List.Item
      title={item.title}
      description={item.body}
      left={props => (
        <List.Icon
          {...props}
          icon={item.isRead ? 'email-open-outline' : 'email-outline'}
          color={item.isRead ? appTheme.colors.outline : appTheme.colors.primary}
        />
      )}
      right={props => (
        <View style={styles.rightContainer}>
          <Text style={{ color: appTheme.colors.onSurfaceVariant, fontSize: 12 }}>
            {item.createdAt.toLocaleDateString()}
          </Text>
          {!item.isRead && (
            <Button
              mode="text"
              onPress={() => handleMarkAsRead(item.id)}
              loading={markAsReadMutation.isLoading}
              disabled={markAsReadMutation.isLoading}
              labelStyle={{ fontSize: 12 }}
            >
              Read
            </Button>
          )}
        </View>
      )}
      onPress={() => handleNavigate(item)}
      style={[
        styles.listItem,
        !item.isRead && { backgroundColor: appTheme.colors.surfaceVariant },
      ]}
      titleStyle={!item.isRead && { fontWeight: 'bold' }}
    />
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator animating={true} size="large" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      );
    }

    if (isError) {
      return (
        <View style={styles.centerContainer}>
          <List.Icon icon="alert-circle-outline" color={appTheme.colors.error} />
          <Text style={styles.errorText}>
            Failed to fetch notifications. Please try again.
          </Text>
          <Button mode="contained" onPress={() => refetch()}>
            Retry
          </Button>
        </View>
      );
    }

    if (!notifications || notifications.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <List.Icon icon="bell-off-outline" color={appTheme.colors.onSurfaceVariant} />
          <Text style={styles.emptyText}>You have no new notifications.</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        ItemSeparatorComponent={() => <Divider />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            colors={[appTheme.colors.primary]}
            tintColor={appTheme.colors.primary}
          />
        }
      />
    );
  };

  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;
  const hasUnread = unreadCount > 0;

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={`Notifications (${unreadCount})`} />
        <Appbar.Action
          icon="check-all"
          onPress={handleMarkAllAsRead}
          disabled={!hasUnread || markAllAsReadMutation.isLoading}
          loading={markAllAsReadMutation.isLoading}
        />
      </Appbar.Header>
      {renderContent()}
    </View>
  );
};

// --- STYLES ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: theme.colors.onSurface,
  },
  errorText: {
    textAlign: 'center',
    marginBottom: 15,
    color: theme.colors.error,
  },
  emptyText: {
    marginTop: 10,
    color: theme.colors.onSurfaceVariant,
  },
  listContent: {
    paddingBottom: 10,
  },
  listItem: {
    paddingVertical: 8,
  },
  rightContainer: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: '100%',
    paddingVertical: 5,
  },
});

export default NotificationsScreen;
