import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  FlatList,
  Image,
  Modal,
  ActivityIndicator,
} from 'react-native';

// Types
interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  product: string;
  status: 'new' | 'contacted' | 'quoted' | 'converted' | 'lost';
  createdAt: Date;
  notes: string;
}

interface Policy {
  id: string;
  policyNumber: string;
  customerName: string;
  product: string;
  premium: number;
  commission: number;
  status: 'active' | 'pending' | 'expired';
  expiryDate: Date;
}

interface Commission {
  id: string;
  policyNumber: string;
  amount: number;
  status: 'pending' | 'paid';
  date: Date;
}

interface AgentStats {
  totalPolicies: number;
  activeLeads: number;
  monthlyCommission: number;
  conversionRate: number;
  renewalsDue: number;
}

// Main App Component
const AgentMobileApp: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<string>('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [agentStats, setAgentStats] = useState<AgentStats>({
    totalPolicies: 156,
    activeLeads: 23,
    monthlyCommission: 485000,
    conversionRate: 32.5,
    renewalsDue: 12,
  });

  const renderScreen = () => {
    switch (currentScreen) {
      case 'dashboard':
        return <DashboardScreen stats={agentStats} onNavigate={setCurrentScreen} />;
      case 'leads':
        return <LeadsScreen onNavigate={setCurrentScreen} />;
      case 'policies':
        return <PoliciesScreen onNavigate={setCurrentScreen} />;
      case 'quotes':
        return <QuotesScreen onNavigate={setCurrentScreen} />;
      case 'commissions':
        return <CommissionsScreen onNavigate={setCurrentScreen} />;
      case 'customers':
        return <CustomersScreen onNavigate={setCurrentScreen} />;
      case 'newLead':
        return <NewLeadScreen onNavigate={setCurrentScreen} />;
      case 'newQuote':
        return <NewQuoteScreen onNavigate={setCurrentScreen} />;
      default:
        return <DashboardScreen stats={agentStats} onNavigate={setCurrentScreen} />;
    }
  };

  return (
    <View style={styles.container}>
      <Header title={getScreenTitle(currentScreen)} />
      {renderScreen()}
      <BottomNavigation currentScreen={currentScreen} onNavigate={setCurrentScreen} />
    </View>
  );
};

// Header Component
const Header: React.FC<{ title: string }> = ({ title }) => (
  <View style={styles.header}>
    <Text style={styles.headerTitle}>{title}</Text>
    <TouchableOpacity style={styles.notificationButton}>
      <Text style={styles.notificationBadge}>3</Text>
    </TouchableOpacity>
  </View>
);

// Dashboard Screen
const DashboardScreen: React.FC<{ stats: AgentStats; onNavigate: (screen: string) => void }> = ({
  stats,
  onNavigate,
}) => (
  <ScrollView style={styles.screenContainer}>
    <View style={styles.welcomeCard}>
      <Text style={styles.welcomeText}>Welcome back, Agent!</Text>
      <Text style={styles.dateText}>{new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text>
    </View>

    <View style={styles.statsGrid}>
      <StatCard title="Total Policies" value={stats.totalPolicies.toString()} icon="📋" color="#4CAF50" />
      <StatCard title="Active Leads" value={stats.activeLeads.toString()} icon="👥" color="#2196F3" />
      <StatCard title="Monthly Commission" value={`₦${stats.monthlyCommission.toLocaleString()}`} icon="💰" color="#FF9800" />
      <StatCard title="Conversion Rate" value={`${stats.conversionRate}%`} icon="📈" color="#9C27B0" />
    </View>

    <View style={styles.quickActions}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionButtons}>
        <ActionButton title="New Lead" icon="➕" onPress={() => onNavigate('newLead')} />
        <ActionButton title="New Quote" icon="📝" onPress={() => onNavigate('newQuote')} />
        <ActionButton title="Scan Document" icon="📷" onPress={() => Alert.alert('Document Scanner', 'Opening camera...')} />
        <ActionButton title="Call Customer" icon="📞" onPress={() => Alert.alert('Dialer', 'Opening phone...')} />
      </View>
    </View>

    <View style={styles.alertsSection}>
      <Text style={styles.sectionTitle}>Alerts & Reminders</Text>
      <AlertCard type="warning" message={`${stats.renewalsDue} policies due for renewal this week`} />
      <AlertCard type="info" message="New product training available" />
      <AlertCard type="success" message="Commission payment processed - ₦125,000" />
    </View>

    <View style={styles.recentActivity}>
      <Text style={styles.sectionTitle}>Recent Activity</Text>
      <ActivityItem action="Policy Issued" details="Motor Insurance - ABC-123-XY" time="2 hours ago" />
      <ActivityItem action="Lead Converted" details="John Doe - Life Insurance" time="5 hours ago" />
      <ActivityItem action="Quote Sent" details="Fire Insurance - ₦2.5M coverage" time="Yesterday" />
    </View>
  </ScrollView>
);

