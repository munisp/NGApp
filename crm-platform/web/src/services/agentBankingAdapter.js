/**
 * Agent Banking Integration Adapter
 * Connects to agent banking platforms (Paga, OPay, Kudi, Moniepoint, etc.)
 * Collects field-level customer data from agents
 */

const agentCustomers = [
  {
    externalId: 'AG-001',
    fullName: 'Fatima Abdullahi',
    phone: '+234-806-789-0123',
    agentId: 'AGT-LG-042',
    agentName: 'Bola Enterprises',
    location: { lat: 6.5244, lng: 3.3792, address: 'Ikeja, Lagos' },
    kycStatus: 'Basic',
    kycLevel: 1,
    registrationDate: '2024-01-15',
    lastActivity: '2024-01-28',
    totalTransactions: 47,
    totalVolume: 285000,
    avgTransactionSize: 6064,
    channel: 'Agent POS',
    services: ['Cash-In', 'Cash-Out', 'Bill Payment', 'Airtime'],
    accountLinked: false,
    source: 'agent-banking'
  },
  {
    externalId: 'AG-002',
    fullName: 'Musa Garba',
    phone: '+234-807-890-1234',
    agentId: 'AGT-KN-018',
    agentName: 'Garba Mobile Services',
    location: { lat: 12.0022, lng: 8.5920, address: 'Sabon Gari, Kano' },
    kycStatus: 'Basic',
    kycLevel: 1,
    registrationDate: '2024-01-08',
    lastActivity: '2024-01-29',
    totalTransactions: 92,
    totalVolume: 520000,
    avgTransactionSize: 5652,
    channel: 'Agent Mobile',
    services: ['Cash-In', 'Cash-Out', 'Transfer', 'Airtime'],
    accountLinked: true,
    linkedAccount: '0034567890',
    source: 'agent-banking'
  },
  {
    externalId: 'AG-003',
    fullName: 'Grace Okonkwo',
    phone: '+234-808-901-2345',
    agentId: 'AGT-EN-007',
    agentName: 'Okonkwo Financial Hub',
    location: { lat: 6.4412, lng: 7.4985, address: 'New Haven, Enugu' },
    kycStatus: 'Enhanced',
    kycLevel: 2,
    registrationDate: '2023-11-20',
    lastActivity: '2024-01-27',
    totalTransactions: 156,
    totalVolume: 1250000,
    avgTransactionSize: 8013,
    channel: 'Agent POS',
    services: ['Cash-In', 'Cash-Out', 'Bill Payment', 'Transfer', 'Savings'],
    accountLinked: true,
    linkedAccount: '0067890123',
    source: 'agent-banking'
  },
  {
    externalId: 'AG-004',
    fullName: 'Aminu Suleiman',
    phone: '+234-809-012-3456',
    agentId: 'AGT-KD-023',
    agentName: 'Suleiman Business Centre',
    location: { lat: 10.5105, lng: 7.4165, address: 'Barnawa, Kaduna' },
    kycStatus: 'Basic',
    kycLevel: 1,
    registrationDate: '2024-01-22',
    lastActivity: '2024-01-28',
    totalTransactions: 12,
    totalVolume: 65000,
    avgTransactionSize: 5417,
    channel: 'Agent Mobile',
    services: ['Cash-In', 'Cash-Out', 'Airtime'],
    accountLinked: false,
    source: 'agent-banking'
  },
  {
    externalId: 'AG-005',
    fullName: 'Blessing Udo',
    phone: '+234-810-123-4567',
    agentId: 'AGT-PH-011',
    agentName: 'Udo Quick Cash',
    location: { lat: 4.8156, lng: 7.0498, address: 'D-Line, Port Harcourt' },
    kycStatus: 'Enhanced',
    kycLevel: 2,
    registrationDate: '2023-10-05',
    lastActivity: '2024-01-29',
    totalTransactions: 234,
    totalVolume: 3450000,
    avgTransactionSize: 14744,
    channel: 'Agent POS',
    services: ['Cash-In', 'Cash-Out', 'Bill Payment', 'Transfer', 'Savings', 'Insurance'],
    accountLinked: true,
    linkedAccount: '0078901234',
    source: 'agent-banking'
  },
  {
    externalId: 'AG-006',
    fullName: 'Halima Bello',
    phone: '+234-811-234-5678',
    agentId: 'AGT-AB-031',
    agentName: 'Bello Money Point',
    location: { lat: 9.0579, lng: 7.4951, address: 'Wuse, Abuja' },
    kycStatus: 'Basic',
    kycLevel: 1,
    registrationDate: '2024-01-10',
    lastActivity: '2024-01-26',
    totalTransactions: 38,
    totalVolume: 195000,
    avgTransactionSize: 5132,
    channel: 'Agent POS',
    services: ['Cash-In', 'Cash-Out', 'Airtime', 'Bill Payment'],
    accountLinked: false,
    source: 'agent-banking'
  }
]

