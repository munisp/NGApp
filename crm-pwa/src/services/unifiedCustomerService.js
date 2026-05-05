/**
 * Unified Customer Service — Golden Record
 * Merges customer data from Core Banking, Agent Banking, and Remittance
 * into a single 360° customer view
 */

import { coreBankingAdapter } from './coreBankingAdapter'
import { agentBankingAdapter } from './agentBankingAdapter'
import { remittanceAdapter } from './remittanceAdapter'

// Pre-built unified customer records (golden records)
const unifiedCustomers = [
  {
    id: 'UNI-001',
    primarySource: 'core-banking',
    externalIds: { coreBanking: 'CB-001', agentBanking: null, remittance: 'REM-003' },
    fullName: 'Adebayo Ogundimu',
    email: 'adebayo.ogundimu@gmail.com',
    phone: '+234-801-234-5678',
    bvn: '22345678901',
    segment: 'Premium',
    lifetimeValue: 4250000,
    riskScore: 15,
    totalAccounts: 2,
    totalProducts: 6,
    sources: ['core-banking', 'remittance'],
    coreBanking: {
      accountNumber: '0012345678',
      accountType: 'Savings',
      balance: 2450000,
      branch: 'Lagos Main',
      kycLevel: 3,
      products: ['Savings Account', 'Debit Card', 'Mobile Banking', 'Internet Banking'],
    },
    remittance: {
      role: 'Receiver',
      corridor: 'GBP → NGN',
      totalReceived: 28950000,
      lastReceived: '2024-01-27',
    },
    interactions: [
      { date: '2024-01-28', type: 'Transaction', channel: 'Mobile', description: 'Salary Credit ₦250,000' },
      { date: '2024-01-27', type: 'Remittance', channel: 'Bank Transfer', description: 'Received £500 from Chukwuemeka Obi' },
      { date: '2024-01-25', type: 'Call', channel: 'Phone', description: 'Enquiry about savings rate' },
    ]
  },
  {
    id: 'UNI-002',
    primarySource: 'core-banking',
    externalIds: { coreBanking: 'CB-002', agentBanking: null, remittance: null },
    fullName: 'Chioma Nwosu',
    email: 'chioma.nwosu@outlook.com',
    phone: '+234-802-345-6789',
    bvn: '22345678902',
    segment: 'Corporate',
    lifetimeValue: 15780000,
    riskScore: 35,
    totalAccounts: 1,
    totalProducts: 4,
    sources: ['core-banking'],
    coreBanking: {
      accountNumber: '0023456789',
      accountType: 'Current',
      balance: 15780000,
      branch: 'Abuja Central',
      kycLevel: 3,
      products: ['Current Account', 'Credit Card', 'Trade Finance', 'Treasury Bills'],
    },
    interactions: [
      { date: '2024-01-29', type: 'Transaction', channel: 'RTGS', description: 'Invoice Payment ₦3,500,000' },
      { date: '2024-01-28', type: 'Transaction', channel: 'Transfer', description: 'Supplier Payment ₦1,200,000' },
    ]
  },
  {
    id: 'UNI-003',
    primarySource: 'core-banking',
    externalIds: { coreBanking: 'CB-003', agentBanking: 'AG-002', remittance: null },
    fullName: 'Ibrahim Musa',
    email: 'ibrahim.musa@yahoo.com',
    phone: '+234-803-456-7890',
    bvn: '22345678903',
    segment: 'Retail',
    lifetimeValue: 1410000,
    riskScore: 10,
    totalAccounts: 1,
    totalProducts: 2,
    sources: ['core-banking', 'agent-banking'],
    coreBanking: {
      accountNumber: '0034567890',
      accountType: 'Savings',
      balance: 890000,
      branch: 'Kano Branch',
      kycLevel: 2,
      products: ['Savings Account', 'Mobile Banking'],
    },
    agentBanking: {
      agentId: 'AGT-KN-018',
      agentName: 'Garba Mobile Services',
      totalTransactions: 92,
      totalVolume: 520000,
      services: ['Cash-In', 'Cash-Out', 'Transfer', 'Airtime'],
    },
    interactions: [
      { date: '2024-01-29', type: 'Agent Transaction', channel: 'Agent POS', description: 'Cash-In ₦25,000 via Garba Mobile Services' },
      { date: '2024-01-25', type: 'Transaction', channel: 'Mobile', description: 'Transfer In ₦150,000' },
    ]
  },
  {
    id: 'UNI-004',
    primarySource: 'agent-banking',
    externalIds: { coreBanking: null, agentBanking: 'AG-003', remittance: null },
    fullName: 'Grace Okonkwo',
    email: null,
    phone: '+234-808-901-2345',
    bvn: null,
    segment: 'Agent-First',
    lifetimeValue: 1250000,
    riskScore: 8,
    totalAccounts: 1,
    totalProducts: 5,
    sources: ['agent-banking'],
    agentBanking: {
      agentId: 'AGT-EN-007',
      agentName: 'Okonkwo Financial Hub',
      totalTransactions: 156,
      totalVolume: 1250000,
      services: ['Cash-In', 'Cash-Out', 'Bill Payment', 'Transfer', 'Savings'],
      accountLinked: true,
      linkedAccount: '0067890123',
    },
    interactions: [
      { date: '2024-01-27', type: 'Agent Transaction', channel: 'Agent POS', description: 'Bill Payment ₦15,000 - DSTV' },
      { date: '2024-01-25', type: 'Agent Transaction', channel: 'Agent POS', description: 'Cash-Out ₦30,000' },
    ]
  },
  {
    id: 'UNI-005',
    primarySource: 'remittance',
    externalIds: { coreBanking: null, agentBanking: null, remittance: 'REM-002' },
    fullName: 'Aisha Mohammed',
    email: 'aisha.m@yahoo.com',
    phone: '+1-347-890-1234',
    bvn: null,
    segment: 'Diaspora',
    lifetimeValue: 42000,
    riskScore: 5,
    totalAccounts: 0,
    totalProducts: 1,
    sources: ['remittance'],
    remittance: {
      role: 'Sender',
      corridor: 'USD → NGN',
      totalSent: 42000,
      currency: 'USD',
      lastSent: '2024-01-28',
      frequentRecipients: ['Fatima Mohammed (Mother)', 'Hassan Mohammed (Brother)'],
    },
    interactions: [
      { date: '2024-01-28', type: 'Remittance', channel: 'Bank Transfer', description: 'Sent $1,500 to Fatima Mohammed' },
      { date: '2024-01-15', type: 'Remittance', channel: 'Mobile App', description: 'Sent $800 to Hassan Mohammed' },
    ]
  },
  {
    id: 'UNI-006',
    primarySource: 'core-banking',
    externalIds: { coreBanking: 'CB-005', agentBanking: null, remittance: 'REM-004' },
    fullName: 'Oluwaseun Adeleke',
    email: 'seun.adeleke@techcorp.ng',
    phone: '+234-805-678-9012',
    bvn: '22345678905',
    segment: 'Corporate',
    lifetimeValue: 87500000,
    riskScore: 55,
    totalAccounts: 3,
    totalProducts: 8,
    sources: ['core-banking', 'remittance'],
    coreBanking: {
      accountNumber: '0056789012',
      accountType: 'Corporate',
      balance: 87500000,
      branch: 'Victoria Island',
      kycLevel: 3,
      products: ['Corporate Account', 'Overdraft', 'LC', 'Trade Finance', 'Payroll', 'Collections'],
    },
    remittance: {
      role: 'Receiver',
      corridor: 'AED → NGN',
      totalReceived: 65000,
      currency: 'AED',
      lastReceived: '2024-01-25',
    },
    interactions: [
      { date: '2024-01-29', type: 'Transaction', channel: 'Trade Finance', description: 'LC Settlement ₦15,000,000' },
      { date: '2024-01-28', type: 'Transaction', channel: 'Collections', description: 'Collections Credit ₦25,000,000' },
      { date: '2024-01-25', type: 'Remittance', channel: 'SWIFT', description: 'Received AED 5,000 from Dubai' },
    ]
  },
  {
    id: 'UNI-007',
    primarySource: 'agent-banking',
    externalIds: { coreBanking: null, agentBanking: 'AG-005', remittance: 'REM-003' },
    fullName: 'Blessing Udo',
    email: null,
    phone: '+234-810-123-4567',
    bvn: null,
    segment: 'Agent-Premium',
    lifetimeValue: 3450000,
    riskScore: 12,
    totalAccounts: 1,
    totalProducts: 6,
    sources: ['agent-banking', 'remittance'],
    agentBanking: {
      agentId: 'AGT-PH-011',
      agentName: 'Udo Quick Cash',
      totalTransactions: 234,
      totalVolume: 3450000,
      services: ['Cash-In', 'Cash-Out', 'Bill Payment', 'Transfer', 'Savings', 'Insurance'],
      accountLinked: true,
    },
    remittance: {
      role: 'Receiver',
      corridor: 'GBP → NGN',
      totalReceived: 850000,
      currency: 'NGN',
      lastReceived: '2024-01-20',
    },
    interactions: [
      { date: '2024-01-29', type: 'Agent Transaction', channel: 'Agent POS', description: 'Cash-In ₦50,000' },
      { date: '2024-01-20', type: 'Remittance', channel: 'Cash Pickup', description: 'Received ₦850,000 via agent' },
    ]
  }
]