// Leads Screen
const LeadsScreen: React.FC<{ onNavigate: (screen: string) => void }> = ({ onNavigate }) => {
  const [leads, setLeads] = useState<Lead[]>([
    { id: '1', name: 'Adebayo Johnson', phone: '08012345678', email: 'adebayo@email.com', product: 'Motor Insurance', status: 'new', createdAt: new Date(), notes: '' },
    { id: '2', name: 'Chioma Okafor', phone: '08098765432', email: 'chioma@email.com', product: 'Life Insurance', status: 'contacted', createdAt: new Date(), notes: '' },
    { id: '3', name: 'Ibrahim Musa', phone: '08055544433', email: 'ibrahim@email.com', product: 'Fire Insurance', status: 'quoted', createdAt: new Date(), notes: '' },
  ]);
  const [filter, setFilter] = useState<string>('all');

  const filteredLeads = filter === 'all' ? leads : leads.filter(l => l.status === filter);

  return (
    <View style={styles.screenContainer}>
      <View style={styles.filterBar}>
        {['all', 'new', 'contacted', 'quoted'].map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterButton, filter === f && styles.filterButtonActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredLeads}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <LeadCard lead={item} onPress={() => Alert.alert('Lead Details', `Opening ${item.name}'s profile...`)} />
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => onNavigate('newLead')}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

// Policies Screen
const PoliciesScreen: React.FC<{ onNavigate: (screen: string) => void }> = ({ onNavigate }) => {
  const [policies, setPolicies] = useState<Policy[]>([
    { id: '1', policyNumber: 'MOT-2024-001234', customerName: 'Adebayo Johnson', product: 'Motor Third Party', premium: 15000, commission: 2250, status: 'active', expiryDate: new Date('2025-06-15') },
    { id: '2', policyNumber: 'LIF-2024-005678', customerName: 'Chioma Okafor', product: 'Term Life 10 Years', premium: 120000, commission: 24000, status: 'active', expiryDate: new Date('2034-03-20') },
    { id: '3', policyNumber: 'FIR-2024-009012', customerName: 'Ibrahim Musa', product: 'Fire & Allied Perils', premium: 85000, commission: 12750, status: 'pending', expiryDate: new Date('2025-01-10') },
  ]);

  return (
    <View style={styles.screenContainer}>
      <View style={styles.searchBar}>
        <TextInput style={styles.searchInput} placeholder="Search policies..." />
      </View>

      <FlatList
        data={policies}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <PolicyCard policy={item} onPress={() => Alert.alert('Policy Details', `Opening ${item.policyNumber}...`)} />
        )}
      />
    </View>
  );
};

// Quotes Screen
const QuotesScreen: React.FC<{ onNavigate: (screen: string) => void }> = ({ onNavigate }) => (
  <View style={styles.screenContainer}>
    <View style={styles.quoteTypes}>
      <Text style={styles.sectionTitle}>Generate Quote</Text>
      <QuoteTypeCard title="Motor Insurance" icon="🚗" onPress={() => onNavigate('newQuote')} />
      <QuoteTypeCard title="Life Insurance" icon="❤️" onPress={() => onNavigate('newQuote')} />
      <QuoteTypeCard title="Fire Insurance" icon="🔥" onPress={() => onNavigate('newQuote')} />
      <QuoteTypeCard title="Marine Insurance" icon="🚢" onPress={() => onNavigate('newQuote')} />
      <QuoteTypeCard title="Personal Accident" icon="🏥" onPress={() => onNavigate('newQuote')} />
      <QuoteTypeCard title="Goods in Transit" icon="📦" onPress={() => onNavigate('newQuote')} />
    </View>
  </View>
);

