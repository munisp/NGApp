import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Card, Button, Avatar, Badge, Searchbar } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSelector, useDispatch } from 'react-redux';

interface Agent {
  id: string;
  name: string;
  email: string;
  phone: string;
  tier: string;
  status: string;
  parent_id: string | null;
  territory: string;
  commission_balance: number;
  total_transactions: number;
  children: Agent[];
  created_at: string;
}

interface AgentHierarchyScreenProps {
  navigation: any;
}

const AgentHierarchyScreen: React.FC<AgentHierarchyScreenProps> = ({ navigation }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [filteredAgents, setFilteredAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());

  const dispatch = useDispatch();
  const { user } = useSelector((state: any) => state.auth);

  useEffect(() => {
    loadAgentHierarchy();
  }, []);

  useEffect(() => {
    filterAgents();
  }, [searchQuery, agents]);

  const getApiUrl = () => {
    // Use environment variable or default to production URL
    return process.env.REACT_APP_API_URL || 'http://localhost:8111';
  };

  const getAuthToken = async () => {
    // Get token from secure storage
    try {
      const token = await AsyncStorage.getItem('auth_token');
      return token;
    } catch (error) {
      console.error('Failed to get auth token:', error);
      return null;
    }
  };

  const loadAgentHierarchy = async () => {
    setLoading(true);
    try {
      const token = await getAuthToken();
      const apiUrl = getApiUrl();
      
      // Call the agent management service API
      const response = await fetch(`${apiUrl}/api/v1/agents/hierarchy`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const agentList: Agent[] = data.agents || data;

      // Build hierarchy structure from flat list
      const hierarchyMap = new Map<string, Agent>();
      agentList.forEach(agent => {
        hierarchyMap.set(agent.id, { ...agent, children: [] });
      });

      const rootAgents: Agent[] = [];
      hierarchyMap.forEach(agent => {
        if (agent.parent_id) {
          const parent = hierarchyMap.get(agent.parent_id);
          if (parent) {
            parent.children.push(agent);
          }
        } else {
          rootAgents.push(agent);
        }
      });

      setAgents(rootAgents);
      setFilteredAgents(rootAgents);
    } catch (error) {
      console.error('Failed to load agent hierarchy:', error);
      Alert.alert('Error', 'Failed to load agent hierarchy. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const filterAgents = () => {
    if (!searchQuery.trim()) {
      setFilteredAgents(agents);
      return;
    }

    const filterRecursive = (agentList: Agent[]): Agent[] => {
      return agentList.reduce((filtered: Agent[], agent) => {
        const matchesSearch = 
          agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          agent.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          agent.territory.toLowerCase().includes(searchQuery.toLowerCase()) ||
          agent.tier.toLowerCase().includes(searchQuery.toLowerCase());

        const filteredChildren = filterRecursive(agent.children);

        if (matchesSearch || filteredChildren.length > 0) {
          filtered.push({
            ...agent,
            children: filteredChildren
          });
        }

        return filtered;
      }, []);
    };

    setFilteredAgents(filterRecursive(agents));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAgentHierarchy();
    setRefreshing(false);
  };

  const toggleAgentExpansion = (agentId: string) => {
    const newExpanded = new Set(expandedAgents);
    if (newExpanded.has(agentId)) {
      newExpanded.delete(agentId);
    } else {
      newExpanded.add(agentId);
    }
    setExpandedAgents(newExpanded);
  };

  const getTierColor = (tier: string): string => {
    switch (tier) {
      case 'Super Agent': return '#FF6B6B';
      case 'Regional Agent': return '#4ECDC4';
      case 'Field Agent': return '#45B7D1';
      case 'Sub Agent': return '#96CEB4';
      default: return '#95A5A6';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active': return '#2ECC71';
      case 'inactive': return '#E74C3C';
      case 'suspended': return '#F39C12';
      default: return '#95A5A6';
    }
  };

  const renderAgent = (agent: Agent, level: number = 0) => {
    const isExpanded = expandedAgents.has(agent.id);
    const hasChildren = agent.children.length > 0;

    return (
      <View key={agent.id} style={[styles.agentContainer, { marginLeft: level * 20 }]}>
        <Card style={styles.agentCard}>
          <TouchableOpacity
            onPress={() => {
              setSelectedAgent(agent);
              setShowAgentModal(true);
            }}
            onLongPress={() => {
              if (hasChildren) {
                toggleAgentExpansion(agent.id);
              }
            }}
          >
            <View style={styles.agentHeader}>
              <View style={styles.agentInfo}>
                <Avatar.Text
                  size={40}
                  label={agent.name.split(' ').map(n => n[0]).join('')}
                  style={{ backgroundColor: getTierColor(agent.tier) }}
                />
                <View style={styles.agentDetails}>
                  <Text style={styles.agentName}>{agent.name}</Text>
                  <Text style={styles.agentEmail}>{agent.email}</Text>
                  <Text style={styles.agentTerritory}>{agent.territory}</Text>
                </View>
              </View>
              <View style={styles.agentMetrics}>
                <Badge style={[styles.tierBadge, { backgroundColor: getTierColor(agent.tier) }]}>
                  {agent.tier}
                </Badge>
                <Badge style={[styles.statusBadge, { backgroundColor: getStatusColor(agent.status) }]}>
                  {agent.status}
                </Badge>
                <Text style={styles.commissionText}>
                  ${agent.commission_balance.toLocaleString()}
                </Text>
                <Text style={styles.transactionText}>
                  {agent.total_transactions} txns
                </Text>
              </View>
              {hasChildren && (
                <TouchableOpacity
                  onPress={() => toggleAgentExpansion(agent.id)}
                  style={styles.expandButton}
                >
                  <Icon
                    name={isExpanded ? 'expand-less' : 'expand-more'}
                    size={24}
                    color="#666"
                  />
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </Card>

        {isExpanded && hasChildren && (
          <View style={styles.childrenContainer}>
            {agent.children.map(child => renderAgent(child, level + 1))}
          </View>
        )}
      </View>
    );
  };

  const renderFlatAgent = ({ item }: { item: Agent }) => {
    return renderAgent(item);
  };

  const AgentDetailModal = () => (
    <Modal
      visible={showAgentModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowAgentModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Agent Details</Text>
          <TouchableOpacity onPress={() => setShowAgentModal(false)}>
            <Icon name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        {selectedAgent && (
          <ScrollView style={styles.modalContent}>
            <View style={styles.agentProfileSection}>
              <Avatar.Text
                size={80}
                label={selectedAgent.name.split(' ').map(n => n[0]).join('')}
                style={{ backgroundColor: getTierColor(selectedAgent.tier) }}
              />
              <Text style={styles.modalAgentName}>{selectedAgent.name}</Text>
              <Badge style={[styles.modalTierBadge, { backgroundColor: getTierColor(selectedAgent.tier) }]}>
                {selectedAgent.tier}
              </Badge>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Contact Information</Text>
              <View style={styles.detailRow}>
                <Icon name="email" size={20} color="#666" />
                <Text style={styles.detailText}>{selectedAgent.email}</Text>
              </View>
              <View style={styles.detailRow}>
                <Icon name="phone" size={20} color="#666" />
                <Text style={styles.detailText}>{selectedAgent.phone}</Text>
              </View>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Territory & Performance</Text>
              <View style={styles.detailRow}>
                <Icon name="location-on" size={20} color="#666" />
                <Text style={styles.detailText}>{selectedAgent.territory}</Text>
              </View>
              <View style={styles.detailRow}>
                <Icon name="account-balance-wallet" size={20} color="#666" />
                <Text style={styles.detailText}>
                  Commission: ${selectedAgent.commission_balance.toLocaleString()}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Icon name="trending-up" size={20} color="#666" />
                <Text style={styles.detailText}>
                  Transactions: {selectedAgent.total_transactions}
                </Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <Button
                mode="contained"
                onPress={() => {
                  setShowAgentModal(false);
                  navigation.navigate('AgentProfile', { agentId: selectedAgent.id });
                }}
                style={styles.actionButton}
              >
                View Full Profile
              </Button>
              <Button
                mode="outlined"
                onPress={() => {
                  setShowAgentModal(false);
                  navigation.navigate('CommissionDetails', { agentId: selectedAgent.id });
                }}
                style={styles.actionButton}
              >
                Commission Details
              </Button>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Agent Hierarchy</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('AddAgent')}
          style={styles.addButton}
        >
          <Icon name="person-add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <Searchbar
        placeholder="Search agents..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
      />

      <FlatList
        data={filteredAgents}
        renderItem={renderFlatAgent}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />

      <AgentDetailModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  addButton: {
    backgroundColor: '#3498DB',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBar: {
    margin: 15,
    elevation: 2,
  },
  listContainer: {
    padding: 15,
  },
  agentContainer: {
    marginBottom: 10,
  },
  agentCard: {
    elevation: 2,
    backgroundColor: '#FFF',
  },
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  agentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  agentDetails: {
    marginLeft: 15,
    flex: 1,
  },
  agentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  agentEmail: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 2,
  },
  agentTerritory: {
    fontSize: 12,
    color: '#95A5A6',
    marginTop: 2,
  },
  agentMetrics: {
    alignItems: 'flex-end',
  },
  tierBadge: {
    marginBottom: 5,
  },
  statusBadge: {
    marginBottom: 5,
  },
  commissionText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#27AE60',
    marginTop: 5,
  },
  transactionText: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 2,
  },
  expandButton: {
    marginLeft: 10,
  },
  childrenContainer: {
    borderLeftWidth: 2,
    borderLeftColor: '#E9ECEF',
    marginLeft: 10,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  agentProfileSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  modalAgentName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 15,
    marginBottom: 10,
  },
  modalTierBadge: {
    paddingHorizontal: 15,
    paddingVertical: 5,
  },
  detailSection: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailText: {
    fontSize: 16,
    color: '#34495E',
    marginLeft: 15,
  },
  modalActions: {
    marginTop: 20,
  },
  actionButton: {
    marginBottom: 10,
  },
});

export default AgentHierarchyScreen;
