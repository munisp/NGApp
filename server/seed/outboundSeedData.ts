/**
 * Outbound Remittance Seed Data
 * 
 * Realistic Nigerian IMTO/fintech participant data for development.
 * In production, this data lives in PostgreSQL. In dev mode (no DB),
 * the router serves this data to enable frontend development.
 */

// --- Participants (Licensed IMTOs and Fintechs) ---
export const seedParticipants = [
  {
    id: 1, userId: 101, name: 'PayApp Nigeria Ltd', shortCode: 'PAYAPP',
    type: 'IMTO', cbnLicense: 'CBN/IMTO/2023/001', tier: 'growth',
    status: 'active', prefundAccountId: 'TB-PFND-PAYAPP-001',
    dailyLimit: '5000000000.00', activeCorridors: 8,
    webhookUrl: 'https://api.payapp.ng/webhooks/switch',
    apiKeyPrefix: 'pk_payapp_', onboardedAt: new Date('2024-03-15'),
    createdAt: new Date('2024-01-10'), updatedAt: new Date('2025-04-28'),
  },
  {
    id: 2, userId: 102, name: 'OPay Digital Services', shortCode: 'OPAY',
    type: 'PSP', cbnLicense: 'CBN/PSP/2022/014', tier: 'enterprise',
    status: 'active', prefundAccountId: 'TB-PFND-OPAY-001',
    dailyLimit: '20000000000.00', activeCorridors: 13,
    webhookUrl: 'https://gateway.opay.ng/switch/events',
    apiKeyPrefix: 'pk_opay_', onboardedAt: new Date('2023-11-01'),
    createdAt: new Date('2023-09-20'), updatedAt: new Date('2025-04-30'),
  },
  {
    id: 3, userId: 103, name: 'Moniepoint MFB', shortCode: 'MPOINT',
    type: 'MFB', cbnLicense: 'CBN/MFB/2021/088', tier: 'enterprise',
    status: 'active', prefundAccountId: 'TB-PFND-MPOINT-001',
    dailyLimit: '15000000000.00', activeCorridors: 11,
    webhookUrl: 'https://api.moniepoint.com/switch/webhook',
    apiKeyPrefix: 'pk_mpoint_', onboardedAt: new Date('2024-01-20'),
    createdAt: new Date('2023-12-01'), updatedAt: new Date('2025-05-01'),
  },
  {
    id: 4, userId: 104, name: 'PalmPay Finance', shortCode: 'PALMPAY',
    type: 'PSP', cbnLicense: 'CBN/PSP/2022/031', tier: 'growth',
    status: 'active', prefundAccountId: 'TB-PFND-PALMPAY-001',
    dailyLimit: '8000000000.00', activeCorridors: 7,
    webhookUrl: 'https://api.palmpay.com/v2/switch-events',
    apiKeyPrefix: 'pk_palmpay_', onboardedAt: new Date('2024-05-10'),
    createdAt: new Date('2024-03-01'), updatedAt: new Date('2025-04-25'),
  },
  {
    id: 5, userId: 105, name: 'Kuda MFB', shortCode: 'KUDA',
    type: 'MFB', cbnLicense: 'CBN/MFB/2020/112', tier: 'growth',
    status: 'active', prefundAccountId: 'TB-PFND-KUDA-001',
    dailyLimit: '6000000000.00', activeCorridors: 9,
    webhookUrl: 'https://api.kudabank.com/switch/notifications',
    apiKeyPrefix: 'pk_kuda_', onboardedAt: new Date('2024-02-28'),
    createdAt: new Date('2024-01-15'), updatedAt: new Date('2025-04-29'),
  },
  {
    id: 6, userId: 106, name: 'Flutterwave Technology', shortCode: 'FLUTTER',
    type: 'IMTO', cbnLicense: 'CBN/IMTO/2021/005', tier: 'premium',
    status: 'active', prefundAccountId: 'TB-PFND-FLUTTER-001',
    dailyLimit: '50000000000.00', activeCorridors: 13,
    webhookUrl: 'https://api.flutterwave.com/v3/switch',
    apiKeyPrefix: 'pk_flutter_', onboardedAt: new Date('2023-06-01'),
    createdAt: new Date('2023-04-15'), updatedAt: new Date('2025-05-02'),
  },
  {
    id: 7, userId: 107, name: 'Chipper Cash Nigeria', shortCode: 'CHIPPER',
    type: 'IMTO', cbnLicense: 'CBN/IMTO/2022/009', tier: 'growth',
    status: 'active', prefundAccountId: 'TB-PFND-CHIPPER-001',
    dailyLimit: '4000000000.00', activeCorridors: 6,
    webhookUrl: 'https://api.chippercash.com/ng/switch',
    apiKeyPrefix: 'pk_chipper_', onboardedAt: new Date('2024-04-01'),
    createdAt: new Date('2024-02-10'), updatedAt: new Date('2025-04-20'),
  },
  {
    id: 8, userId: 108, name: 'LemFi (Formerly Lemonade Finance)', shortCode: 'LEMFI',
    type: 'IMTO', cbnLicense: 'CBN/IMTO/2023/003', tier: 'starter',
    status: 'active', prefundAccountId: 'TB-PFND-LEMFI-001',
    dailyLimit: '2000000000.00', activeCorridors: 5,
    webhookUrl: 'https://api.lemfi.com/switch/events',
    apiKeyPrefix: 'pk_lemfi_', onboardedAt: new Date('2024-08-15'),
    createdAt: new Date('2024-06-01'), updatedAt: new Date('2025-04-18'),
  },
];