// Commissions Screen
const CommissionsScreen: React.FC<{ onNavigate: (screen: string) => void }> = ({ onNavigate }) => {
  const [commissions, setCommissions] = useState<Commission[]>([
    { id: '1', policyNumber: 'MOT-2024-001234', amount: 2250, status: 'paid', date: new Date('2024-02-15') },
    { id: '2', policyNumber: 'LIF-2024-005678', amount: 24000, status: 'pending', date: new Date('2024-02-20') },
    { id: '3', policyNumber: 'FIR-2024-009012', amount: 12750, status: 'pending', date: new Date('2024-02-25') },
  ]);

  const totalPending = commissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0);
  const totalPaid = commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0);

  return (
    <ScrollView style={styles.screenContainer}>
      <View style={styles.commissionSummary}>
        <View style={styles.commissionCard}>
          <Text style={styles.commissionLabel}>Pending</Text>
          <Text style={styles.commissionAmount}>₦{totalPending.toLocaleString()}</Text>
        </View>
        <View style={[styles.commissionCard, styles.commissionCardPaid]}>
          <Text style={styles.commissionLabel}>Paid (This Month)</Text>
          <Text style={styles.commissionAmount}>₦{totalPaid.toLocaleString()}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Commission History</Text>
      {commissions.map(commission => (
        <CommissionItem key={commission.id} commission={commission} />
      ))}
    </ScrollView>
  );
};

// Customers Screen
const CustomersScreen: React.FC<{ onNavigate: (screen: string) => void }> = ({ onNavigate }) => (
  <View style={styles.screenContainer}>
    <View style={styles.searchBar}>
      <TextInput style={styles.searchInput} placeholder="Search customers..." />
    </View>
    <Text style={styles.infoText}>Customer list will appear here</Text>
  </View>
);

