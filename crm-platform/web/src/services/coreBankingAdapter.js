/**
 * Core Banking Integration Adapter
 * Connects to external core banking systems (T24, Finacle, Flexcube, etc.)
 * Normalizes customer data into CRM schema
 */

const CORE_BANKING_API = '/api/v1/core-banking'

// Simulated core banking data for demo
const coreBankingCustomers = [
  {
    externalId: 'CB-001',
    cif: 'CIF-2024-00001',
    fullName: 'Adebayo Ogundimu',
    email: 'adebayo.ogundimu@gmail.com',
    phone: '+234-801-234-5678',
    bvn: '22345678901',
    nin: 'NIN-98765432',
    accountType: 'Savings',
    accountNumber: '0012345678',
    accountStatus: 'Active',
    balance: 2450000.00,
    currency: 'NGN',
    branch: 'Lagos Main',
    branchCode: 'LM-001',
    kycStatus: 'Verified',
    kycLevel: 3,
    riskRating: 'Low',
    dateOpened: '2023-01-15',
    lastTransaction: '2024-01-28',
    products: ['Savings Account', 'Debit Card', 'Mobile Banking', 'Internet Banking'],
    segment: 'Premium',
    relationshipManager: 'Funke Adeyemi',
    monthlyVolume: 850000,
    source: 'core-banking'
  },
  {
    externalId: 'CB-002',
    cif: 'CIF-2024-00002',
    fullName: 'Chioma Nwosu',
    email: 'chioma.nwosu@outlook.com',
    phone: '+234-802-345-6789',
    bvn: '22345678902',
    nin: 'NIN-87654321',
    accountType: 'Current',
    accountNumber: '0023456789',
    accountStatus: 'Active',
    balance: 15780000.00,
    currency: 'NGN',
    branch: 'Abuja Central',
    branchCode: 'AC-002',
    kycStatus: 'Verified',
    kycLevel: 3,
    riskRating: 'Medium',
    dateOpened: '2022-06-20',
    lastTransaction: '2024-01-29',
    products: ['Current Account', 'Credit Card', 'Trade Finance', 'Treasury Bills'],
    segment: 'Corporate',
    relationshipManager: 'Emeka Okorie',
    monthlyVolume: 5200000,
    source: 'core-banking'
  },
  {
    externalId: 'CB-003',
    cif: 'CIF-2024-00003',
    fullName: 'Ibrahim Musa',
    email: 'ibrahim.musa@yahoo.com',
    phone: '+234-803-456-7890',
    bvn: '22345678903',
    nin: 'NIN-76543210',
    accountType: 'Savings',
    accountNumber: '0034567890',
    accountStatus: 'Active',
    balance: 890000.00,
    currency: 'NGN',
    branch: 'Kano Branch',
    branchCode: 'KN-003',
    kycStatus: 'Pending',
    kycLevel: 2,
    riskRating: 'Low',
    dateOpened: '2023-09-10',
    lastTransaction: '2024-01-25',
    products: ['Savings Account', 'Mobile Banking'],
    segment: 'Retail',
    relationshipManager: 'Aisha Bello',
    monthlyVolume: 320000,
    source: 'core-banking'
  },
  {
    externalId: 'CB-004',
    cif: 'CIF-2024-00004',
    fullName: 'Ngozi Eze',
    email: 'ngozi.eze@gmail.com',
    phone: '+234-804-567-8901',
    bvn: '22345678904',
    nin: 'NIN-65432109',
    accountType: 'Domiciliary',
    accountNumber: '0045678901',
    accountStatus: 'Active',
    balance: 45200.00,
    currency: 'USD',
    branch: 'Port Harcourt',
    branchCode: 'PH-004',
    kycStatus: 'Verified',
    kycLevel: 3,
    riskRating: 'Low',
    dateOpened: '2022-03-05',
    lastTransaction: '2024-01-27',
    products: ['Dom Account', 'Wire Transfer', 'FX Trading'],
    segment: 'Diaspora',
    relationshipManager: 'Tunde Bakare',
    monthlyVolume: 12500,
    source: 'core-banking'
  },
  {
    externalId: 'CB-005',
    cif: 'CIF-2024-00005',
    fullName: 'Oluwaseun Adeleke',
    email: 'seun.adeleke@techcorp.ng',
    phone: '+234-805-678-9012',
    bvn: '22345678905',
    nin: 'NIN-54321098',
    accountType: 'Corporate',
    accountNumber: '0056789012',
    accountStatus: 'Active',
    balance: 87500000.00,
    currency: 'NGN',
    branch: 'Victoria Island',
    branchCode: 'VI-005',
    kycStatus: 'Verified',
    kycLevel: 3,
    riskRating: 'High',
    dateOpened: '2021-11-22',
    lastTransaction: '2024-01-29',
    products: ['Corporate Account', 'Overdraft', 'LC', 'Trade Finance', 'Payroll', 'Collections'],
    segment: 'Corporate',
    relationshipManager: 'Yemi Afolabi',
    monthlyVolume: 45000000,
    source: 'core-banking'
  }
]

