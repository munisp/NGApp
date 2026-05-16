import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Text as SvgText, G } from 'react-native-svg';

interface GraphNode {
  id: string;
  type: 'customer' | 'policy' | 'claim' | 'agent';
  label: string;
  riskScore?: number;
  x: number;
  y: number;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

const nodeColors: Record<string, string> = {
  customer: '#3B82F6',
  policy: '#10B981',
  claim: '#F59E0B',
  agent: '#8B5CF6',
};

const { width: screenWidth } = Dimensions.get('window');

export default function KnowledgeGraphScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);

  useEffect(() => {
    loadGraphData();
  }, []);

  const loadGraphData = async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const mockNodes: GraphNode[] = [
      { id: 'cust_001', type: 'customer', label: 'Adebayo O.', riskScore: 0.15, x: 100, y: 80 },
      { id: 'cust_002', type: 'customer', label: 'Chioma E.', riskScore: 0.72, x: 200, y: 60 },
      { id: 'pol_001', type: 'policy', label: 'Life #1001', x: 80, y: 160 },
      { id: 'pol_002', type: 'policy', label: 'Auto #2001', x: 220, y: 140 },
      { id: 'claim_001', type: 'claim', label: 'Claim #C001', riskScore: 0.85, x: 150, y: 220 },
      { id: 'agent_001', type: 'agent', label: 'Lagos Branch', x: 280, y: 100 },
    ];

    const mockEdges: GraphEdge[] = [
      { source: 'cust_001', target: 'pol_001', type: 'HAS_POLICY' },
      { source: 'cust_002', target: 'pol_002', type: 'HAS_POLICY' },
      { source: 'pol_001', target: 'claim_001', type: 'HAS_CLAIM' },
      { source: 'cust_001', target: 'agent_001', type: 'MANAGED_BY' },
      { source: 'cust_002', target: 'agent_001', type: 'MANAGED_BY' },
      { source: 'cust_001', target: 'cust_002', type: 'SHARES_ADDRESS' },
    ];

    setNodes(mockNodes);
    setEdges(mockEdges);
    setLoading(false);
  };

  const getRiskBadgeColor = (score?: number) => {
    if (!score) return '#6B7280';
    if (score > 0.7) return '#EF4444';
    if (score > 0.4) return '#F59E0B';
    return '#10B981';
  };

  const filteredNodes = nodes.filter(node =>
    searchQuery === '' ||
    node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    node.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Knowledge Graph</Text>
        <Text style={styles.subtitle}>Explore Insurance Relationships</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search entities..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#9CA3AF"
        />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading graph data...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          <View style={styles.graphContainer}>
            <Svg width={screenWidth - 32} height={280}>
              {edges.map((edge, idx) => {
                const sourceNode = filteredNodes.find(n => n.id === edge.source);
                const targetNode = filteredNodes.find(n => n.id === edge.target);
                if (!sourceNode || !targetNode) return null;

                const isSuspicious = edge.type.includes('SHARES');

                return (
                  <Line
                    key={idx}
                    x1={sourceNode.x}
                    y1={sourceNode.y}
                    x2={targetNode.x}
                    y2={targetNode.y}
                    stroke={isSuspicious ? '#EF4444' : '#94A3B8'}
                    strokeWidth={isSuspicious ? 2 : 1}
                    strokeDasharray={isSuspicious ? '5,5' : undefined}
                  />
                );
              })}

              {filteredNodes.map(node => (
                <G key={node.id} onPress={() => setSelectedNode(node)}>
                  <Circle
                    cx={node.x}
                    cy={node.y}
                    r={25}
                    fill={nodeColors[node.type]}
                    stroke={selectedNode?.id === node.id ? '#1E40AF' : '#fff'}
                    strokeWidth={selectedNode?.id === node.id ? 3 : 2}
                  />
                  <SvgText
                    x={node.x}
                    y={node.y + 40}
                    fontSize="10"
                    fill="#374151"
                    textAnchor="middle"
                  >
                    {node.label}
                  </SvgText>
                  {node.riskScore && node.riskScore > 0.5 && (
                    <Circle
                      cx={node.x + 18}
                      cy={node.y - 18}
                      r={8}
                      fill={getRiskBadgeColor(node.riskScore)}
                    />
                  )}
                </G>
              ))}
            </Svg>
          </View>

          <View style={styles.legend}>
            {Object.entries(nodeColors).map(([type, color]) => (
              <View key={type} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: color }]} />
                <Text style={styles.legendText}>{type}</Text>
              </View>
            ))}
          </View>

          {selectedNode && (
            <View style={styles.detailsCard}>
              <Text style={styles.detailsTitle}>Entity Details</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>ID:</Text>
                <Text style={styles.detailValue}>{selectedNode.id}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Type:</Text>
                <View style={[styles.typeBadge, { backgroundColor: nodeColors[selectedNode.type] }]}>
                  <Text style={styles.typeBadgeText}>{selectedNode.type}</Text>
                </View>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Label:</Text>
                <Text style={styles.detailValue}>{selectedNode.label}</Text>
              </View>
              {selectedNode.riskScore !== undefined && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Risk Score:</Text>
                  <View style={[styles.riskBadge, { backgroundColor: getRiskBadgeColor(selectedNode.riskScore) }]}>
                    <Text style={styles.riskBadgeText}>{(selectedNode.riskScore * 100).toFixed(0)}%</Text>
                  </View>
                </View>
              )}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Connections:</Text>
                <Text style={styles.detailValue}>
                  {edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).length}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>Graph Statistics</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{nodes.length}</Text>
                <Text style={styles.statLabel}>Nodes</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{edges.length}</Text>
                <Text style={styles.statLabel}>Edges</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#EF4444' }]}>
                  {nodes.filter(n => (n.riskScore || 0) > 0.7).length}
                </Text>
                <Text style={styles.statLabel}>High Risk</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#fff',
  },
  searchInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  graphContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginVertical: 4,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 4,
  },
  legendText: {
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  riskBadgeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
});