// --- Prefund Accounts (TigerBeetle ledger) ---
export const seedPrefundAccounts = [
  {
    id: 1, participantId: 1, accountRef: 'TB-PFND-PAYAPP-001',
    balance: '847250000.00', dailyLimit: '5000000000.00',
    todayDeductions: '152750000.00', lowBalanceThreshold: '200000000.00',
    settlementBank: 'Zenith Bank Plc', accountFamily: 'fintech_prefund_ngn',
    lastTopUpAt: new Date('2025-05-01'), createdAt: new Date('2024-03-15'), updatedAt: new Date('2025-05-02'),
  },
  {
    id: 2, participantId: 2, accountRef: 'TB-PFND-OPAY-001',
    balance: '4250000000.00', dailyLimit: '20000000000.00',
    todayDeductions: '1750000000.00', lowBalanceThreshold: '1000000000.00',
    settlementBank: 'Access Bank Plc', accountFamily: 'fintech_prefund_ngn',
    lastTopUpAt: new Date('2025-05-02'), createdAt: new Date('2023-11-01'), updatedAt: new Date('2025-05-02'),
  },
  {
    id: 3, participantId: 3, accountRef: 'TB-PFND-MPOINT-001',
    balance: '2890000000.00', dailyLimit: '15000000000.00',
    todayDeductions: '3110000000.00', lowBalanceThreshold: '500000000.00',
    settlementBank: 'First Bank of Nigeria', accountFamily: 'fintech_prefund_ngn',
    lastTopUpAt: new Date('2025-05-02'), createdAt: new Date('2024-01-20'), updatedAt: new Date('2025-05-02'),
  },
  {
    id: 4, participantId: 4, accountRef: 'TB-PFND-PALMPAY-001',
    balance: '1320000000.00', dailyLimit: '8000000000.00',
    todayDeductions: '680000000.00', lowBalanceThreshold: '300000000.00',
    settlementBank: 'GTBank Plc', accountFamily: 'fintech_prefund_ngn',
    lastTopUpAt: new Date('2025-04-30'), createdAt: new Date('2024-05-10'), updatedAt: new Date('2025-05-01'),
  },
  {
    id: 5, participantId: 5, accountRef: 'TB-PFND-KUDA-001',
    balance: '956000000.00', dailyLimit: '6000000000.00',
    todayDeductions: '544000000.00', lowBalanceThreshold: '200000000.00',
    settlementBank: 'Providus Bank', accountFamily: 'fintech_prefund_ngn',
    lastTopUpAt: new Date('2025-05-01'), createdAt: new Date('2024-02-28'), updatedAt: new Date('2025-05-02'),
  },
  {
    id: 6, participantId: 6, accountRef: 'TB-PFND-FLUTTER-001',
    balance: '12450000000.00', dailyLimit: '50000000000.00',
    todayDeductions: '7550000000.00', lowBalanceThreshold: '2000000000.00',
    settlementBank: 'Wema Bank Plc', accountFamily: 'fintech_prefund_ngn',
    lastTopUpAt: new Date('2025-05-02'), createdAt: new Date('2023-06-01'), updatedAt: new Date('2025-05-02'),
  },
  {
    id: 7, participantId: 7, accountRef: 'TB-PFND-CHIPPER-001',
    balance: '623000000.00', dailyLimit: '4000000000.00',
    todayDeductions: '377000000.00', lowBalanceThreshold: '150000000.00',
    settlementBank: 'Sterling Bank', accountFamily: 'fintech_prefund_ngn',
    lastTopUpAt: new Date('2025-04-29'), createdAt: new Date('2024-04-01'), updatedAt: new Date('2025-05-01'),
  },
  {
    id: 8, participantId: 8, accountRef: 'TB-PFND-LEMFI-001',
    balance: '287000000.00', dailyLimit: '2000000000.00',
    todayDeductions: '113000000.00', lowBalanceThreshold: '100000000.00',
    settlementBank: 'UBA Plc', accountFamily: 'fintech_prefund_ngn',
    lastTopUpAt: new Date('2025-04-28'), createdAt: new Date('2024-08-15'), updatedAt: new Date('2025-04-30'),
  },
];

