import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';

interface FraudCase {
  id: string;
  transaction_id: string;
  user_id: string;
  amount: number;
  risk_score: number;
  status: 'open' | 'investigating' | 'resolved' | 'escalated';
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  assigned_to?: string;
  notes: CaseNote[];
  evidence: Evidence[];
  timeline: TimelineEvent[];
}

interface CaseNote {
  id: string;
  investigator: string;
  content: string;
  timestamp: string;
}

interface Evidence {
  id: string;
  type: 'screenshot' | 'document' | 'log' | 'video';
  url: string;
  description: string;
  collected_at: string;
}

interface TimelineEvent {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export default function FraudInvestigationScreen() {
  const colors = useColors();
  const [cases, setCases] = useState<FraudCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<FraudCase | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCases();
  }, [filterStatus]);

  const loadCases = async () => {
    setLoading(true);
    try {
      // In production, fetch from API
      // const response = await fetch(`/api/fraud/cases?status=${filterStatus}`);
      // const data = await response.json();
      
      // Mock data for demonstration
      const mockCases: FraudCase[] = [
        {
          id: 'CASE-001',
          transaction_id: 'TXN-12345',
          user_id: 'USER-789',
          amount: 5000,
          risk_score: 92,
          status: 'investigating',
          priority: 'critical',
          created_at: new Date().toISOString(),
          assigned_to: 'John Investigator',
          notes: [
            {
              id: 'NOTE-1',
              investigator: 'John Investigator',
              content: 'Suspicious transaction pattern detected. User logged in from new device.',
              timestamp: new Date().toISOString(),
            },
          ],
          evidence: [
            {
              id: 'EV-1',
              type: 'log',
              url: '/evidence/login-logs.json',
              description: 'Login attempt logs showing new device',
              collected_at: new Date().toISOString(),
            },
          ],
          timeline: [
            {
              id: 'TL-1',
              type: 'transaction_initiated',
              description: 'Large transfer initiated from new device',
              timestamp: new Date(Date.now() - 3600000).toISOString(),
            },
            {
              id: 'TL-2',
              type: 'fraud_flag',
              description: 'Automatic fraud detection flagged transaction',
              timestamp: new Date(Date.now() - 3000000).toISOString(),
            },
            {
              id: 'TL-3',
              type: 'case_created',
              description: 'Investigation case created',
              timestamp: new Date(Date.now() - 2400000).toISOString(),
            },
          ],
        },
        {
          id: 'CASE-002',
          transaction_id: 'TXN-12346',
          user_id: 'USER-790',
          amount: 2500,
          risk_score: 78,
          status: 'open',
          priority: 'high',
          created_at: new Date(Date.now() - 7200000).toISOString(),
          notes: [],
          evidence: [],
          timeline: [],
        },
      ];

      setCases(mockCases);
    } catch (error) {
      Alert.alert('Error', 'Failed to load fraud cases');
    } finally {
      setLoading(false);
    }
  };

  const addNote = async () => {
    if (!selectedCase || !newNote.trim()) return;

    const note: CaseNote = {
      id: `NOTE-${Date.now()}`,
      investigator: 'Current User',  // Replace with actual user
      content: newNote,
      timestamp: new Date().toISOString(),
    };

    // Update case with new note
    const updatedCase = {
      ...selectedCase,
      notes: [...selectedCase.notes, note],
    };

    setSelectedCase(updatedCase);
    setCases(cases.map(c => c.id === updatedCase.id ? updatedCase : c));
    setNewNote('');
    setShowNoteModal(false);

    // In production, save to API
    // await fetch(`/api/fraud/cases/${selectedCase.id}/notes`, {
    //   method: 'POST',
    //   body: JSON.stringify(note),
    // });
  };

  const updateCaseStatus = async (caseId: string, newStatus: FraudCase['status']) => {
    setCases(cases.map(c => 
      c.id === caseId ? { ...c, status: newStatus } : c
    ));

    if (selectedCase?.id === caseId) {
      setSelectedCase({ ...selectedCase, status: newStatus });
    }

    // In production, update via API
    // await fetch(`/api/fraud/cases/${caseId}/status`, {
    //   method: 'PATCH',
    //   body: JSON.stringify({ status: newStatus }),
    // });
  };

  const escalateCase = async (caseId: string) => {
    Alert.alert(
      'Escalate Case',
      'Are you sure you want to escalate this case to law enforcement?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Escalate',
          style: 'destructive',
          onPress: async () => {
            await updateCaseStatus(caseId, 'escalated');
            Alert.alert('Success', 'Case escalated to law enforcement');
            
            // In production, trigger escalation workflow
            // await fetch(`/api/fraud/cases/${caseId}/escalate`, { method: 'POST' });
          },
        },
      ]
    );
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return '#EF4444';
      case 'high': return '#F59E0B';
      case 'medium': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return '#3B82F6';
      case 'investigating': return '#F59E0B';
      case 'resolved': return '#10B981';
      case 'escalated': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const renderCaseCard = ({ item }: { item: FraudCase }) => (
    <TouchableOpacity
      onPress={() => setSelectedCase(item)}
      style={{
        backgroundColor: colors.surface,
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: getPriorityColor(item.priority),
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground }}>
          {item.id}
        </Text>
        <View style={{
          backgroundColor: getStatusColor(item.status),
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 12,
        }}>
          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 4 }}>
        Transaction: {item.transaction_id}
      </Text>
      <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 4 }}>
        User: {item.user_id}
      </Text>
      <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 8 }}>
        Amount: ${item.amount.toLocaleString()}
      </Text>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>
          Risk Score: {item.risk_score}%
        </Text>
        <Text style={{ fontSize: 12, color: colors.muted }}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>

      {item.assigned_to && (
        <Text style={{ fontSize: 12, color: colors.muted, marginTop: 8 }}>
          Assigned to: {item.assigned_to}
        </Text>
      )}
    </TouchableOpacity>
  );

  if (selectedCase) {
    return (
      <ScreenContainer>
        <ScrollView style={{ flex: 1 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <TouchableOpacity
              onPress={() => setSelectedCase(null)}
              style={{ marginRight: 16 }}
            >
              <Text style={{ fontSize: 24, color: colors.primary }}>←</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.foreground }}>
              {selectedCase.id}
            </Text>
          </View>

          {/* Case Details */}
          <View style={{ backgroundColor: colors.surface, padding: 16, borderRadius: 12, marginBottom: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.foreground, marginBottom: 12 }}>
              Case Details
            </Text>
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.foreground }}>
                <Text style={{ fontWeight: '600' }}>Transaction:</Text> {selectedCase.transaction_id}
              </Text>
              <Text style={{ color: colors.foreground }}>
                <Text style={{ fontWeight: '600' }}>User:</Text> {selectedCase.user_id}
              </Text>
              <Text style={{ color: colors.foreground }}>
                <Text style={{ fontWeight: '600' }}>Amount:</Text> ${selectedCase.amount.toLocaleString()}
              </Text>
              <Text style={{ color: colors.foreground }}>
                <Text style={{ fontWeight: '600' }}>Risk Score:</Text> {selectedCase.risk_score}%
              </Text>
              <Text style={{ color: colors.foreground }}>
                <Text style={{ fontWeight: '600' }}>Priority:</Text> {selectedCase.priority.toUpperCase()}
              </Text>
              <Text style={{ color: colors.foreground }}>
                <Text style={{ fontWeight: '600' }}>Status:</Text> {selectedCase.status.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Timeline */}
          <View style={{ backgroundColor: colors.surface, padding: 16, borderRadius: 12, marginBottom: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.foreground, marginBottom: 12 }}>
              Timeline
            </Text>
            {selectedCase.timeline.map((event, index) => (
              <View key={event.id} style={{ marginBottom: 12, paddingLeft: 16, borderLeftWidth: 2, borderLeftColor: colors.border }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>
                  {event.type.replace(/_/g, ' ').toUpperCase()}
                </Text>
                <Text style={{ fontSize: 14, color: colors.muted, marginTop: 4 }}>
                  {event.description}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
                  {new Date(event.timestamp).toLocaleString()}
                </Text>
              </View>
            ))}
          </View>

          {/* Notes */}
          <View style={{ backgroundColor: colors.surface, padding: 16, borderRadius: 12, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: '600', color: colors.foreground }}>
                Investigation Notes
              </Text>
              <TouchableOpacity
                onPress={() => setShowNoteModal(true)}
                style={{ backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Add Note</Text>
              </TouchableOpacity>
            </View>
            {selectedCase.notes.map(note => (
              <View key={note.id} style={{ marginBottom: 12, padding: 12, backgroundColor: colors.background, borderRadius: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>
                  {note.investigator}
                </Text>
                <Text style={{ fontSize: 14, color: colors.foreground, marginTop: 4 }}>
                  {note.content}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
                  {new Date(note.timestamp).toLocaleString()}
                </Text>
              </View>
            ))}
          </View>

          {/* Actions */}
          <View style={{ gap: 12, marginBottom: 32 }}>
            <TouchableOpacity
              onPress={() => updateCaseStatus(selectedCase.id, 'investigating')}
              style={{ backgroundColor: colors.primary, padding: 16, borderRadius: 12 }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
                Mark as Investigating
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => updateCaseStatus(selectedCase.id, 'resolved')}
              style={{ backgroundColor: '#10B981', padding: 16, borderRadius: 12 }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
                Resolve Case
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => escalateCase(selectedCase.id)}
              style={{ backgroundColor: '#EF4444', padding: 16, borderRadius: 12 }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
                Escalate to Law Enforcement
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Add Note Modal */}
        <Modal
          visible={showNoteModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowNoteModal(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.foreground, marginBottom: 16 }}>
                Add Investigation Note
              </Text>
              
              <TextInput
                value={newNote}
                onChangeText={setNewNote}
                placeholder="Enter your investigation notes..."
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={6}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  padding: 12,
                  color: colors.foreground,
                  fontSize: 16,
                  marginBottom: 16,
                  textAlignVertical: 'top',
                }}
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  onPress={() => setShowNoteModal(false)}
                  style={{ flex: 1, backgroundColor: colors.surface, padding: 16, borderRadius: 12 }}
                >
                  <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={addNote}
                  style={{ flex: 1, backgroundColor: colors.primary, padding: 16, borderRadius: 12 }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
                    Add Note
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.foreground, marginBottom: 8 }}>
          Fraud Investigation
        </Text>
        <Text style={{ fontSize: 16, color: colors.muted, marginBottom: 20 }}>
          Review and investigate flagged transactions
        </Text>

        {/* Search */}
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search cases..."
          placeholderTextColor={colors.muted}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 12,
            color: colors.foreground,
            fontSize: 16,
            marginBottom: 16,
          }}
        />

        {/* Status Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {['all', 'open', 'investigating', 'resolved', 'escalated'].map(status => (
            <TouchableOpacity
              key={status}
              onPress={() => setFilterStatus(status)}
              style={{
                backgroundColor: filterStatus === status ? colors.primary : colors.surface,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                marginRight: 8,
              }}
            >
              <Text style={{
                color: filterStatus === status ? '#FFFFFF' : colors.foreground,
                fontWeight: '600',
              }}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Cases List */}
        <FlatList
          data={cases.filter(c => 
            filterStatus === 'all' || c.status === filterStatus
          )}
          renderItem={renderCaseCard}
          keyExtractor={item => item.id}
          refreshing={loading}
          onRefresh={loadCases}
          ListEmptyComponent={
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ fontSize: 16, color: colors.muted }}>
                No cases found
              </Text>
            </View>
          }
        />
      </View>
    </ScreenContainer>
  );
}