// New Lead Screen
const NewLeadScreen: React.FC<{ onNavigate: (screen: string) => void }> = ({ onNavigate }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [product, setProduct] = useState('');

  const handleSubmit = () => {
    if (!name || !phone) {
      Alert.alert('Error', 'Please fill in required fields');
      return;
    }
    Alert.alert('Success', 'Lead created successfully!', [
      { text: 'OK', onPress: () => onNavigate('leads') }
    ]);
  };

  return (
    <ScrollView style={styles.screenContainer}>
      <View style={styles.form}>
        <Text style={styles.formLabel}>Customer Name *</Text>
        <TextInput style={styles.formInput} value={name} onChangeText={setName} placeholder="Enter full name" />

        <Text style={styles.formLabel}>Phone Number *</Text>
        <TextInput style={styles.formInput} value={phone} onChangeText={setPhone} placeholder="08012345678" keyboardType="phone-pad" />

        <Text style={styles.formLabel}>Email</Text>
        <TextInput style={styles.formInput} value={email} onChangeText={setEmail} placeholder="email@example.com" keyboardType="email-address" />

        <Text style={styles.formLabel}>Product Interest</Text>
        <TextInput style={styles.formInput} value={product} onChangeText={setProduct} placeholder="e.g., Motor Insurance" />

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Create Lead</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

// New Quote Screen
const NewQuoteScreen: React.FC<{ onNavigate: (screen: string) => void }> = ({ onNavigate }) => {
  const [vehicleValue, setVehicleValue] = useState('');
  const [coverType, setCoverType] = useState('comprehensive');
  const [calculatedPremium, setCalculatedPremium] = useState<number | null>(null);

  const calculateQuote = () => {
    const value = parseFloat(vehicleValue);
    if (isNaN(value)) {
      Alert.alert('Error', 'Please enter a valid vehicle value');
      return;
    }

    let rate = 0.03; // 3% for comprehensive
    if (coverType === 'third_party') rate = 0.0075;
    if (coverType === 'third_party_fire_theft') rate = 0.015;

    const premium = Math.max(value * rate, 15000);
    setCalculatedPremium(premium);
  };

  return (
    <ScrollView style={styles.screenContainer}>
      <View style={styles.form}>
        <Text style={styles.formLabel}>Vehicle Value (₦)</Text>
        <TextInput
          style={styles.formInput}
          value={vehicleValue}
          onChangeText={setVehicleValue}
          placeholder="e.g., 5000000"
          keyboardType="numeric"
        />

        <Text style={styles.formLabel}>Cover Type</Text>
        <View style={styles.radioGroup}>
          {[
            { value: 'third_party', label: 'Third Party Only' },
            { value: 'third_party_fire_theft', label: 'Third Party Fire & Theft' },
            { value: 'comprehensive', label: 'Comprehensive' },
          ].map(option => (
            <TouchableOpacity
              key={option.value}
              style={[styles.radioButton, coverType === option.value && styles.radioButtonActive]}
              onPress={() => setCoverType(option.value)}
            >
              <Text style={[styles.radioText, coverType === option.value && styles.radioTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.calculateButton} onPress={calculateQuote}>
          <Text style={styles.calculateButtonText}>Calculate Premium</Text>
        </TouchableOpacity>

        {calculatedPremium && (
          <View style={styles.quoteResult}>
            <Text style={styles.quoteResultLabel}>Estimated Premium</Text>
            <Text style={styles.quoteResultAmount}>₦{calculatedPremium.toLocaleString()}</Text>
            <Text style={styles.quoteResultCommission}>
              Your Commission: ₦{(calculatedPremium * 0.15).toLocaleString()}
            </Text>
            <TouchableOpacity style={styles.sendQuoteButton}>
              <Text style={styles.sendQuoteButtonText}>Send Quote to Customer</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

// Bottom Navigation
const BottomNavigation: React.FC<{ currentScreen: string; onNavigate: (screen: string) => void }> = ({
  currentScreen,
  onNavigate,
}) => (
  <View style={styles.bottomNav}>
    <NavItem icon="🏠" label="Home" active={currentScreen === 'dashboard'} onPress={() => onNavigate('dashboard')} />
    <NavItem icon="👥" label="Leads" active={currentScreen === 'leads'} onPress={() => onNavigate('leads')} />
    <NavItem icon="📋" label="Policies" active={currentScreen === 'policies'} onPress={() => onNavigate('policies')} />
    <NavItem icon="📝" label="Quotes" active={currentScreen === 'quotes'} onPress={() => onNavigate('quotes')} />
    <NavItem icon="💰" label="Commission" active={currentScreen === 'commissions'} onPress={() => onNavigate('commissions')} />
  </View>
);

// Helper Components
const StatCard: React.FC<{ title: string; value: string; icon: string; color: string }> = ({ title, value, icon, color }) => (
  <View style={[styles.statCard, { borderLeftColor: color }]}>
    <Text style={styles.statIcon}>{icon}</Text>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statTitle}>{title}</Text>
  </View>
);

const ActionButton: React.FC<{ title: string; icon: string; onPress: () => void }> = ({ title, icon, onPress }) => (
  <TouchableOpacity style={styles.actionButton} onPress={onPress}>
    <Text style={styles.actionIcon}>{icon}</Text>
    <Text style={styles.actionTitle}>{title}</Text>
  </TouchableOpacity>
);

const AlertCard: React.FC<{ type: 'warning' | 'info' | 'success'; message: string }> = ({ type, message }) => {
  const colors = { warning: '#FFF3E0', info: '#E3F2FD', success: '#E8F5E9' };
  return (
    <View style={[styles.alertCard, { backgroundColor: colors[type] }]}>
      <Text style={styles.alertMessage}>{message}</Text>
    </View>
  );
};

const ActivityItem: React.FC<{ action: string; details: string; time: string }> = ({ action, details, time }) => (
  <View style={styles.activityItem}>
    <View>
      <Text style={styles.activityAction}>{action}</Text>
      <Text style={styles.activityDetails}>{details}</Text>
    </View>
    <Text style={styles.activityTime}>{time}</Text>
  </View>
);

const LeadCard: React.FC<{ lead: Lead; onPress: () => void }> = ({ lead, onPress }) => (
  <TouchableOpacity style={styles.leadCard} onPress={onPress}>
    <View style={styles.leadInfo}>
      <Text style={styles.leadName}>{lead.name}</Text>
      <Text style={styles.leadProduct}>{lead.product}</Text>
      <Text style={styles.leadPhone}>{lead.phone}</Text>
    </View>
    <View style={[styles.leadStatus, { backgroundColor: getStatusColor(lead.status) }]}>
      <Text style={styles.leadStatusText}>{lead.status}</Text>
    </View>
  </TouchableOpacity>
);

const PolicyCard: React.FC<{ policy: Policy; onPress: () => void }> = ({ policy, onPress }) => (
  <TouchableOpacity style={styles.policyCard} onPress={onPress}>
    <Text style={styles.policyNumber}>{policy.policyNumber}</Text>
    <Text style={styles.policyCustomer}>{policy.customerName}</Text>
    <Text style={styles.policyProduct}>{policy.product}</Text>
    <View style={styles.policyFooter}>
      <Text style={styles.policyPremium}>₦{policy.premium.toLocaleString()}</Text>
      <Text style={styles.policyExpiry}>Expires: {policy.expiryDate.toLocaleDateString()}</Text>
    </View>
  </TouchableOpacity>
);

const QuoteTypeCard: React.FC<{ title: string; icon: string; onPress: () => void }> = ({ title, icon, onPress }) => (
  <TouchableOpacity style={styles.quoteTypeCard} onPress={onPress}>
    <Text style={styles.quoteTypeIcon}>{icon}</Text>
    <Text style={styles.quoteTypeTitle}>{title}</Text>
  </TouchableOpacity>
);

const CommissionItem: React.FC<{ commission: Commission }> = ({ commission }) => (
  <View style={styles.commissionItem}>
    <View>
      <Text style={styles.commissionPolicy}>{commission.policyNumber}</Text>
      <Text style={styles.commissionDate}>{commission.date.toLocaleDateString()}</Text>
    </View>
    <View style={styles.commissionRight}>
      <Text style={styles.commissionItemAmount}>₦{commission.amount.toLocaleString()}</Text>
      <Text style={[styles.commissionStatus, { color: commission.status === 'paid' ? '#4CAF50' : '#FF9800' }]}>
        {commission.status.toUpperCase()}
      </Text>
    </View>
  </View>
);

const NavItem: React.FC<{ icon: string; label: string; active: boolean; onPress: () => void }> = ({
  icon,
  label,
  active,
  onPress,
}) => (
  <TouchableOpacity style={styles.navItem} onPress={onPress}>
    <Text style={[styles.navIcon, active && styles.navIconActive]}>{icon}</Text>
    <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
  </TouchableOpacity>
);

// Helper Functions
const getScreenTitle = (screen: string): string => {
  const titles: { [key: string]: string } = {
    dashboard: 'A&G Agent Portal',
    leads: 'My Leads',
    policies: 'My Policies',
    quotes: 'Generate Quote',
    commissions: 'My Commissions',
    customers: 'My Customers',
    newLead: 'New Lead',
    newQuote: 'New Quote',
  };
  return titles[screen] || 'A&G Agent Portal';
};

const getStatusColor = (status: string): string => {
  const colors: { [key: string]: string } = {
    new: '#2196F3',
    contacted: '#FF9800',
    quoted: '#9C27B0',
    converted: '#4CAF50',
    lost: '#F44336',
  };
  return colors[status] || '#757575';
};

// Styles
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { backgroundColor: '#1565C0', padding: 16, paddingTop: 48, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  notificationButton: { padding: 8 },
  notificationBadge: { backgroundColor: '#FF5722', color: '#FFF', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, fontSize: 12 },
  screenContainer: { flex: 1, padding: 16 },
  welcomeCard: { backgroundColor: '#1565C0', borderRadius: 12, padding: 20, marginBottom: 16 },
  welcomeText: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
  dateText: { color: '#BBDEFB', marginTop: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 16 },
  statCard: { backgroundColor: '#FFF', borderRadius: 8, padding: 16, width: '48%', marginBottom: 12, borderLeftWidth: 4 },
  statIcon: { fontSize: 24, marginBottom: 8 },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  statTitle: { fontSize: 12, color: '#757575', marginTop: 4 },
  quickActions: { marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  actionButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  actionButton: { backgroundColor: '#FFF', borderRadius: 8, padding: 16, alignItems: 'center', width: '23%' },
  actionIcon: { fontSize: 24, marginBottom: 4 },
  actionTitle: { fontSize: 10, color: '#333', textAlign: 'center' },
  alertsSection: { marginBottom: 16 },
  alertCard: { borderRadius: 8, padding: 12, marginBottom: 8 },
  alertMessage: { color: '#333' },
  recentActivity: { marginBottom: 16 },
  activityItem: { backgroundColor: '#FFF', borderRadius: 8, padding: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  activityAction: { fontWeight: 'bold', color: '#333' },
  activityDetails: { color: '#757575', fontSize: 12 },
  activityTime: { color: '#9E9E9E', fontSize: 12 },
  filterBar: { flexDirection: 'row', marginBottom: 16 },
  filterButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#E0E0E0', marginRight: 8 },
  filterButtonActive: { backgroundColor: '#1565C0' },
  filterText: { color: '#757575' },
  filterTextActive: { color: '#FFF' },
  leadCard: { backgroundColor: '#FFF', borderRadius: 8, padding: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  leadInfo: { flex: 1 },
  leadName: { fontWeight: 'bold', fontSize: 16, color: '#333' },
  leadProduct: { color: '#1565C0', marginTop: 4 },
  leadPhone: { color: '#757575', marginTop: 2 },
  leadStatus: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  leadStatusText: { color: '#FFF', fontSize: 12, textTransform: 'capitalize' },
  fab: { position: 'absolute', right: 16, bottom: 16, backgroundColor: '#1565C0', width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  fabText: { color: '#FFF', fontSize: 24 },
  searchBar: { marginBottom: 16 },
  searchInput: { backgroundColor: '#FFF', borderRadius: 8, padding: 12, fontSize: 16 },
  policyCard: { backgroundColor: '#FFF', borderRadius: 8, padding: 16, marginBottom: 12 },
  policyNumber: { fontWeight: 'bold', color: '#1565C0' },
  policyCustomer: { fontSize: 16, fontWeight: 'bold', color: '#333', marginTop: 4 },
  policyProduct: { color: '#757575', marginTop: 2 },
  policyFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  policyPremium: { fontWeight: 'bold', color: '#4CAF50' },
  policyExpiry: { color: '#757575' },
  quoteTypes: { flex: 1 },
  quoteTypeCard: { backgroundColor: '#FFF', borderRadius: 8, padding: 20, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  quoteTypeIcon: { fontSize: 32, marginRight: 16 },
  quoteTypeTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  commissionSummary: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  commissionCard: { backgroundColor: '#FF9800', borderRadius: 12, padding: 20, width: '48%' },
  commissionCardPaid: { backgroundColor: '#4CAF50' },
  commissionLabel: { color: '#FFF', opacity: 0.8 },
  commissionAmount: { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginTop: 8 },
  commissionItem: { backgroundColor: '#FFF', borderRadius: 8, padding: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  commissionPolicy: { fontWeight: 'bold', color: '#333' },
  commissionDate: { color: '#757575', marginTop: 4 },
  commissionRight: { alignItems: 'flex-end' },
  commissionItemAmount: { fontWeight: 'bold', fontSize: 16 },
  commissionStatus: { fontSize: 12, marginTop: 4 },
  form: { backgroundColor: '#FFF', borderRadius: 12, padding: 20 },
  formLabel: { fontWeight: 'bold', color: '#333', marginBottom: 8, marginTop: 16 },
  formInput: { backgroundColor: '#F5F5F5', borderRadius: 8, padding: 12, fontSize: 16 },
  submitButton: { backgroundColor: '#1565C0', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 24 },
  submitButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  radioGroup: { marginTop: 8 },
  radioButton: { backgroundColor: '#F5F5F5', borderRadius: 8, padding: 12, marginBottom: 8 },
  radioButtonActive: { backgroundColor: '#1565C0' },
  radioText: { color: '#333' },
  radioTextActive: { color: '#FFF' },
  calculateButton: { backgroundColor: '#4CAF50', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 24 },
  calculateButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  quoteResult: { backgroundColor: '#E8F5E9', borderRadius: 12, padding: 20, marginTop: 24, alignItems: 'center' },
  quoteResultLabel: { color: '#757575' },
  quoteResultAmount: { fontSize: 32, fontWeight: 'bold', color: '#4CAF50', marginTop: 8 },
  quoteResultCommission: { color: '#1565C0', marginTop: 8 },
  sendQuoteButton: { backgroundColor: '#1565C0', borderRadius: 8, padding: 12, marginTop: 16 },
  sendQuoteButtonText: { color: '#FFF', fontWeight: 'bold' },
  infoText: { textAlign: 'center', color: '#757575', marginTop: 32 },
  bottomNav: { flexDirection: 'row', backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E0E0E0', paddingVertical: 8 },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  navIcon: { fontSize: 20, color: '#757575' },
  navIconActive: { color: '#1565C0' },
  navLabel: { fontSize: 10, color: '#757575', marginTop: 4 },
  navLabelActive: { color: '#1565C0' },
});

export default AgentMobileApp;
