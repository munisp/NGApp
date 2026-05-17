
import React, { useState, useMemo } from 'react';
import { FlatList, View, RefreshControl, StyleSheet } from 'react-native';
import { Appbar, TextInput, Card, Title, Paragraph, ActivityIndicator, Text, FAB, useTheme, Menu, Divider, IconButton, Snackbar } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { trpc } from '@/services/api';
import { theme } from '@/utils/theme';

// Mocking a basic Policy type. Replace with your actual type from the API.
interface Policy {
  id: string;
  policyNumber: string;
  holderName: string;
  type: 'auto' | 'home' | 'life';
  status: 'active' | 'expired' | 'cancelled';
  premium: number;
}

// Mocking the navigation type for better type safety
type NavigationProps = {
  navigate: (screen: string, params?: any) => void;
  // Add other navigation methods as needed
};

const PoliciesScreen = () => {
  const navigation = useNavigation<NavigationProps>();
  const paperTheme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'expired' | 'cancelled'>('all');
  const [menuVisible, setMenuVisible] = useState(false);
  
  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isErrorToast, setIsErrorToast] = useState(false);

  const showToast = (message: string, isError = false) => {
    setToastMessage(message);
    setIsErrorToast(isError);
  };

  // 1. tRPC Data Fetching (Read)
  const { 
    data: policies, 
    isLoading, 
    isError, 
    error, 
    refetch,
    isRefetching,
  } = trpc.policies.list.useQuery(
    // Assuming the tRPC query can take an input object for server-side filtering/search
    // For now, we pass an empty object and do client-side filtering
    {}, 
    {
      // Example of react-query options
      staleTime: 1000 * 60 * 5, // 5 minutes
      onError: (err) => {
        showToast(`Failed to load policies: ${err.message}`, true);
      }
    }
  );

  // 2. tRPC Mutation (Delete) - for CRUD demonstration
  const deletePolicyMutation = trpc.policies.delete.useMutation({
    onSuccess: () => {
      refetch(); // Refetch policies after successful deletion
      showToast('Policy deleted successfully.');
    },
    onError: (err) => {
      showToast(`Error deleting policy: ${err.message}`, true);
    },
  });

  const handleDelete = (policyId: string) => {
    deletePolicyMutation.mutate({ id: policyId });
  };

  // Client-side filtering and search
  const filteredPolicies = useMemo(() => {
    if (!policies) return [];
    return policies
      .filter(p => filter === 'all' || p.status === filter)
      .filter(p => p.holderName.toLowerCase().includes(searchQuery.toLowerCase()) || p.policyNumber.includes(searchQuery));
  }, [policies, filter, searchQuery]);

  const renderPolicy = ({ item }: { item: Policy }) => (
    <Card 
      style={styles.card} 
      onPress={() => navigation.navigate('PolicyDetails', { policyId: item.id })}
    >
      <Card.Content style={styles.cardContent}>
        <View style={styles.textContainer}>
          <Title>{item.holderName}</Title>
          <Paragraph>Policy #: {item.policyNumber}</Paragraph>
          <Paragraph>Type: {item.type.charAt(0).toUpperCase() + item.type.slice(1)}</Paragraph>
          <Paragraph>Status: <Text style={{ color: item.status === 'active' ? theme.colors.success : theme.colors.error }}>{item.status}</Text></Paragraph>
          <Paragraph>Premium: ${item.premium.toFixed(2)}</Paragraph>
        </View>
        <IconButton
          icon="delete"
          color={paperTheme.colors.error}
          onPress={() => handleDelete(item.id)}
          disabled={deletePolicyMutation.isLoading}
        />
      </Card.Content>
    </Card>
  );

  const renderContent = () => {
    if (isLoading) {
      return <ActivityIndicator animating={true} size="large" style={styles.loading} color={paperTheme.colors.primary} />;
    }

    if (isError && !policies) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            An error occurred: {error?.message || 'Unknown error'}
          </Text>
          <Button mode="contained" onPress={() => refetch()} style={styles.retryButton}>
            Try Again
          </Button>
        </View>
      );
    }

    return (
      <FlatList
        data={filteredPolicies}
        renderItem={renderPolicy}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl 
            refreshing={isRefetching} 
            onRefresh={refetch} 
            colors={[paperTheme.colors.primary]}
          />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {searchQuery || filter !== 'all' ? 'No policies match your criteria.' : 'No policies found. Tap + to create one.'}
          </Text>
        }
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: paperTheme.colors.background }]}>
      <Appbar.Header>
        <Appbar.Content title="Policies" />
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={<Appbar.Action icon="filter-variant" onPress={() => setMenuVisible(true)} />}>
          <Menu.Item onPress={() => { setFilter('all'); setMenuVisible(false); }} title="All" />
          <Divider />
          <Menu.Item onPress={() => { setFilter('active'); setMenuVisible(false); }} title="Active" />
          <Menu.Item onPress={() => { setFilter('expired'); setMenuVisible(false); }} title="Expired" />
          <Menu.Item onPress={() => { setFilter('cancelled'); setMenuVisible(false); }} title="Cancelled" />
        </Menu>
      </Appbar.Header>
      
      <TextInput
        label="Search Policies"
        value={searchQuery}
        onChangeText={setSearchQuery}
        mode="outlined"
        style={styles.searchInput}
        left={<TextInput.Icon icon="magnify" />}
      />

      {renderContent()}

      <FAB
        style={[styles.fab, { backgroundColor: paperTheme.colors.accent }]}
        icon="plus"
        label="New Policy"
        onPress={() => navigation.navigate('CreatePolicy')}
      />

      {/* Toast Notification */}
      <Snackbar
        visible={!!toastMessage}
        onDismiss={() => setToastMessage(null)}
        duration={3000}
        style={{ backgroundColor: isErrorToast ? paperTheme.colors.error : paperTheme.colors.primary }}
        action={{
          label: 'Dismiss',
          onPress: () => setToastMessage(null),
        }}>
        {toastMessage}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchInput: {
    margin: 8,
  },
  listContent: {
    paddingBottom: 80, // Space for FAB
  },
  card: {
    marginHorizontal: 8,
    marginVertical: 4,
    elevation: 2,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 0, // Adjust padding for IconButton
  },
  textContainer: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    textAlign: 'center',
    marginBottom: 10,
    color: theme.colors.error,
  },
  retryButton: {
    marginTop: 10,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
    color: theme.colors.placeholder,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});

export default PoliciesScreen;