const coreBankingTransactions = [
  { id: 'TXN-CB-001', customerId: 'CB-001', type: 'Credit', amount: 250000, currency: 'NGN', description: 'Salary Credit', date: '2024-01-28', channel: 'NIBSS', status: 'Completed' },
  { id: 'TXN-CB-002', customerId: 'CB-001', type: 'Debit', amount: 50000, currency: 'NGN', description: 'POS Purchase', date: '2024-01-27', channel: 'POS', status: 'Completed' },
  { id: 'TXN-CB-003', customerId: 'CB-002', type: 'Credit', amount: 3500000, currency: 'NGN', description: 'Invoice Payment', date: '2024-01-29', channel: 'Transfer', status: 'Completed' },
  { id: 'TXN-CB-004', customerId: 'CB-002', type: 'Debit', amount: 1200000, currency: 'NGN', description: 'Supplier Payment', date: '2024-01-28', channel: 'RTGS', status: 'Completed' },
  { id: 'TXN-CB-005', customerId: 'CB-003', type: 'Credit', amount: 150000, currency: 'NGN', description: 'Mobile Transfer In', date: '2024-01-25', channel: 'Mobile', status: 'Completed' },
  { id: 'TXN-CB-006', customerId: 'CB-004', type: 'Credit', amount: 5000, currency: 'USD', description: 'Wire Transfer In', date: '2024-01-27', channel: 'SWIFT', status: 'Completed' },
  { id: 'TXN-CB-007', customerId: 'CB-005', type: 'Debit', amount: 15000000, currency: 'NGN', description: 'LC Settlement', date: '2024-01-29', channel: 'Trade Finance', status: 'Completed' },
  { id: 'TXN-CB-008', customerId: 'CB-005', type: 'Credit', amount: 25000000, currency: 'NGN', description: 'Collection', date: '2024-01-28', channel: 'Collections', status: 'Completed' },
]

export const coreBankingAdapter = {
  async fetchCustomers(filters = {}) {
    await new Promise(r => setTimeout(r, 300))
    let customers = [...coreBankingCustomers]
    if (filters.branch) customers = customers.filter(c => c.branch === filters.branch)
    if (filters.segment) customers = customers.filter(c => c.segment === filters.segment)
    if (filters.kycStatus) customers = customers.filter(c => c.kycStatus === filters.kycStatus)
    return customers
  },

  async fetchCustomerById(externalId) {
    await new Promise(r => setTimeout(r, 200))
    return coreBankingCustomers.find(c => c.externalId === externalId) || null
  },

  async fetchTransactions(customerId, dateRange = {}) {
    await new Promise(r => setTimeout(r, 250))
    return coreBankingTransactions.filter(t => t.customerId === customerId)
  },

  async fetchAccountBalance(accountNumber) {
    await new Promise(r => setTimeout(r, 150))
    const customer = coreBankingCustomers.find(c => c.accountNumber === accountNumber)
    return customer ? { balance: customer.balance, currency: customer.currency, lastUpdated: new Date().toISOString() } : null
  },

  async fetchBranches() {
    await new Promise(r => setTimeout(r, 200))
    return [
      { code: 'LM-001', name: 'Lagos Main', region: 'South-West', customerCount: 12500, totalDeposits: 45000000000 },
      { code: 'AC-002', name: 'Abuja Central', region: 'North-Central', customerCount: 8900, totalDeposits: 32000000000 },
      { code: 'KN-003', name: 'Kano Branch', region: 'North-West', customerCount: 6700, totalDeposits: 18000000000 },
      { code: 'PH-004', name: 'Port Harcourt', region: 'South-South', customerCount: 5400, totalDeposits: 22000000000 },
      { code: 'VI-005', name: 'Victoria Island', region: 'South-West', customerCount: 3200, totalDeposits: 78000000000 },
      { code: 'IB-006', name: 'Ibadan', region: 'South-West', customerCount: 4100, totalDeposits: 12000000000 },
      { code: 'EN-007', name: 'Enugu', region: 'South-East', customerCount: 3800, totalDeposits: 9500000000 },
      { code: 'KD-008', name: 'Kaduna', region: 'North-West', customerCount: 4500, totalDeposits: 14000000000 },
    ]
  },

  async getMetrics() {
    await new Promise(r => setTimeout(r, 300))
    return {
      totalCustomers: 48900,
      totalDeposits: 230500000000,
      totalLoans: 85200000000,
      activeAccounts: 42300,
      dormantAccounts: 6600,
      kycCompliant: 39800,
      kycPending: 9100,
      avgBalance: 4713700,
      monthlyNewAccounts: 1250,
      nplRatio: 3.2,
      branches: 8,
      atmCount: 245,
      posTerminals: 12500,
    }
  }
}

export default coreBankingAdapter