// --- Outbound Transfers ---
const transferTemplates = [
  // PayApp transfers (participantId: 1)
  { participantId: 1, senderRef: 'PAYAPP-CUS-00412', beneficiaryName: 'Kwame Asante', beneficiaryAccount: 'GH-0291847562', corridor: 'NG-GH', amountNgn: '2500000.00', amountDest: '3,125 GHS', destCurrency: 'GHS', fxRate: '0.00125000', provider: 'Flutterwave', status: 'completed', lifecycleStep: 'G-Audit', complianceResult: 'clear', feeAmount: '12500.00', purpose: 'Family Support' },
  { participantId: 1, senderRef: 'PAYAPP-CUS-00418', beneficiaryName: 'John Smith', beneficiaryAccount: 'GB-SORT-204512-81927364', corridor: 'NG-GB', amountNgn: '15000000.00', amountDest: '11,538 GBP', destCurrency: 'GBP', fxRate: '0.00076920', provider: 'Wise', status: 'completed', lifecycleStep: 'G-Audit', complianceResult: 'clear', feeAmount: '75000.00', purpose: 'Education' },
  { participantId: 1, senderRef: 'PAYAPP-CUS-00421', beneficiaryName: 'Raj Patel', beneficiaryAccount: 'IN-IFSC-SBIN0001234-9876543210', corridor: 'NG-IN', amountNgn: '8500000.00', amountDest: '694,215 INR', destCurrency: 'INR', fxRate: '0.08167235', provider: 'WorldRemit', status: 'routing', lifecycleStep: 'E-Routing', complianceResult: 'clear', feeAmount: '42500.00', purpose: 'Medical' },
  { participantId: 1, senderRef: 'PAYAPP-CUS-00423', beneficiaryName: 'Amadou Diallo', beneficiaryAccount: 'SN-BCEAO-00281937', corridor: 'NG-SN', amountNgn: '1200000.00', amountDest: '789,474 XOF', destCurrency: 'XOF', fxRate: '0.65789500', provider: 'MTN MoMo', status: 'admitted', lifecycleStep: 'B-Workflow', complianceResult: null, feeAmount: '6000.00', purpose: 'Family Support' },
  { participantId: 1, senderRef: 'PAYAPP-CUS-00425', beneficiaryName: 'Chen Wei', beneficiaryAccount: 'CN-SWIFT-ICBKCNBJ-6221881234', corridor: 'NG-CN', amountNgn: '45000000.00', amountDest: '456,621 CNY', destCurrency: 'CNY', fxRate: '0.01014714', provider: 'Mojaloop Hub', status: 'manual_review', lifecycleStep: 'C-Compliance', complianceResult: 'escalated', feeAmount: '225000.00', purpose: 'Business Payment' },
  // OPay transfers (participantId: 2)
  { participantId: 2, senderRef: 'OPAY-TXN-90182', beneficiaryName: 'Sarah Johnson', beneficiaryAccount: 'US-ACH-021000021-4567891234', corridor: 'NG-US', amountNgn: '25000000.00', amountDest: '16,129 USD', destCurrency: 'USD', fxRate: '0.00064516', provider: 'Wise', status: 'completed', lifecycleStep: 'G-Audit', complianceResult: 'clear', feeAmount: '125000.00', purpose: 'Education' },
  { participantId: 2, senderRef: 'OPAY-TXN-90185', beneficiaryName: 'Kofi Mensah', beneficiaryAccount: 'GH-0398271645', corridor: 'NG-GH', amountNgn: '5000000.00', amountDest: '6,250 GHS', destCurrency: 'GHS', fxRate: '0.00125000', provider: 'Flutterwave', status: 'completed', lifecycleStep: 'G-Audit', complianceResult: 'clear', feeAmount: '25000.00', purpose: 'Family Support' },
  { participantId: 2, senderRef: 'OPAY-TXN-90191', beneficiaryName: 'Mohammed Al-Rashid', beneficiaryAccount: 'AE-IBAN-AE070331234567890123456', corridor: 'NG-AE', amountNgn: '75000000.00', amountDest: '48,387 USD', destCurrency: 'AED', fxRate: '0.00064516', provider: 'Mojaloop Hub', status: 'routing', lifecycleStep: 'E-Routing', complianceResult: 'clear', feeAmount: '375000.00', purpose: 'Business Payment' },
  // Moniepoint transfers (participantId: 3)
  { participantId: 3, senderRef: 'MPOINT-REF-44201', beneficiaryName: 'Emma Thompson', beneficiaryAccount: 'GB-SORT-301927-65432189', corridor: 'NG-GB', amountNgn: '30000000.00', amountDest: '23,077 GBP', destCurrency: 'GBP', fxRate: '0.00076923', provider: 'Wise', status: 'completed', lifecycleStep: 'G-Audit', complianceResult: 'clear', feeAmount: '150000.00', purpose: 'Education' },
  { participantId: 3, senderRef: 'MPOINT-REF-44208', beneficiaryName: 'Fatima Bello', beneficiaryAccount: 'KE-MPESA-254721234567', corridor: 'NG-KE', amountNgn: '3500000.00', amountDest: '32,407 KES', destCurrency: 'KES', fxRate: '0.00925920', provider: 'MTN MoMo', status: 'admitted', lifecycleStep: 'C-Compliance', complianceResult: null, feeAmount: '17500.00', purpose: 'Family Support' },
  // Kuda transfers (participantId: 5)
  { participantId: 5, senderRef: 'KUDA-OUT-77321', beneficiaryName: 'Pierre Dupont', beneficiaryAccount: 'CA-TRANSIT-00419-1234567', corridor: 'NG-CA', amountNgn: '12000000.00', amountDest: '11,111 CAD', destCurrency: 'CAD', fxRate: '0.00092593', provider: 'WorldRemit', status: 'completed', lifecycleStep: 'G-Audit', complianceResult: 'clear', feeAmount: '60000.00', purpose: 'Education' },
  { participantId: 5, senderRef: 'KUDA-OUT-77329', beneficiaryName: 'Blessing Okafor', beneficiaryAccount: 'ZA-FNB-62519284731', corridor: 'NG-ZA', amountNgn: '4200000.00', amountDest: '42,857 ZAR', destCurrency: 'ZAR', fxRate: '0.01019929', provider: 'Chipper Cash', status: 'failed', lifecycleStep: 'E-Routing', complianceResult: 'clear', feeAmount: '21000.00', purpose: 'Family Support' },
  // Flutterwave transfers (participantId: 6)
  { participantId: 6, senderRef: 'FLW-BATCH-2025-0501-001', beneficiaryName: 'Ali Hassan', beneficiaryAccount: 'TR-IBAN-TR330006100519786457841326', corridor: 'NG-TR', amountNgn: '18000000.00', amountDest: '388,889 TRY', destCurrency: 'TRY', fxRate: '0.02160494', provider: 'Mojaloop Hub', status: 'completed', lifecycleStep: 'G-Audit', complianceResult: 'clear', feeAmount: '90000.00', purpose: 'Medical' },
  { participantId: 6, senderRef: 'FLW-BATCH-2025-0501-002', beneficiaryName: 'Grace Adeyemi', beneficiaryAccount: 'GH-0456781234', corridor: 'NG-GH', amountNgn: '950000.00', amountDest: '1,188 GHS', destCurrency: 'GHS', fxRate: '0.00125000', provider: 'Flutterwave', status: 'completed', lifecycleStep: 'G-Audit', complianceResult: 'clear', feeAmount: '4750.00', purpose: 'Family Support' },
  { participantId: 6, senderRef: 'FLW-BATCH-2025-0502-001', beneficiaryName: 'BLOCKED ENTITY - Hassan Nasrallah Foundation', beneficiaryAccount: 'AE-BLOCKED-000', corridor: 'NG-AE', amountNgn: '150000000.00', amountDest: '96,774 USD', destCurrency: 'AED', fxRate: '0.00064516', provider: null, status: 'blocked', lifecycleStep: 'C-Compliance', complianceResult: 'blocked', feeAmount: '750000.00', purpose: 'Business Payment' },
];

