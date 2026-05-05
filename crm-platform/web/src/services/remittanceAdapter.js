/**
 * Remittance Integration Adapter
 * Connects to remittance corridors (WorldRemit, Flutterwave, Paystack, etc.)
 * Tracks sender/receiver profiles, corridor analytics, compliance
 */

const remittanceCustomers = [
  {
    externalId: 'REM-001',
    fullName: 'Chukwuemeka Obi',
    email: 'emeka.obi@gmail.com',
    phone: '+44-7912-345678',
    country: 'United Kingdom',
    city: 'London',
    kycStatus: 'Verified',
    role: 'Sender',
    corridor: 'GBP → NGN',
    totalRemittances: 24,
    totalVolume: 18500,
    currency: 'GBP',
    avgAmount: 770.83,
    lastRemittance: '2024-01-27',
    firstRemittance: '2023-02-15',
    frequentRecipients: ['Obioma Obi (Mother)', 'Chidinma Obi (Sister)'],
    preferredChannel: 'Mobile App',
    complianceScore: 95,
    sanctionsCleared: true,
    source: 'remittance'
  },
  {
    externalId: 'REM-002',
    fullName: 'Aisha Mohammed',
    email: 'aisha.m@yahoo.com',
    phone: '+1-347-890-1234',
    country: 'United States',
    city: 'New York',
    kycStatus: 'Verified',
    role: 'Sender',
    corridor: 'USD → NGN',
    totalRemittances: 36,
    totalVolume: 42000,
    currency: 'USD',
    avgAmount: 1166.67,
    lastRemittance: '2024-01-28',
    firstRemittance: '2022-08-10',
    frequentRecipients: ['Fatima Mohammed (Mother)', 'Hassan Mohammed (Brother)'],
    preferredChannel: 'Bank Transfer',
    complianceScore: 98,
    sanctionsCleared: true,
    source: 'remittance'
  },
  {
    externalId: 'REM-003',
    fullName: 'Obioma Obi',
    email: 'obioma.obi@gmail.com',
    phone: '+234-812-345-6789',
    country: 'Nigeria',
    city: 'Owerri',
    kycStatus: 'Verified',
    role: 'Receiver',
    corridor: 'GBP → NGN',
    totalRemittances: 24,
    totalVolume: 28950000,
    currency: 'NGN',
    avgAmount: 1206250,
    lastRemittance: '2024-01-27',
    firstRemittance: '2023-02-15',
    linkedSenders: ['Chukwuemeka Obi (Son)'],
    preferredPayout: 'Bank Account',
    bankAccount: '0089012345',
    source: 'remittance'
  },
  {
    externalId: 'REM-004',
    fullName: 'Tunde Bakare',
    email: 'tunde.bakare@outlook.com',
    phone: '+971-50-123-4567',
    country: 'UAE',
    city: 'Dubai',
    kycStatus: 'Verified',
    role: 'Sender',
    corridor: 'AED → NGN',
    totalRemittances: 18,
    totalVolume: 65000,
    currency: 'AED',
    avgAmount: 3611.11,
    lastRemittance: '2024-01-25',
    firstRemittance: '2023-05-20',
    frequentRecipients: ['Yemisi Bakare (Wife)', 'Bakare Family Account'],
    preferredChannel: 'Mobile App',
    complianceScore: 92,
    sanctionsCleared: true,
    source: 'remittance'
  },
  {
    externalId: 'REM-005',
    fullName: 'Adaeze Nnamdi',
    email: 'adaeze.n@gmail.com',
    phone: '+49-170-234-5678',
    country: 'Germany',
    city: 'Berlin',
    kycStatus: 'Verified',
    role: 'Sender',
    corridor: 'EUR → NGN',
    totalRemittances: 12,
    totalVolume: 8400,
    currency: 'EUR',
    avgAmount: 700,
    lastRemittance: '2024-01-20',
    firstRemittance: '2023-07-01',
    frequentRecipients: ['Nnamdi Enterprises (Business)'],
    preferredChannel: 'Web Portal',
    complianceScore: 88,
    sanctionsCleared: true,
    source: 'remittance'
  }
]