export const unifiedCustomerService = {
  async fetchAllUnified(filters = {}) {
    await new Promise(r => setTimeout(r, 300))
    let customers = [...unifiedCustomers]
    if (filters.source) customers = customers.filter(c => c.sources.includes(filters.source))
    if (filters.segment) customers = customers.filter(c => c.segment === filters.segment)
    if (filters.search) {
      const q = filters.search.toLowerCase()
      customers = customers.filter(c =>
        c.fullName.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q)
      )
    }
    return customers
  },

  async fetchById(id) {
    await new Promise(r => setTimeout(r, 200))
    return unifiedCustomers.find(c => c.id === id) || null
  },

  async getAggregatedMetrics() {
    const [cbMetrics, abMetrics, remMetrics] = await Promise.all([
      coreBankingAdapter.getMetrics(),
      agentBankingAdapter.getMetrics(),
      remittanceAdapter.getMetrics(),
    ])

    return {
      totalUniqueCustomers: cbMetrics.totalCustomers + abMetrics.totalCustomersRegistered + remMetrics.uniqueSenders + remMetrics.uniqueReceivers - 3200, // dedup estimate
      coreBankingCustomers: cbMetrics.totalCustomers,
      agentBankingCustomers: abMetrics.totalCustomersRegistered,
      remittanceSenders: remMetrics.uniqueSenders,
      remittanceReceivers: remMetrics.uniqueReceivers,
      totalDeposits: cbMetrics.totalDeposits,
      agentBankingVolume: abMetrics.monthlyVolume,
      remittanceVolume: remMetrics.totalVolume,
      totalMonthlyVolume: cbMetrics.totalDeposits / 12 + abMetrics.monthlyVolume + remMetrics.totalVolume,
      kycCompliantRate: ((cbMetrics.kycCompliant + abMetrics.totalCustomersRegistered * (abMetrics.kycConversionRate / 100)) / (cbMetrics.totalCustomers + abMetrics.totalCustomersRegistered) * 100).toFixed(1),
      crossSystemCustomers: 3200,
      goldenRecords: cbMetrics.totalCustomers + abMetrics.totalCustomersRegistered + remMetrics.uniqueSenders + remMetrics.uniqueReceivers - 3200,
      dataQualityScore: 87.5,
      matchRate: 92.3,
    }
  },

  async getSegmentBreakdown() {
    await new Promise(r => setTimeout(r, 250))
    return [
      { segment: 'Corporate', count: 3200, value: 125000000000, avgValue: 39062500, color: '#3b82f6' },
      { segment: 'Premium', count: 8500, value: 45000000000, avgValue: 5294118, color: '#8b5cf6' },
      { segment: 'Retail', count: 32000, value: 28000000000, avgValue: 875000, color: '#10b981' },
      { segment: 'Diaspora', count: 19050, value: 15000000000, avgValue: 787402, color: '#f59e0b' },
      { segment: 'Agent-First', count: 18500, value: 4200000000, avgValue: 227027, color: '#ef4444' },
      { segment: 'Agent-Premium', count: 10000, value: 8500000000, avgValue: 850000, color: '#ec4899' },
    ]
  },

  async getSourceDistribution() {
    await new Promise(r => setTimeout(r, 200))
    return [
      { source: 'Core Banking Only', count: 35200, percentage: 38.5 },
      { source: 'Agent Banking Only', count: 22300, percentage: 24.4 },
      { source: 'Remittance Only', count: 30700, percentage: 33.6 },
      { source: 'Core + Agent', count: 1200, percentage: 1.3 },
      { source: 'Core + Remittance', count: 1400, percentage: 1.5 },
      { source: 'Agent + Remittance', count: 450, percentage: 0.5 },
      { source: 'All Three', count: 150, percentage: 0.2 },
    ]
  },

  async getCrossSellOpportunities() {
    await new Promise(r => setTimeout(r, 300))
    return [
      { opportunity: 'Agent → Savings Account', targetCustomers: 18500, conversionRate: 12.5, potentialRevenue: 925000000, priority: 'High' },
      { opportunity: 'Remittance Sender → Dom Account', targetCustomers: 19050, conversionRate: 8.2, potentialRevenue: 3124200000, priority: 'High' },
      { opportunity: 'Retail → Credit Card', targetCustomers: 32000, conversionRate: 15.3, potentialRevenue: 1468800000, priority: 'Medium' },
      { opportunity: 'Corporate → Trade Finance', targetCustomers: 3200, conversionRate: 22.1, potentialRevenue: 5632000000, priority: 'High' },
      { opportunity: 'Agent → Mobile Banking', targetCustomers: 22300, conversionRate: 35.4, potentialRevenue: 446000000, priority: 'Medium' },
      { opportunity: 'Diaspora → Investment Products', targetCustomers: 19050, conversionRate: 6.8, potentialRevenue: 2590800000, priority: 'Low' },
    ]
  }
}

export default unifiedCustomerService