let transferId = 0;
export const seedTransfers = transferTemplates.map((t) => {
  transferId++;
  const daysAgo = Math.floor(Math.random() * 7);
  const submittedAt = new Date(Date.now() - daysAgo * 86400000 - Math.random() * 86400000);
  return {
    id: transferId,
    transferRef: `NOR-${new Date().getFullYear()}-${String(transferId).padStart(8, '0')}`,
    ...t,
    submittedAt,
    completedAt: t.status === 'completed' ? new Date(submittedAt.getTime() + Math.random() * 3600000) : null,
    createdAt: submittedAt,
  };
});

// --- Compliance Screenings ---
export const seedComplianceScreenings = [
  { id: 1, transferId: 5, participantId: 1, screeningType: 'sanctions', listChecked: 'OFAC SDN', matchScore: '0.8200', decision: 'escalated', matchedEntity: 'Chen Wei (partial match - common name)', reviewedBy: null, reviewedAt: null, createdAt: new Date('2025-05-02T09:15:00Z') },
  { id: 2, transferId: 5, participantId: 1, screeningType: 'pep', listChecked: 'CBN PEP List', matchScore: '0.4500', decision: 'clear', matchedEntity: null, reviewedBy: null, reviewedAt: null, createdAt: new Date('2025-05-02T09:15:01Z') },
  { id: 3, transferId: 15, participantId: 6, screeningType: 'sanctions', listChecked: 'OFAC SDN', matchScore: '0.9800', decision: 'blocked', matchedEntity: 'Hassan Nasrallah Foundation (exact match - OFAC SDN List)', reviewedBy: 201, reviewedAt: new Date('2025-05-02T10:30:00Z'), createdAt: new Date('2025-05-02T10:00:00Z') },
  { id: 4, transferId: 15, participantId: 6, screeningType: 'sanctions', listChecked: 'UN Consolidated', matchScore: '0.9600', decision: 'blocked', matchedEntity: 'Hassan Nasrallah Foundation (UN Security Council Resolution 1701)', reviewedBy: 201, reviewedAt: new Date('2025-05-02T10:30:00Z'), createdAt: new Date('2025-05-02T10:00:01Z') },
  { id: 5, transferId: 8, participantId: 2, screeningType: 'sanctions', listChecked: 'OFAC SDN', matchScore: '0.3200', decision: 'clear', matchedEntity: null, reviewedBy: null, reviewedAt: null, createdAt: new Date('2025-05-01T14:22:00Z') },
  { id: 6, transferId: 10, participantId: 3, screeningType: 'aml', listChecked: 'CBN Watchlist', matchScore: '0.2100', decision: 'clear', matchedEntity: null, reviewedBy: null, reviewedAt: null, createdAt: new Date('2025-04-30T16:45:00Z') },
];

