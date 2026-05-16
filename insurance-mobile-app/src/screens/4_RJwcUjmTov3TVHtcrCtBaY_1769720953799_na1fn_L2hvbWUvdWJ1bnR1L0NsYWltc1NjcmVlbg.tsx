import React, { useState, useCallback, useMemo } from 'react';
import { View, FlatList, StyleSheet, Alert } from 'react-native';
import {
  Appbar,
  Searchbar,
  ActivityIndicator,
  Text,
  Button,
  Card,
  Title,
  Paragraph,
  Menu,
  Divider,
  IconButton,
  Portal,
  Dialog,
  Provider as PaperProvider,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Mock imports for tRPC and theme
// In a real app, these would be configured elsewhere
const trpc = {
  claims: {
    list: {
      useQuery: (query: ClaimsListQuery) => {
        // Mock data generation based on query
        const mockClaims: Claim[] = [
          { id: 'C001', policyNumber: 'P1001', claimNumber: 'CL-2024-001', status: 'Pending', dateFiled: '2024-01-15T10:00:00Z', amount: 1500.50, description: 'Windshield replacement' },
          { id: 'C002', policyNumber: 'P1002', claimNumber: 'CL-2024-002', status: 'Approved', dateFiled: '2024-01-18T12:30:00Z', amount: 5000.00, description: 'Minor car accident' },
          { id: 'C003', policyNumber: 'P1003', claimNumber: 'CL-2024-003', status: 'Rejected', dateFiled: '2024-01-20T15:45:00Z', amount: 250.00, description: 'Lost item' },
          { id: 'C004', policyNumber: 'P1004', claimNumber: 'CL-2024-004', status: 'Closed', dateFiled: '2024-01-22T09:00:00Z', amount: 12000.75, description: 'Major home damage' },
          { id: 'C005', policyNumber: 'P1005', claimNumber: 'CL-2024-005', status: 'Pending', dateFiled: '2024-01-25T11:20:00Z', amount: 800.00, description: 'Theft report' },
        ].filter(claim => {
          const matchesSearch = !query.search || claim.description.toLowerCase().includes(query.search.toLowerCase()) || claim.claimNumber.toLowerCase().includes(query.search.toLowerCase());
          const matchesStatus = query.status === 'All' || !query.status || claim.status === query.status;
          return matchesSearch && matchesStatus;
        });

        return {
          data: mockClaims,
          isLoading: false, // Mock loading state
          isError: false, // Mock error state
          error: null,
          refetch: () => console.log('Mock refetch called'),
          isRefetching: false,
        };
      },
    },
    delete: {
      useMutation: () => {
        return {
          mutate: (id: string) => console.log(\`Mock delete claim \${id}\`),
          isPending: false,
          isError: false,
          isSuccess: false,
        };
      },
    },
    // Mock for other CRUD operations
    create: { useMutation: () => ({ mutate: (data: any) => console.log('Mock create', data), isPending: false }) },
    update: { useMutation: () => ({ mutate: (data: any) => console.log('Mock update', data), isPending: false }) },
  },
};

const theme = {
  colors: {
    primary: '#007AFF', // Blue
    accent: '#FF9500', // Orange
    error: '#FF3B30', // Red
    background: '#F2F2F7', // Light Gray
    surface: '#FFFFFF', // White
    text: '#000000', // Black
  },
};

// --- Type Definitions ---

type ClaimStatus = 'Pending' | 'Approved' | 'Rejected' | 'Closed';

interface Claim {
  id: string;
  policyNumber: string;
  claimNumber: string;
  status: ClaimStatus;
  dateFiled: string; // ISO date string
  amount: number;
  description: string;
}

interface ClaimsListQuery {
  search?: string;
  status?: ClaimStatus | 'All';
}

// Mock Toast Notification
const showToast = (message: string, type: 'success' | 'error' | 'info') => {
  console.log(\`TOAST (\${type}): \${message}\`);
  // In a real app, this would trigger a global toast component
};

// --- Component: ClaimItem ---

interface ClaimItemProps {
  claim: Claim;
  onDelete: (id: string) => void;
  onViewDetails: (claim: Claim) => void;
}

const ClaimItem: React.FC<ClaimItemProps> = React.memo(({ claim, onDelete, onViewDetails }) => {
  const [menuVisible, setMenuVisible] = useState(false);
  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  const statusColor = useMemo(() => {
    switch (claim.status) {
      case 'Pending': return theme.colors.accent;
      case 'Approved': return theme.colors.primary;
      case 'Rejected': return theme.colors.error;
      case 'Closed': return theme.colors.text;
      default: return theme.colors.text;
    }
  }, [claim.status]);

  const handleDelete = () => {
    closeMenu();
    Alert.alert(
      'Confirm Deletion',
      \`Are you sure you want to delete claim \${claim.claimNumber}?\`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(claim.id) },
      ],
    );
  };

  return (
    <Card style={styles.card} onPress={() => onViewDetails(claim)}>
      <Card.Content style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Title style={styles.claimNumber}>{claim.claimNumber}</Title>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{claim.status}</Text>
          </View>
        </View>
        <Paragraph>Policy: {claim.policyNumber}</Paragraph>
        <Paragraph numberOfLines={1}>Description: {claim.description}</Paragraph>
        <Paragraph>Amount: \${claim.amount.toFixed(2)}</Paragraph>
        <Paragraph style={styles.dateText}>Filed: {new Date(claim.dateFiled).toLocaleDateString()}</Paragraph>
      </Card.Content>
      <Card.Actions>
        <Button onPress={() => onViewDetails(claim)}>Details</Button>
        <View style={styles.menuContainer}>
          <Menu
            visible={menuVisible}
            onDismiss={closeMenu}
            anchor={<IconButton icon="dots-vertical" onPress={openMenu} />}
          >
            <Menu.Item onPress={() => { closeMenu(); onViewDetails(claim); }} title="Edit Claim" />
            <Divider />
            <Menu.Item onPress={handleDelete} title="Delete Claim" />
          </Menu>
        </View>
      </Card.Actions>
    </Card>
  );
});

// --- Component: ClaimsScreen ---

const ClaimsScreen: React.FC = () => {
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<ClaimStatus | 'All'>('All');
  const [menuVisible, setMenuVisible] = useState(false);

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  const queryParams: ClaimsListQuery = useMemo(() => ({
    search: searchQuery.trim() || undefined,
    status: filterStatus,
  }), [searchQuery, filterStatus]);

  // tRPC useQuery for fetching claims list
  const { data: claims, isLoading, isError, error, refetch, isRefetching } = trpc.claims.list.useQuery(queryParams);

  // tRPC useMutation for deleting a claim
  const deleteMutation = trpc.claims.delete.useMutation({
    onSuccess: () => {
      showToast('Claim deleted successfully.', 'success');
      // Invalidate the claims list query to refetch data
      queryClient.invalidateQueries({ queryKey: ['claims', 'list'] });
    },
    onError: (err) => {
      showToast(\`Failed to delete claim: \${err.message}\`, 'error');
    },
  });

  // Ensure data is fresh when screen is focused (pull-to-refresh alternative on focus)
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleDeleteClaim = useCallback((id: string) => {
    deleteMutation.mutate(id);
  }, [deleteMutation]);

  const handleViewDetails = useCallback((claim: Claim) => {
    // Navigate to a hypothetical 'ClaimDetails' screen
    // In a real app, the route name would be defined in the navigator config
    navigation.navigate('ClaimDetails', { claimId: claim.id });
  }, [navigation]);

  const handleNewClaim = useCallback(() => {
    // Navigate to a hypothetical 'NewClaim' screen
    navigation.navigate('NewClaim');
  }, [navigation]);

  const renderItem = useCallback(({ item }: { item: Claim }) => (
    <ClaimItem
      claim={item}
      onDelete={handleDeleteClaim}
      onViewDetails={handleViewDetails}
    />
  ), [handleDeleteClaim, handleViewDetails]);

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No claims found.</Text>
      <Button mode="contained" onPress={handleNewClaim} style={styles.newClaimButton}>
        File New Claim
      </Button>
    </View>
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator animating={true} color={theme.colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading claims...</Text>
        </View>
      );
    }

    if (isError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error fetching claims: {error?.message || 'Unknown error'}</Text>
          <Button icon="refresh" mode="outlined" onPress={handleRefresh}>
            Try Again
          </Button>
        </View>
      );
    }

    return (
      <FlatList
        data={claims}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={claims?.length === 0 ? styles.listEmpty : styles.listContent}
        ListEmptyComponent={renderEmptyState}
        onRefresh={handleRefresh}
        refreshing={isRefetching}
      />
    );
  };

  return (
    <PaperProvider>
      <View style={styles.container}>
        <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
          <Appbar.Content title="My Claims" color={theme.colors.text} />
          <Appbar.Action icon="plus" onPress={handleNewClaim} color={theme.colors.primary} />
          <Menu
            visible={menuVisible}
            onDismiss={closeMenu}
            anchor={<Appbar.Action icon="filter-variant" onPress={openMenu} color={theme.colors.primary} />}
          >
            <Menu.Item onPress={() => { setFilterStatus('All'); closeMenu(); }} title="All Statuses" />
            <Divider />
            {['Pending', 'Approved', 'Rejected', 'Closed'].map(status => (
              <Menu.Item
                key={status}
                onPress={() => { setFilterStatus(status as ClaimStatus); closeMenu(); }}
                title={status}
                style={{ backgroundColor: filterStatus === status ? theme.colors.background : 'transparent' }}
              />
            ))}
          </Menu>
        </Appbar.Header>

        <Searchbar
          placeholder="Search by description or claim number"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          inputStyle={{ color: theme.colors.text }}
        />

        {renderContent()}
      </View>
      {/* Portal for Dialogs/Toasts if needed */}
      <Portal>
        {/* Hypothetical Dialog for New/Edit Claim */}
        <Dialog visible={false} onDismiss={() => {}}>
          <Dialog.Title>Claim Form</Dialog.Title>
          <Dialog.Content>
            <Text>This is where the New/Edit Claim form would go.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => {}}>Cancel</Button>
            <Button onPress={() => {}}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </PaperProvider>
  );
};

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  searchBar: {
    margin: 8,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
  },
  listContent: {
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    marginVertical: 4,
    borderRadius: 8,
    elevation: 2,
  },
  cardContent: {
    paddingBottom: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  claimNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    color: theme.colors.surface,
    fontSize: 12,
    fontWeight: 'bold',
  },
  dateText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  menuContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: theme.colors.text,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: theme.colors.error,
    textAlign: 'center',
    marginBottom: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    marginBottom: 20,
  },
  newClaimButton: {
    marginTop: 10,
  }
});

export default ClaimsScreen;