const agents = [
  { id: 'AGT-LG-042', name: 'Bola Enterprises', region: 'Lagos', state: 'Lagos', customersRegistered: 342, monthlyTransactions: 4500, monthlyVolume: 28500000, commission: 285000, status: 'Active', rating: 4.8 },
  { id: 'AGT-KN-018', name: 'Garba Mobile Services', region: 'Kano', state: 'Kano', customersRegistered: 218, monthlyTransactions: 3200, monthlyVolume: 18200000, commission: 182000, status: 'Active', rating: 4.5 },
  { id: 'AGT-EN-007', name: 'Okonkwo Financial Hub', region: 'Enugu', state: 'Enugu', customersRegistered: 156, monthlyTransactions: 2100, monthlyVolume: 12600000, commission: 126000, status: 'Active', rating: 4.7 },
  { id: 'AGT-KD-023', name: 'Suleiman Business Centre', region: 'Kaduna', state: 'Kaduna', customersRegistered: 89, monthlyTransactions: 1200, monthlyVolume: 6800000, commission: 68000, status: 'Active', rating: 4.2 },
  { id: 'AGT-PH-011', name: 'Udo Quick Cash', region: 'Port Harcourt', state: 'Rivers', customersRegistered: 278, monthlyTransactions: 3800, monthlyVolume: 24500000, commission: 245000, status: 'Active', rating: 4.9 },
  { id: 'AGT-AB-031', name: 'Bello Money Point', region: 'Abuja', state: 'FCT', customersRegistered: 145, monthlyTransactions: 1800, monthlyVolume: 10200000, commission: 102000, status: 'Active', rating: 4.4 },
  { id: 'AGT-IB-015', name: 'Adisa Financial Services', region: 'Ibadan', state: 'Oyo', customersRegistered: 198, monthlyTransactions: 2600, monthlyVolume: 15400000, commission: 154000, status: 'Active', rating: 4.6 },
  { id: 'AGT-BN-009', name: 'Okafor Express', region: 'Benin', state: 'Edo', customersRegistered: 112, monthlyTransactions: 1500, monthlyVolume: 8900000, commission: 89000, status: 'Suspended', rating: 3.8 },
]

export const agentBankingAdapter = {
  async fetchCustomers(filters = {}) {
    await new Promise(r => setTimeout(r, 300))
    let customers = [...agentCustomers]
    if (filters.agentId) customers = customers.filter(c => c.agentId === filters.agentId)
    if (filters.kycStatus) customers = customers.filter(c => c.kycStatus === filters.kycStatus)
    return customers
  },

  async fetchAgents(filters = {}) {
    await new Promise(r => setTimeout(r, 250))
    let result = [...agents]
    if (filters.region) result = result.filter(a => a.region === filters.region)
    if (filters.status) result = result.filter(a => a.status === filters.status)
    return result
  },

  async fetchAgentById(agentId) {
    await new Promise(r => setTimeout(r, 200))
    return agents.find(a => a.id === agentId) || null
  },

  async getMetrics() {
    await new Promise(r => setTimeout(r, 300))
    return {
      totalAgents: 1538,
      activeAgents: 1412,
      suspendedAgents: 126,
      totalCustomersRegistered: 28500,
      monthlyNewRegistrations: 3200,
      monthlyTransactions: 485000,
      monthlyVolume: 2850000000,
      avgTransactionsPerAgent: 315,
      totalCommissions: 28500000,
      cashInVolume: 1425000000,
      cashOutVolume: 1140000000,
      billPaymentVolume: 285000000,
      regionsServed: 12,
      statesServed: 24,
      ruralPenetration: 62.5,
      kycConversionRate: 34.2,
      accountLinkageRate: 28.7,
    }
  },

  async fetchAgentPerformance() {
    await new Promise(r => setTimeout(r, 300))
    return [
      { month: 'Aug', transactions: 380000, volume: 2200000000, newCustomers: 2800, agents: 1350 },
      { month: 'Sep', transactions: 410000, volume: 2400000000, newCustomers: 2950, agents: 1380 },
      { month: 'Oct', transactions: 435000, volume: 2550000000, newCustomers: 3050, agents: 1420 },
      { month: 'Nov', transactions: 455000, volume: 2700000000, newCustomers: 3100, agents: 1460 },
      { month: 'Dec', transactions: 470000, volume: 2780000000, newCustomers: 3150, agents: 1500 },
      { month: 'Jan', transactions: 485000, volume: 2850000000, newCustomers: 3200, agents: 1538 },
    ]
  },

  async fetchRegionalData() {
    await new Promise(r => setTimeout(r, 250))
    return [
      { region: 'Lagos', agents: 320, customers: 6800, volume: 680000000, transactions: 98000 },
      { region: 'Kano', agents: 185, customers: 3200, volume: 320000000, transactions: 52000 },
      { region: 'Abuja', agents: 210, customers: 4100, volume: 450000000, transactions: 68000 },
      { region: 'Port Harcourt', agents: 145, customers: 2800, volume: 290000000, transactions: 42000 },
      { region: 'Ibadan', agents: 120, customers: 2200, volume: 180000000, transactions: 32000 },
      { region: 'Enugu', agents: 98, customers: 1800, volume: 150000000, transactions: 25000 },
      { region: 'Kaduna', agents: 110, customers: 2100, volume: 170000000, transactions: 28000 },
      { region: 'Others', agents: 350, customers: 5500, volume: 510000000, transactions: 140000 },
    ]
  }
}

export default agentBankingAdapter