// --- Participant Billing ---
export const seedBilling = [
  { id: 1, participantId: 1, billingPeriod: '2025-04', subscriptionFee: '500000.00', transactionFees: '156250.00', corridorFees: '85000.00', fxRevenueShare: '42500.00', totalAmount: '783750.00', status: 'paid', invoiceRef: 'INV-PAYAPP-2025-04', paidAt: new Date('2025-04-28'), createdAt: new Date('2025-04-01') },
  { id: 2, participantId: 1, billingPeriod: '2025-05', subscriptionFee: '500000.00', transactionFees: '62500.00', corridorFees: '34000.00', fxRevenueShare: '17000.00', totalAmount: '613500.00', status: 'pending', invoiceRef: 'INV-PAYAPP-2025-05', paidAt: null, createdAt: new Date('2025-05-01') },
  { id: 3, participantId: 2, billingPeriod: '2025-04', subscriptionFee: '2000000.00', transactionFees: '525000.00', corridorFees: '280000.00', fxRevenueShare: '156000.00', totalAmount: '2961000.00', status: 'paid', invoiceRef: 'INV-OPAY-2025-04', paidAt: new Date('2025-04-25'), createdAt: new Date('2025-04-01') },
  { id: 4, participantId: 3, billingPeriod: '2025-04', subscriptionFee: '2000000.00', transactionFees: '475000.00', corridorFees: '210000.00', fxRevenueShare: '125000.00', totalAmount: '2810000.00', status: 'paid', invoiceRef: 'INV-MPOINT-2025-04', paidAt: new Date('2025-04-27'), createdAt: new Date('2025-04-01') },
  { id: 5, participantId: 5, billingPeriod: '2025-04', subscriptionFee: '500000.00', transactionFees: '81000.00', corridorFees: '45000.00', fxRevenueShare: '22000.00', totalAmount: '648000.00', status: 'paid', invoiceRef: 'INV-KUDA-2025-04', paidAt: new Date('2025-04-30'), createdAt: new Date('2025-04-01') },
  { id: 6, participantId: 6, billingPeriod: '2025-04', subscriptionFee: '5000000.00', transactionFees: '1844750.00', corridorFees: '920000.00', fxRevenueShare: '485000.00', totalAmount: '8249750.00', status: 'paid', invoiceRef: 'INV-FLUTTER-2025-04', paidAt: new Date('2025-04-22'), createdAt: new Date('2025-04-01') },
];