const corridorData = [
  { corridor: 'GBP → NGN', country: 'United Kingdom', volume: 45000000, transactions: 12500, avgAmount: 3600, growth: 15.2, senders: 3200, receivers: 4800 },
  { corridor: 'USD → NGN', country: 'United States', volume: 125000000, transactions: 35000, avgAmount: 3571, growth: 22.5, senders: 8500, receivers: 12000 },
  { corridor: 'EUR → NGN', country: 'Europe', volume: 32000000, transactions: 8200, avgAmount: 3902, growth: 18.7, senders: 2100, receivers: 3200 },
  { corridor: 'AED → NGN', country: 'UAE', volume: 28000000, transactions: 6800, avgAmount: 4118, growth: 28.3, senders: 1800, receivers: 2600 },
  { corridor: 'CAD → NGN', country: 'Canada', volume: 18000000, transactions: 4500, avgAmount: 4000, growth: 12.8, senders: 1200, receivers: 1900 },
  { corridor: 'ZAR → NGN', country: 'South Africa', volume: 8500000, transactions: 3200, avgAmount: 2656, growth: 35.1, senders: 900, receivers: 1400 },
  { corridor: 'GHS → NGN', country: 'Ghana', volume: 5200000, transactions: 2800, avgAmount: 1857, growth: 42.5, senders: 750, receivers: 1100 },
  { corridor: 'CNY → NGN', country: 'China', volume: 15000000, transactions: 2200, avgAmount: 6818, growth: 55.2, senders: 600, receivers: 850 },
]

export const remittanceAdapter = {
  async fetchCustomers(filters = {}) {
    await new Promise(r => setTimeout(r, 300))
    let customers = [...remittanceCustomers]
    if (filters.role) customers = customers.filter(c => c.role === filters.role)
    if (filters.corridor) customers = customers.filter(c => c.corridor === filters.corridor)
    return customers
  },

  async fetchCorridorData() {
    await new Promise(r => setTimeout(r, 250))
    return corridorData
  },

  async getMetrics() {
    await new Promise(r => setTimeout(r, 300))
    return {
      totalVolume: 276700000,
      totalTransactions: 75200,
      uniqueSenders: 19050,
      uniqueReceivers: 27850,
      avgTransactionSize: 3680,
      corridors: 8,
      topCorridor: 'USD → NGN',
      topCorridorVolume: 125000000,
      monthlyGrowth: 8.5,
      yearlyGrowth: 24.3,
      complianceRate: 99.2,
      sanctionsHitRate: 0.02,
      avgCompletionTime: '4.2 hours',
      failureRate: 1.8,
      mobileChannelShare: 62,
      bankTransferShare: 28,
      cashPickupShare: 10,
      diasporaCountries: 42,
    }
  },

  async fetchMonthlyTrends() {
    await new Promise(r => setTimeout(r, 250))
    return [
      { month: 'Aug', volume: 210000000, transactions: 58000, senders: 15200, receivers: 22100 },
      { month: 'Sep', volume: 225000000, transactions: 62000, senders: 16000, receivers: 23500 },
      { month: 'Oct', volume: 240000000, transactions: 66000, senders: 17100, receivers: 24800 },
      { month: 'Nov', volume: 255000000, transactions: 69000, senders: 17800, receivers: 25900 },
      { month: 'Dec', volume: 268000000, transactions: 72000, senders: 18500, receivers: 27000 },
      { month: 'Jan', volume: 276700000, transactions: 75200, senders: 19050, receivers: 27850 },
    ]
  },

  async fetchComplianceData() {
    await new Promise(r => setTimeout(r, 200))
    return {
      totalScreened: 75200,
      sanctionsHits: 15,
      falsePositives: 12,
      truePositives: 3,
      pepMatches: 8,
      adverseMedia: 5,
      avgScreeningTime: '0.8 seconds',
      manualReviewQueue: 23,
      blockedTransactions: 3,
      reportedSTRs: 7,
    }
  }
}

export default remittanceAdapter