// --- Disputes ---
export interface SeedDispute {
  id: number;
  transferId: number;
  participantId: number;
  disputeRef: string;
  type: string;
  reason: string;
  amount: string;
  status: string;
  priority: string;
  assignedTo: number | null;
  resolution: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

export const seedDisputes: SeedDispute[] = [
  { id: 1, transferId: 12, participantId: 5, disputeRef: 'DSP-2025-00001', type: 'failed_delivery', reason: 'Beneficiary reports funds not received after 48 hours', amount: '4200000.00', status: 'open', priority: 'high', assignedTo: null, resolution: null, resolvedAt: null, createdAt: new Date('2025-05-01T14:00:00Z') },
  { id: 2, transferId: 3, participantId: 1, disputeRef: 'DSP-2025-00002', type: 'wrong_amount', reason: 'Beneficiary received 690,000 INR instead of 694,215 INR — FX discrepancy', amount: '8500000.00', status: 'under_review', priority: 'medium', assignedTo: 201, resolution: null, resolvedAt: null, createdAt: new Date('2025-04-30T10:00:00Z') },
  { id: 3, transferId: 6, participantId: 2, disputeRef: 'DSP-2025-00003', type: 'duplicate_charge', reason: 'Customer charged twice for same transfer — prefund deducted 2x', amount: '25000000.00', status: 'resolved', priority: 'critical', assignedTo: 202, resolution: 'Confirmed duplicate deduction. Prefund credited ₦25M. TigerBeetle void posted.', resolvedAt: new Date('2025-04-29T16:30:00Z'), createdAt: new Date('2025-04-28T09:00:00Z') },
];

// --- Funding Requests ---
export interface SeedFundingRequest {
  id: number;
  participantId: number;
  requestRef: string;
  amount: string;
  sourceBank: string;
  sourceAccount: string;
  method: string;
  status: string;
  approvedBy: number | null;
  approvedAt: Date | null;
  settledAt: Date | null;
  createdAt: Date;
}

export const seedFundingRequests: SeedFundingRequest[] = [
  { id: 1, participantId: 1, requestRef: 'FUND-PAYAPP-20250501-001', amount: '500000000.00', sourceBank: 'Zenith Bank Plc', sourceAccount: '2081234567', method: 'RTGS', status: 'completed', approvedBy: 201, approvedAt: new Date('2025-05-01T08:30:00Z'), settledAt: new Date('2025-05-01T09:15:00Z'), createdAt: new Date('2025-05-01T08:00:00Z') },
  { id: 2, participantId: 2, requestRef: 'FUND-OPAY-20250502-001', amount: '2000000000.00', sourceBank: 'Access Bank Plc', sourceAccount: '0012345678', method: 'RTGS', status: 'pending_approval', approvedBy: null, approvedAt: null, settledAt: null, createdAt: new Date('2025-05-02T07:30:00Z') },
  { id: 3, participantId: 5, requestRef: 'FUND-KUDA-20250430-001', amount: '300000000.00', sourceBank: 'Providus Bank', sourceAccount: '1098765432', method: 'NIP', status: 'completed', approvedBy: 202, approvedAt: new Date('2025-04-30T11:00:00Z'), settledAt: new Date('2025-04-30T11:02:00Z'), createdAt: new Date('2025-04-30T10:45:00Z') },
];

// --- Tier Upgrade Requests ---
export interface SeedTierUpgrade {
  id: number;
  participantId: number;
  currentTier: string;
  requestedTier: string;
  justification: string;
  monthlyVolume: string;
  status: string;
  reviewedBy: number | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

export const seedTierUpgrades: SeedTierUpgrade[] = [
  { id: 1, participantId: 1, currentTier: 'growth', requestedTier: 'enterprise', justification: 'Monthly volume consistently exceeds ₦4B. Need higher daily limits and all 13 corridors.', monthlyVolume: '4200000000.00', status: 'pending_review', reviewedBy: null, reviewedAt: null, createdAt: new Date('2025-04-28T09:00:00Z') },
  { id: 2, participantId: 8, currentTier: 'starter', requestedTier: 'growth', justification: 'Completed 6 months on platform. Volume growing 30% MoM. Need 8+ corridors.', monthlyVolume: '850000000.00', status: 'approved', reviewedBy: 201, reviewedAt: new Date('2025-04-25T14:00:00Z'), createdAt: new Date('2025-04-20T11:00:00Z') },
];

// --- Approval Queue (CBN/Admin) ---
export interface SeedApproval {
  id: number;
  entityType: string;
  entityId: number;
  action: string;
  requestedBy: number;
  requestedByName: string;
  reason: string;
  status: string;
  approvedBy: number | null;
  approvedAt: Date | null;
  createdAt: Date;
}

export const seedApprovals: SeedApproval[] = [
  { id: 1, entityType: 'transfer', entityId: 5, action: 'release_from_hold', requestedBy: 101, requestedByName: 'PayApp Nigeria Ltd', reason: 'Compliance escalation — Chen Wei common name match. Customer verified via enhanced due diligence.', status: 'pending', approvedBy: null, approvedAt: null, createdAt: new Date('2025-05-02T09:20:00Z') },
  { id: 2, entityType: 'funding', entityId: 2, action: 'approve_funding', requestedBy: 102, requestedByName: 'OPay Digital Services', reason: 'RTGS funding request ₦2B from Access Bank', status: 'pending', approvedBy: null, approvedAt: null, createdAt: new Date('2025-05-02T07:30:00Z') },
  { id: 3, entityType: 'tier_upgrade', entityId: 1, action: 'approve_upgrade', requestedBy: 101, requestedByName: 'PayApp Nigeria Ltd', reason: 'Upgrade from Growth to Enterprise tier — monthly volume ₦4.2B', status: 'pending', approvedBy: null, approvedAt: null, createdAt: new Date('2025-04-28T09:00:00Z') },
  { id: 4, entityType: 'onboarding', entityId: 9, action: 'approve_onboarding', requestedBy: 0, requestedByName: 'TerraPay Global', reason: 'New IMTO application — CBN license CBN/IMTO/2024/011', status: 'pending', approvedBy: null, approvedAt: null, createdAt: new Date('2025-04-25T10:00:00Z') },
  { id: 5, entityType: 'transfer', entityId: 15, action: 'confirm_block', requestedBy: 201, requestedByName: 'System (Auto-block)', reason: 'OFAC SDN exact match — Hassan Nasrallah Foundation. Awaiting CBN confirmation to file SAR.', status: 'pending', approvedBy: null, approvedAt: null, createdAt: new Date('2025-05-02T10:30:00Z') },
];

// --- CBN Enforcement Actions ---
export type EnforcementAction = {
  id: number;
  participantId: number;
  participantName: string;
  type: 'suspension' | 'corridor_restriction' | 'limit_override' | 'compliance_directive' | 'license_revocation' | 'warning' | 'show_cause';
  status: 'active' | 'resolved' | 'expired' | 'pending_review';
  reason: string;
  cbnReference: string;
  issuedBy: string;
  issuedAt: Date;
  effectiveAt: Date;
  expiresAt: Date | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
  details: Record<string, any>;
};

export const seedEnforcementActions: EnforcementAction[] = [
  {
    id: 1, participantId: 7, participantName: 'Chipper Cash Nigeria',
    type: 'suspension', status: 'active',
    reason: 'Elevated sanctions hit rate (8.2%) exceeding 5% threshold over 30-day rolling window. Multiple OFAC partial matches on NG-AE and NG-CN corridors.',
    cbnReference: 'CBN/ENF/2026/0042', issuedBy: 'CBN Compliance Division',
    issuedAt: new Date('2026-04-28T10:00:00Z'), effectiveAt: new Date('2026-04-28T12:00:00Z'),
    expiresAt: null, resolvedAt: null, resolvedBy: null, resolutionNote: null,
    details: { sanctionsHitRate: 8.2, threshold: 5, period: '30d', affectedCorridors: ['NG-AE', 'NG-CN'], blockedTransfers: 12, prefundFrozen: true },
  },
  {
    id: 2, participantId: 4, participantName: 'PalmPay Finance',
    type: 'corridor_restriction', status: 'active',
    reason: 'Elevated AML risk on NG-TR corridor. Structuring patterns detected in 14 transactions over 2 weeks.',
    cbnReference: 'CBN/ENF/2026/0039', issuedBy: 'CBN AML Unit',
    issuedAt: new Date('2026-04-25T14:00:00Z'), effectiveAt: new Date('2026-04-25T16:00:00Z'),
    expiresAt: new Date('2026-05-25T16:00:00Z'), resolvedAt: null, resolvedBy: null, resolutionNote: null,
    details: { restrictedCorridors: ['NG-TR'], structuringCount: 14, originalCorridors: 7, remainingCorridors: 6 },
  },
  {
    id: 3, participantId: 8, participantName: 'LemFi (Formerly Lemonade Finance)',
    type: 'limit_override', status: 'active',
    reason: 'Pending investigation into high-value transfers exceeding declared business volume. Daily limit reduced from ₦2B to ₦500M.',
    cbnReference: 'CBN/ENF/2026/0041', issuedBy: 'CBN Supervision Department',
    issuedAt: new Date('2026-04-27T09:00:00Z'), effectiveAt: new Date('2026-04-27T09:00:00Z'),
    expiresAt: new Date('2026-05-27T09:00:00Z'), resolvedAt: null, resolvedBy: null, resolutionNote: null,
    details: { originalLimit: '2000000000.00', overrideLimit: '500000000.00', originalTxnMax: null, overrideTxnMax: '50000000.00' },
  },
  {
    id: 4, participantId: 4, participantName: 'PalmPay Finance',
    type: 'compliance_directive', status: 'pending_review',
    reason: 'Show-cause notice: Failure to implement enhanced due diligence (EDD) for PEP beneficiaries as required under CBN AML/CFT Regulations 2022.',
    cbnReference: 'CBN/DIR/2026/0015', issuedBy: 'CBN Director of Banking Supervision',
    issuedAt: new Date('2026-04-20T11:00:00Z'), effectiveAt: new Date('2026-04-20T11:00:00Z'),
    expiresAt: new Date('2026-05-20T11:00:00Z'), resolvedAt: null, resolvedBy: null, resolutionNote: null,
    details: { directiveType: 'show_cause', deadline: '2026-05-20', requiresResponse: true, responseReceived: false, requiredActions: ['Implement EDD for PEP beneficiaries', 'Submit updated AML/CFT compliance manual', 'Provide 90-day transaction review report'] },
  },
  {
    id: 5, participantId: 5, participantName: 'Kuda MFB',
    type: 'warning', status: 'resolved',
    reason: 'SLA breach: Settlement confirmation latency exceeded 48h SLA on 6 occasions in April 2026.',
    cbnReference: 'CBN/WARN/2026/0028', issuedBy: 'CBN Payment Systems Department',
    issuedAt: new Date('2026-04-15T08:00:00Z'), effectiveAt: new Date('2026-04-15T08:00:00Z'),
    expiresAt: null, resolvedAt: new Date('2026-04-22T16:00:00Z'), resolvedBy: 'CBN Payment Systems Department',
    resolutionNote: 'Kuda provided root cause analysis and remediation plan. Settlement processing upgraded to dedicated infrastructure.',
    details: { slaBreachCount: 6, slaTarget: '48h', worstCase: '72h', affectedCorridors: ['NG-US', 'NG-GB'] },
  },
];

// --- Auto-Suspension Triggers ---
export type AutoSuspensionTrigger = {
  id: number;
  name: string;
  description: string;
  metric: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte';
  threshold: number;
  unit: string;
  windowDays: number;
  action: 'suspend' | 'restrict_corridors' | 'reduce_limit' | 'warning';
  isActive: boolean;
  lastTriggered: Date | null;
  triggeredCount: number;
  createdBy: string;
  createdAt: Date;
};

export const seedAutoTriggers: AutoSuspensionTrigger[] = [
  { id: 1, name: 'High Sanctions Hit Rate', description: 'Auto-suspend participant if sanctions screening hit rate exceeds threshold', metric: 'sanctions_hit_rate', operator: 'gt', threshold: 5, unit: '%', windowDays: 30, action: 'suspend', isActive: true, lastTriggered: new Date('2026-04-28T10:00:00Z'), triggeredCount: 1, createdBy: 'CBN Compliance', createdAt: new Date('2026-01-15') },
  { id: 2, name: 'Excessive SLA Breaches', description: 'Issue warning if settlement SLA breaches exceed count in window', metric: 'sla_breach_count', operator: 'gt', threshold: 10, unit: 'breaches', windowDays: 30, action: 'warning', isActive: true, lastTriggered: null, triggeredCount: 0, createdBy: 'CBN Payment Systems', createdAt: new Date('2026-02-01') },
  { id: 3, name: 'Structuring Detection', description: 'Restrict corridors if structuring pattern score exceeds threshold', metric: 'structuring_score', operator: 'gt', threshold: 75, unit: 'score', windowDays: 14, action: 'restrict_corridors', isActive: true, lastTriggered: new Date('2026-04-25T14:00:00Z'), triggeredCount: 1, createdBy: 'CBN AML Unit', createdAt: new Date('2026-01-20') },
  { id: 4, name: 'Volume Anomaly', description: 'Reduce daily limit if transfer volume exceeds 200% of 90-day average', metric: 'volume_anomaly_pct', operator: 'gt', threshold: 200, unit: '%', windowDays: 7, action: 'reduce_limit', isActive: true, lastTriggered: null, triggeredCount: 0, createdBy: 'CBN Supervision', createdAt: new Date('2026-03-01') },
  { id: 5, name: 'Failed Transfer Spike', description: 'Issue warning if failure rate exceeds threshold', metric: 'failure_rate', operator: 'gt', threshold: 15, unit: '%', windowDays: 7, action: 'warning', isActive: false, lastTriggered: null, triggeredCount: 0, createdBy: 'CBN Operations', createdAt: new Date('2026-03-15') },
];
