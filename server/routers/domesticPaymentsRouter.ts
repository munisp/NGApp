import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, router } from '../_core/trpc';

// --- Types & Seed Data ---

type DomesticPayment = {
  id: string;
  type: string;
  status: string;
  senderAcct: string;
  senderBank: string;
  senderName: string;
  receiverAcct: string;
  receiverBank: string;
  receiverName: string;
  amount: number;
  fee: number;
  nipRef: string;
  channel: string;
  narration: string;
  initiatedAt: Date;
  completedAt: Date | null;
};

type BillProvider = {
  id: string;
  name: string;
  category: string;
  services: string[];
  isActive: boolean;
  avgProcessMs: number;
};

type StandingOrder = {
  id: string;
  payerAcct: string;
  payerBank: string;
  payeeAcct: string;
  payeeBank: string;
  payeeName: string;
  amount: number;
  frequency: string;
  nextExecDate: Date;
  status: string;
  executions: number;
};

type BulkDisbursement = {
  id: string;
  initiatorName: string;
  totalItems: number;
  processedItems: number;
  successCount: number;
  failedCount: number;
  totalAmount: number;
  status: string;
  submittedAt: Date;
};

const seedPayments: DomesticPayment[] = [
  { id: 'DPY-001', type: 'P2P', status: 'COMPLETED', senderAcct: '0044100001', senderBank: 'Access Bank', senderName: 'Adebayo Ogunlade', receiverAcct: '0058200002', receiverBank: 'GTBank', receiverName: 'Chioma Okafor', amount: 250000, fee: 25, nipRef: 'NIP-D-001', channel: 'mobile_app', narration: 'Family support', initiatedAt: new Date('2026-05-01T08:00:00Z'), completedAt: new Date('2026-05-01T08:00:02Z') },
  { id: 'DPY-002', type: 'P2B', status: 'COMPLETED', senderAcct: '0058200002', senderBank: 'GTBank', senderName: 'Chioma Okafor', receiverAcct: '0057300003', receiverBank: 'Zenith Bank', receiverName: 'ShopRite Nigeria', amount: 45600, fee: 228, nipRef: 'NIP-D-002', channel: 'POS', narration: 'Grocery purchase', initiatedAt: new Date('2026-05-01T09:30:00Z'), completedAt: new Date('2026-05-01T09:30:03Z') },
  { id: 'DPY-003', type: 'QR_PAY', status: 'COMPLETED', senderAcct: '0033400004', senderBank: 'UBA', senderName: 'Emeka Nwosu', receiverAcct: '0011500005', receiverBank: 'First Bank', receiverName: 'Chicken Republic', amount: 3500, fee: 17.5, nipRef: 'NIP-D-003', channel: 'QR_scan', narration: 'Lunch payment', initiatedAt: new Date('2026-05-01T12:15:00Z'), completedAt: new Date('2026-05-01T12:15:01Z') },
  { id: 'DPY-004', type: 'BILL_PAYMENT', status: 'COMPLETED', senderAcct: '0044100001', senderBank: 'Access Bank', senderName: 'Adebayo Ogunlade', receiverAcct: 'EKEDC-PREPAID', receiverBank: 'NIBSS', receiverName: 'Eko Electricity', amount: 20000, fee: 100, nipRef: 'NIP-D-004', channel: 'internet_banking', narration: 'Prepaid meter recharge', initiatedAt: new Date('2026-05-01T14:00:00Z'), completedAt: new Date('2026-05-01T14:00:03Z') },
  { id: 'DPY-005', type: 'BILL_PAYMENT', status: 'COMPLETED', senderAcct: '0057300006', senderBank: 'Zenith Bank', senderName: 'Fatima Bello', receiverAcct: 'DSTV-SUB', receiverBank: 'NIBSS', receiverName: 'DStv MultiChoice', amount: 29500, fee: 100, nipRef: 'NIP-D-005', channel: 'USSD', narration: 'DStv Premium renewal', initiatedAt: new Date('2026-05-01T15:30:00Z'), completedAt: new Date('2026-05-01T15:30:02Z') },
  { id: 'DPY-006', type: 'P2P', status: 'FAILED', senderAcct: '0011500005', senderBank: 'First Bank', senderName: 'Grace Adeyemi', receiverAcct: '0044100099', receiverBank: 'Access Bank', receiverName: 'Unknown', amount: 500000, fee: 50, nipRef: 'NIP-D-006', channel: 'mobile_app', narration: 'Transfer', initiatedAt: new Date('2026-05-01T16:00:00Z'), completedAt: null },
  { id: 'DPY-007', type: 'REQUEST_TO_PAY', status: 'PENDING_APPROVAL', senderAcct: '0033400004', senderBank: 'UBA', senderName: 'Emeka Nwosu', receiverAcct: '0058200007', receiverBank: 'GTBank', receiverName: 'Lagos Gym Club', amount: 75000, fee: 375, nipRef: 'NIP-D-007', channel: 'mobile_app', narration: 'Annual gym membership', initiatedAt: new Date('2026-05-01T17:00:00Z'), completedAt: null },
  { id: 'DPY-008', type: 'USSD', status: 'COMPLETED', senderAcct: '0058200008', senderBank: 'GTBank', senderName: 'Tunde Bakare', receiverAcct: 'MTN-AIRTIME', receiverBank: 'NIBSS', receiverName: 'MTN Nigeria', amount: 5000, fee: 0, nipRef: 'NIP-D-008', channel: 'USSD', narration: '*737# airtime purchase', initiatedAt: new Date('2026-05-01T18:00:00Z'), completedAt: new Date('2026-05-01T18:00:01Z') },
];

const seedBillProviders: BillProvider[] = [
  { id: 'EKEDC', name: 'Eko Electricity Distribution', category: 'electricity', services: ['prepaid', 'postpaid'], isActive: true, avgProcessMs: 3000 },
  { id: 'IKEDC', name: 'Ikeja Electric', category: 'electricity', services: ['prepaid', 'postpaid'], isActive: true, avgProcessMs: 2500 },
  { id: 'DSTV', name: 'DStv (MultiChoice)', category: 'cable_tv', services: ['subscription', 'bouquet_change'], isActive: true, avgProcessMs: 2000 },
  { id: 'GOTV', name: 'GOtv (MultiChoice)', category: 'cable_tv', services: ['subscription'], isActive: true, avgProcessMs: 1800 },
  { id: 'MTN', name: 'MTN Nigeria', category: 'airtime_data', services: ['airtime', 'data_bundle', 'sme_data'], isActive: true, avgProcessMs: 800 },
  { id: 'AIRTEL', name: 'Airtel Nigeria', category: 'airtime_data', services: ['airtime', 'data_bundle'], isActive: true, avgProcessMs: 900 },
  { id: 'GLO', name: 'Globacom', category: 'airtime_data', services: ['airtime', 'data_bundle'], isActive: true, avgProcessMs: 1100 },
  { id: '9MOBILE', name: '9mobile', category: 'airtime_data', services: ['airtime', 'data_bundle'], isActive: true, avgProcessMs: 1000 },
  { id: 'LSWC', name: 'Lagos State Water Corp', category: 'water', services: ['bill_payment'], isActive: true, avgProcessMs: 5000 },
  { id: 'FIRS', name: 'Federal Inland Revenue Service', category: 'tax', services: ['tax_payment', 'tin_verification'], isActive: true, avgProcessMs: 8000 },
];

const seedStandingOrders: StandingOrder[] = [
  { id: 'SO-001', payerAcct: '0044100001', payerBank: 'Access Bank', payeeAcct: '0058200002', payeeBank: 'GTBank', payeeName: 'Chioma Okafor', amount: 100000, frequency: 'monthly', nextExecDate: new Date('2026-06-01'), status: 'active', executions: 4 },
  { id: 'SO-002', payerAcct: '0033400004', payerBank: 'UBA', payeeAcct: 'EKEDC-PREPAID', payeeBank: 'NIBSS', payeeName: 'Eko Electricity', amount: 20000, frequency: 'monthly', nextExecDate: new Date('2026-06-01'), status: 'active', executions: 12 },
  { id: 'SO-003', payerAcct: '0058200008', payerBank: 'GTBank', payeeAcct: '0057300003', payeeBank: 'Zenith Bank', payeeName: 'Lagos Rent Collection', amount: 500000, frequency: 'monthly', nextExecDate: new Date('2026-06-01'), status: 'active', executions: 8 },
];

const seedBulkDisbursements: BulkDisbursement[] = [
  { id: 'BULK-001', initiatorName: 'Access Bank Payroll', totalItems: 1250, processedItems: 1250, successCount: 1238, failedCount: 12, totalAmount: 187_500_000, status: 'completed', submittedAt: new Date('2026-04-30T06:00:00Z') },
  { id: 'BULK-002', initiatorName: 'GTBank Vendor Payments', totalItems: 340, processedItems: 280, successCount: 275, failedCount: 5, totalAmount: 45_000_000, status: 'processing', submittedAt: new Date('2026-05-01T08:00:00Z') },
];

// ============================================================
// NIBSS Gap Feature Types & Seed Data
// ============================================================

type NEFTBatch = {
  id: string; batchRef: string; senderBank: string; senderBankCode: string;
  totalItems: number; totalAmount: number; settledAmount: number;
  status: string; clearingSession: string;
  submittedAt: Date; settledAt: Date | null;
};

type Cheque = {
  id: string; chequeNumber: string; sortCode: string; micrLine: string;
  drawerAcct: string; drawerBank: string; drawerName: string;
  payeeName: string; payeeAcct: string; payeeBank: string;
  amount: number; status: string;
  presentedAt: Date; clearedAt: Date | null; returnReason: string;
};

type DirectDebitMandate = {
  id: string; mandateRef: string; mandateType: string;
  subscriberName: string; subscriberAcct: string; subscriberBank: string; subscriberBvn: string;
  billerName: string; billerCode: string;
  amount: number; frequency: string;
  startDate: Date; endDate: Date; status: string;
  nextDebitDate: Date; executionCount: number; totalDebited: number;
  createdAt: Date;
};

type TransactionReversal = {
  id: string; originalNipRef: string; amount: number;
  reason: string; status: string;
  requestedAt: Date; resolvedAt: Date | null; requestedBy: string;
};

type InterBankDispute = {
  id: string; nipRef: string; amount: number; disputeType: string;
  initiatingBank: string; respondingBank: string;
  status: string; description: string; resolution: string;
  slaDeadline: Date; createdAt: Date;
  resolvedAt: Date | null; escalatedAt: Date | null;
};

type MerchantRecord = {
  id: string; merchantName: string; merchantCode: string;
  ussdShortCode: string; category: string;
  bankAcct: string; bankName: string; status: string;
  transactionCount: number; totalVolume: number;
  location: string; registeredAt: Date;
};

type PayDirectCollection = {
  id: string; collectorName: string; collectorCode: string;
  category: string; productName: string; status: string;
  totalCollected: number; transactionCount: number;
  bankCoverage: number; channels: string[];
  createdAt: Date;
};

type Iso20022Message = {
  id: string; messageType: string; messageId: string;
  creationDateTime: string; senderBic: string; receiverBic: string;
  transactionCount: number; totalAmount: number; currency: string;
  status: string; settlementMethod: string; rawXmlSizeBytes: number;
};

// --- NEFT Seed Data ---
const seedNeftBatches: NEFTBatch[] = [
  { id: 'NEFT-001', batchRef: 'NEFT/2026/05/001', senderBank: 'Access Bank', senderBankCode: '044', totalItems: 150, totalAmount: 25_000_000, settledAmount: 25_000_000, status: 'SETTLED', clearingSession: 'MORNING', submittedAt: new Date('2026-05-01T08:00:00Z'), settledAt: new Date('2026-05-01T15:00:00Z') },
  { id: 'NEFT-002', batchRef: 'NEFT/2026/05/002', senderBank: 'GTBank', senderBankCode: '058', totalItems: 85, totalAmount: 12_500_000, settledAmount: 0, status: 'PENDING_SETTLEMENT', clearingSession: 'AFTERNOON', submittedAt: new Date('2026-05-02T12:00:00Z'), settledAt: null },
  { id: 'NEFT-003', batchRef: 'NEFT/2026/05/003', senderBank: 'Zenith Bank', senderBankCode: '057', totalItems: 320, totalAmount: 48_000_000, settledAmount: 48_000_000, status: 'SETTLED', clearingSession: 'EVENING', submittedAt: new Date('2026-04-30T16:00:00Z'), settledAt: new Date('2026-05-01T15:00:00Z') },
  { id: 'NEFT-004', batchRef: 'NEFT/2026/05/004', senderBank: 'UBA', senderBankCode: '033', totalItems: 45, totalAmount: 8_750_000, settledAmount: 0, status: 'PROCESSING', clearingSession: 'MORNING', submittedAt: new Date('2026-05-02T09:00:00Z'), settledAt: null },
];

// --- NACS Cheque Seed Data ---
const seedCheques: Cheque[] = [
  { id: 'CHQ-001', chequeNumber: '000045678', sortCode: '044150023', micrLine: '000045678 044150023 0044100001', drawerAcct: '0044100001', drawerBank: 'Access Bank', drawerName: 'Dangote Industries Ltd', payeeName: 'Julius Berger Nigeria', payeeAcct: '0058200010', payeeBank: 'GTBank', amount: 85_000_000, status: 'CLEARED', presentedAt: new Date('2026-04-30T09:00:00Z'), clearedAt: new Date('2026-05-01T16:00:00Z'), returnReason: '' },
  { id: 'CHQ-002', chequeNumber: '000089012', sortCode: '057140018', micrLine: '000089012 057140018 0057300003', drawerAcct: '0057300003', drawerBank: 'Zenith Bank', drawerName: 'MTN Nigeria Communications', payeeName: 'Federal Inland Revenue Service', payeeAcct: 'TSA-FIRS-001', payeeBank: 'CBN', amount: 250_000_000, status: 'PENDING_CLEARING', presentedAt: new Date('2026-05-02T10:00:00Z'), clearedAt: null, returnReason: '' },
  { id: 'CHQ-003', chequeNumber: '000034567', sortCode: '033120015', micrLine: '000034567 033120015 0033400004', drawerAcct: '0033400004', drawerBank: 'UBA', drawerName: 'Flour Mills Nigeria', payeeName: 'Nigerian Ports Authority', payeeAcct: 'NPA-REV-001', payeeBank: 'First Bank', amount: 45_000_000, status: 'RETURNED', presentedAt: new Date('2026-04-29T11:00:00Z'), clearedAt: null, returnReason: 'INSUFFICIENT_FUNDS' },
  { id: 'CHQ-004', chequeNumber: '000078901', sortCode: '011100012', micrLine: '000078901 011100012 0011500005', drawerAcct: '0011500005', drawerBank: 'First Bank', drawerName: 'Shell Petroleum Dev Co', payeeName: 'Lagos State Government', payeeAcct: 'LASG-IGR-001', payeeBank: 'Zenith Bank', amount: 1_200_000_000, status: 'CLEARED', presentedAt: new Date('2026-04-28T09:30:00Z'), clearedAt: new Date('2026-05-01T16:00:00Z'), returnReason: '' },
];

// --- NDD Mandate Seed Data ---
const seedMandates: DirectDebitMandate[] = [
  { id: 'MND-001', mandateRef: 'NDD/2026/ACC/001', mandateType: 'FIXED', subscriberName: 'Adebayo Ogunlade', subscriberAcct: '0044100001', subscriberBank: 'Access Bank', subscriberBvn: '22345678901', billerName: 'Leadway Pensure PFA', billerCode: 'PENSION-LW', amount: 50000, frequency: 'MONTHLY', startDate: new Date('2025-01-01'), endDate: new Date('2030-12-31'), status: 'ACTIVE', nextDebitDate: new Date('2026-06-01'), executionCount: 17, totalDebited: 850_000, createdAt: new Date('2025-01-01') },
  { id: 'MND-002', mandateRef: 'NDD/2026/GTB/002', mandateType: 'VARIABLE', subscriberName: 'Chioma Okafor', subscriberAcct: '0058200002', subscriberBank: 'GTBank', subscriberBvn: '22345678902', billerName: 'AXA Mansard Insurance', billerCode: 'INS-AXA', amount: 125000, frequency: 'QUARTERLY', startDate: new Date('2025-06-01'), endDate: new Date('2028-05-31'), status: 'ACTIVE', nextDebitDate: new Date('2026-06-01'), executionCount: 4, totalDebited: 500_000, createdAt: new Date('2025-06-01') },
  { id: 'MND-003', mandateRef: 'NDD/2026/UBA/003', mandateType: 'GSI', subscriberName: 'Emeka Nwosu', subscriberAcct: '0033400004', subscriberBank: 'UBA', subscriberBvn: '12345678901', billerName: 'Access Bank Loan Recovery', billerCode: 'LOAN-ACC', amount: 250000, frequency: 'MONTHLY', startDate: new Date('2026-01-01'), endDate: new Date('2027-12-31'), status: 'ACTIVE', nextDebitDate: new Date('2026-06-01'), executionCount: 5, totalDebited: 1_250_000, createdAt: new Date('2026-01-01') },
  { id: 'MND-004', mandateRef: 'NDD/2025/ZEN/004', mandateType: 'FIXED', subscriberName: 'Fatima Bello', subscriberAcct: '0057300006', subscriberBank: 'Zenith Bank', subscriberBvn: '33456789012', billerName: 'DSTV (MultiChoice)', billerCode: 'DSTV-MC', amount: 29500, frequency: 'MONTHLY', startDate: new Date('2025-03-01'), endDate: new Date('2027-02-28'), status: 'SUSPENDED', nextDebitDate: new Date('2026-05-01'), executionCount: 14, totalDebited: 413_000, createdAt: new Date('2025-03-01') },
  { id: 'MND-005', mandateRef: 'NDD/2024/FBN/005', mandateType: 'VARIABLE', subscriberName: 'Grace Adeyemi', subscriberAcct: '0011500005', subscriberBank: 'First Bank', subscriberBvn: '44567890123', billerName: 'Lagos State IRS', billerCode: 'TAX-LIRS', amount: 0, frequency: 'ANNUALLY', startDate: new Date('2024-01-01'), endDate: new Date('2025-12-31'), status: 'EXPIRED', nextDebitDate: new Date('2026-01-01'), executionCount: 2, totalDebited: 450_000, createdAt: new Date('2024-01-01') },
];

// --- Reversal Seed Data ---
const seedReversals: TransactionReversal[] = [
  { id: 'REV-001', originalNipRef: 'NIP-D-006', amount: 500_000, reason: 'BENEFICIARY_ACCOUNT_NOT_FOUND', status: 'REVERSED', requestedAt: new Date('2026-05-01T16:05:00Z'), resolvedAt: new Date('2026-05-01T17:00:00Z'), requestedBy: 'system' },
  { id: 'REV-002', originalNipRef: 'NIP-EXT-001', amount: 1_500_000, reason: 'DUPLICATE_TRANSACTION', status: 'PENDING', requestedAt: new Date('2026-05-02T10:00:00Z'), resolvedAt: null, requestedBy: 'admin' },
  { id: 'REV-003', originalNipRef: 'NIP-EXT-002', amount: 75_000, reason: 'WRONG_BENEFICIARY', status: 'DECLINED', requestedAt: new Date('2026-04-30T14:00:00Z'), resolvedAt: new Date('2026-05-01T17:00:00Z'), requestedBy: 'ops_team' },
];

// --- Dispute Seed Data ---
const seedDisputes: InterBankDispute[] = [
  { id: 'DSP-001', nipRef: 'NIP-D-006', amount: 500_000, disputeType: 'DEBIT_WITHOUT_CREDIT', initiatingBank: 'First Bank', respondingBank: 'Access Bank', status: 'RESOLVED', description: 'Customer debited but beneficiary not credited. NIP timeout at receiver end.', resolution: 'Funds reversed to sender account. Root cause: receiver downtime.', slaDeadline: new Date('2026-05-03'), createdAt: new Date('2026-05-01T16:30:00Z'), resolvedAt: new Date('2026-05-01T18:00:00Z'), escalatedAt: null },
  { id: 'DSP-002', nipRef: 'NIP-EXT-003', amount: 2_500_000, disputeType: 'WRONG_AMOUNT', initiatingBank: 'GTBank', respondingBank: 'Zenith Bank', status: 'UNDER_REVIEW', description: 'Sender initiated ₦2.5M but beneficiary credited ₦250K. Possible decimal error.', resolution: '', slaDeadline: new Date('2026-05-05'), createdAt: new Date('2026-05-02T09:00:00Z'), resolvedAt: null, escalatedAt: null },
  { id: 'DSP-003', nipRef: 'NIP-EXT-004', amount: 15_000_000, disputeType: 'UNAUTHORIZED', initiatingBank: 'UBA', respondingBank: 'Wema Bank', status: 'ESCALATED_TO_CBN', description: 'Customer claims unauthorized debit of ₦15M. Possible account compromise.', resolution: '', slaDeadline: new Date('2026-05-04'), createdAt: new Date('2026-04-29T08:00:00Z'), resolvedAt: null, escalatedAt: new Date('2026-05-01T17:00:00Z') },
  { id: 'DSP-004', nipRef: 'NIP-EXT-005', amount: 350_000, disputeType: 'DEBIT_WITHOUT_CREDIT', initiatingBank: 'Sterling Bank', respondingBank: 'Access Bank', status: 'OPEN', description: 'USSD transfer debited but NIP response timed out. Beneficiary not credited.', resolution: '', slaDeadline: new Date('2026-05-06'), createdAt: new Date('2026-05-02T14:00:00Z'), resolvedAt: null, escalatedAt: null },
];

// --- Merchant Seed Data ---
const seedMerchants: MerchantRecord[] = [
  { id: 'MERCH-001', merchantName: 'ShopRite Ikeja', merchantCode: 'SRI-001', ussdShortCode: '*737*2*001#', category: 'RETAIL', bankAcct: '0057300003', bankName: 'Zenith Bank', status: 'ACTIVE', transactionCount: 12500, totalVolume: 185_000_000, location: 'Ikeja City Mall, Lagos', registeredAt: new Date('2024-06-01') },
  { id: 'MERCH-002', merchantName: 'Chicken Republic VI', merchantCode: 'CR-VI-001', ussdShortCode: '*737*2*002#', category: 'FOOD_BEVERAGE', bankAcct: '0011500005', bankName: 'First Bank', status: 'ACTIVE', transactionCount: 8200, totalVolume: 28_000_000, location: 'Victoria Island, Lagos', registeredAt: new Date('2024-08-15') },
  { id: 'MERCH-003', merchantName: 'Jumia Nigeria', merchantCode: 'JUM-001', ussdShortCode: '*737*2*003#', category: 'ECOMMERCE', bankAcct: '0058200020', bankName: 'GTBank', status: 'ACTIVE', transactionCount: 45000, totalVolume: 2_500_000_000, location: 'Online', registeredAt: new Date('2024-01-10') },
  { id: 'MERCH-004', merchantName: 'Balogun Market Traders', merchantCode: 'BMT-001', ussdShortCode: '*737*2*004#', category: 'MARKET', bankAcct: '0044100050', bankName: 'Access Bank', status: 'ACTIVE', transactionCount: 3200, totalVolume: 15_000_000, location: 'Balogun Market, Lagos Island', registeredAt: new Date('2025-02-01') },
  { id: 'MERCH-005', merchantName: 'Ibadan Fuel Station', merchantCode: 'IFS-001', ussdShortCode: '*737*2*005#', category: 'FUEL', bankAcct: '0033400090', bankName: 'UBA', status: 'SUSPENDED', transactionCount: 1800, totalVolume: 42_000_000, location: 'Ring Road, Ibadan', registeredAt: new Date('2025-05-01') },
];

// --- PayDirect Seed Data ---
const seedPayDirectCollections: PayDirectCollection[] = [
  { id: 'PD-001', collectorName: 'Federal Inland Revenue Service', collectorCode: 'FIRS', category: 'GOVERNMENT', productName: 'Tax Payment (CIT/VAT/WHT)', status: 'ACTIVE', totalCollected: 45_000_000_000, transactionCount: 125_000, bankCoverage: 25, channels: ['internet_banking', 'mobile_app', 'USSD', 'bank_branch'], createdAt: new Date('2024-01-01') },
  { id: 'PD-002', collectorName: 'Lagos State Internal Revenue Service', collectorCode: 'LIRS', category: 'GOVERNMENT', productName: 'State Tax & Levies', status: 'ACTIVE', totalCollected: 12_000_000_000, transactionCount: 89_000, bankCoverage: 22, channels: ['internet_banking', 'mobile_app', 'USSD'], createdAt: new Date('2024-03-01') },
  { id: 'PD-003', collectorName: 'University of Lagos', collectorCode: 'UNILAG', category: 'EDUCATION', productName: 'School Fees & Hostel', status: 'ACTIVE', totalCollected: 8_500_000_000, transactionCount: 45_000, bankCoverage: 20, channels: ['internet_banking', 'mobile_app'], createdAt: new Date('2024-06-01') },
  { id: 'PD-004', collectorName: 'AXA Mansard Insurance', collectorCode: 'AXA-MAN', category: 'INSURANCE', productName: 'Insurance Premium Collection', status: 'ACTIVE', totalCollected: 3_200_000_000, transactionCount: 28_000, bankCoverage: 18, channels: ['internet_banking', 'mobile_app', 'bank_branch'], createdAt: new Date('2024-02-01') },
  { id: 'PD-005', collectorName: 'Eko Electricity Distribution', collectorCode: 'EKEDC', category: 'UTILITY', productName: 'Prepaid & Postpaid Metering', status: 'ACTIVE', totalCollected: 6_800_000_000, transactionCount: 320_000, bankCoverage: 25, channels: ['internet_banking', 'mobile_app', 'USSD', 'bank_branch', 'POS'], createdAt: new Date('2023-09-01') },
];

// --- ISO 20022 Seed Data ---
const seedIso20022Messages: Iso20022Message[] = [
  { id: 'ISO-001', messageType: 'pain.001', messageId: 'PAIN001-2026-05-001', creationDateTime: '2026-05-01T08:00:00Z', senderBic: 'ABORNGLA', receiverBic: 'GTBINGLA', transactionCount: 25, totalAmount: 12_500_000, currency: 'NGN', status: 'ACCEPTED', settlementMethod: 'CLRG', rawXmlSizeBytes: 45_000 },
  { id: 'ISO-002', messageType: 'pacs.008', messageId: 'PACS008-2026-05-001', creationDateTime: '2026-05-01T09:00:00Z', senderBic: 'GTBINGLA', receiverBic: 'ABORNGLA', transactionCount: 1, totalAmount: 250_000, currency: 'NGN', status: 'ACCEPTED', settlementMethod: 'INDA', rawXmlSizeBytes: 12_000 },
  { id: 'ISO-003', messageType: 'pacs.002', messageId: 'PACS002-2026-05-001', creationDateTime: '2026-05-01T09:01:00Z', senderBic: 'ABORNGLA', receiverBic: 'GTBINGLA', transactionCount: 1, totalAmount: 250_000, currency: 'NGN', status: 'ACCEPTED', settlementMethod: 'INDA', rawXmlSizeBytes: 8_000 },
  { id: 'ISO-004', messageType: 'camt.053', messageId: 'CAMT053-2026-05-001', creationDateTime: '2026-05-01T23:59:00Z', senderBic: 'ABORNGLA', receiverBic: 'NIBSNGLA', transactionCount: 150, totalAmount: 25_000_000, currency: 'NGN', status: 'ACCEPTED', settlementMethod: 'CLRG', rawXmlSizeBytes: 180_000 },
  { id: 'ISO-005', messageType: 'pain.001', messageId: 'PAIN001-2026-05-002', creationDateTime: '2026-05-02T10:00:00Z', senderBic: 'ABORNGLA', receiverBic: 'ZENITHLA', transactionCount: 50, totalAmount: 8_750_000, currency: 'NGN', status: 'PENDING', settlementMethod: 'CLRG', rawXmlSizeBytes: 65_000 },
  { id: 'ISO-006', messageType: 'pacs.008', messageId: 'PACS008-2026-05-002', creationDateTime: '2026-05-02T10:30:00Z', senderBic: 'ZENITHLA', receiverBic: 'UBANIGLA', transactionCount: 1, totalAmount: 15_000_000, currency: 'NGN', status: 'REJECTED', settlementMethod: 'INDA', rawXmlSizeBytes: 15_000 },
  { id: 'ISO-007', messageType: 'camt.054', messageId: 'CAMT054-2026-05-001', creationDateTime: '2026-05-01T12:00:00Z', senderBic: 'NIBSNGLA', receiverBic: 'GTBINGLA', transactionCount: 5, totalAmount: 3_500_000, currency: 'NGN', status: 'ACCEPTED', settlementMethod: 'CLRG', rawXmlSizeBytes: 22_000 },
];

export const domesticPaymentsRouter = router({
  listPayments: protectedProcedure
    .input(z.object({ type: z.string().optional(), status: z.string().optional(), channel: z.string().optional() }).optional())
    .query(async ({ input }) => {
      let payments = [...seedPayments];
      if (input?.type) payments = payments.filter(p => p.type === input.type);
      if (input?.status) payments = payments.filter(p => p.status === input.status);
      if (input?.channel) payments = payments.filter(p => p.channel === input.channel);
      const totalVolume = payments.filter(p => p.status === 'COMPLETED').reduce((s, p) => s + p.amount, 0);
      return {
        payments,
        total: payments.length,
        summary: {
          totalPayments: seedPayments.length,
          completed: seedPayments.filter(p => p.status === 'COMPLETED').length,
          failed: seedPayments.filter(p => p.status === 'FAILED').length,
          pending: seedPayments.filter(p => p.status === 'PENDING_APPROVAL').length,
          totalVolumeNGN: totalVolume,
          p2pCount: seedPayments.filter(p => p.type === 'P2P').length,
          p2bCount: seedPayments.filter(p => ['P2B', 'QR_PAY'].includes(p.type)).length,
          billCount: seedPayments.filter(p => p.type === 'BILL_PAYMENT').length,
        },
      };
    }),

  listBillProviders: protectedProcedure.query(async () => ({ providers: seedBillProviders })),

  listStandingOrders: protectedProcedure.query(async () => ({
    orders: seedStandingOrders,
    totalActive: seedStandingOrders.filter(o => o.status === 'active').length,
  })),

  listBulkDisbursements: protectedProcedure.query(async () => ({
    disbursements: seedBulkDisbursements,
  })),

  createPayment: protectedProcedure
    .input(z.object({
      type: z.enum(['P2P', 'P2B', 'QR_PAY', 'BILL_PAYMENT', 'USSD']),
      senderAcct: z.string(),
      senderBank: z.string(),
      receiverAcct: z.string(),
      receiverBank: z.string(),
      amount: z.number().positive(),
      narration: z.string(),
    }))
    .mutation(async ({ input }) => {
      const fee = input.type === 'P2P' ? (input.amount <= 5000 ? 10 : input.amount <= 50000 ? 25 : 50) : input.amount * 0.005;
      const payment: DomesticPayment = {
        id: `DPY-${Date.now()}`,
        type: input.type,
        status: 'COMPLETED',
        senderAcct: input.senderAcct,
        senderBank: input.senderBank,
        senderName: 'User',
        receiverAcct: input.receiverAcct,
        receiverBank: input.receiverBank,
        receiverName: 'Receiver',
        amount: input.amount,
        fee,
        nipRef: `NIP-${Date.now()}`,
        channel: 'api',
        narration: input.narration,
        initiatedAt: new Date(),
        completedAt: new Date(),
      };
      seedPayments.push(payment);
      return payment;
    }),

  createStandingOrder: protectedProcedure
    .input(z.object({
      payerAcct: z.string(),
      payerBank: z.string(),
      payeeAcct: z.string(),
      payeeBank: z.string(),
      payeeName: z.string(),
      amount: z.number().positive(),
      frequency: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly']),
    }))
    .mutation(async ({ input }) => {
      const order: StandingOrder = {
        id: `SO-${Date.now()}`,
        ...input,
        nextExecDate: new Date(Date.now() + 7 * 86400000),
        status: 'active',
        executions: 0,
      };
      seedStandingOrders.push(order);
      return order;
    }),

  // ============================================================
  // NIBSS Gap Features
  // ============================================================

  // --- 1. NEFT (Nigeria Electronic Fund Transfer) ---
  listNeftBatches: protectedProcedure.query(async () => ({
    batches: seedNeftBatches,
    summary: {
      totalBatches: seedNeftBatches.length,
      totalItems: seedNeftBatches.reduce((s, b) => s + b.totalItems, 0),
      totalVolume: seedNeftBatches.reduce((s, b) => s + b.totalAmount, 0),
      pendingSettlement: seedNeftBatches.filter(b => b.status === 'PENDING_SETTLEMENT').length,
      settled: seedNeftBatches.filter(b => b.status === 'SETTLED').length,
    },
  })),

  // --- 2. NACS (Cheque Clearing) ---
  listCheques: protectedProcedure.query(async () => ({
    cheques: seedCheques,
    summary: {
      totalCheques: seedCheques.length,
      cleared: seedCheques.filter(c => c.status === 'CLEARED').length,
      returned: seedCheques.filter(c => c.status === 'RETURNED').length,
      pendingClearing: seedCheques.filter(c => c.status === 'PENDING_CLEARING').length,
      totalValue: seedCheques.reduce((s, c) => s + c.amount, 0),
    },
  })),

  // --- 3. Direct Debit Mandates (NDD) ---
  listMandates: protectedProcedure.query(async () => ({
    mandates: seedMandates,
    summary: {
      total: seedMandates.length,
      active: seedMandates.filter(m => m.status === 'ACTIVE').length,
      suspended: seedMandates.filter(m => m.status === 'SUSPENDED').length,
      expired: seedMandates.filter(m => m.status === 'EXPIRED').length,
      fixedCount: seedMandates.filter(m => m.mandateType === 'FIXED').length,
      variableCount: seedMandates.filter(m => m.mandateType === 'VARIABLE').length,
      gsiCount: seedMandates.filter(m => m.mandateType === 'GSI').length,
      totalDebited: seedMandates.reduce((s, m) => s + m.totalDebited, 0),
    },
  })),

  createMandate: protectedProcedure
    .input(z.object({
      mandateType: z.enum(['FIXED', 'VARIABLE', 'GSI']),
      subscriberName: z.string(),
      subscriberAcct: z.string(),
      subscriberBank: z.string(),
      subscriberBvn: z.string(),
      billerName: z.string(),
      billerCode: z.string(),
      amount: z.number().positive(),
      frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY']),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .mutation(async ({ input }) => {
      const mandate: DirectDebitMandate = {
        id: `MND-${Date.now()}`,
        mandateRef: `NDD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        ...input,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        status: 'ACTIVE',
        nextDebitDate: new Date(input.startDate),
        executionCount: 0,
        totalDebited: 0,
        createdAt: new Date(),
      };
      seedMandates.push(mandate);
      return mandate;
    }),

  // --- 4. BVN / NIN Verification ---
  verifyIdentity: protectedProcedure
    .input(z.object({
      type: z.enum(['BVN', 'NIN']),
      value: z.string().min(10),
    }))
    .query(async ({ input }) => {
      const records: Record<string, { firstName: string; lastName: string; middleName: string; dob: string; phone: string; gender: string; photo: string; verified: boolean }> = {
        '22345678901': { firstName: 'Adebayo', lastName: 'Ogunlade', middleName: 'Taiwo', dob: '1988-05-12', phone: '08012345678', gender: 'M', photo: '/avatars/placeholder.png', verified: true },
        '22345678902': { firstName: 'Chioma', lastName: 'Okafor', middleName: 'Ngozi', dob: '1992-09-20', phone: '08098765432', gender: 'F', photo: '/avatars/placeholder.png', verified: true },
        '12345678901': { firstName: 'Emeka', lastName: 'Nwosu', middleName: 'Chukwudi', dob: '1985-03-15', phone: '07012345678', gender: 'M', photo: '/avatars/placeholder.png', verified: true },
      };
      const record = records[input.value];
      if (!record) return { found: false as const, type: input.type, value: input.value };
      return { found: true as const, type: input.type, value: input.value, ...record };
    }),

  // --- 5. Account Name Enquiry ---
  nameEnquiry: protectedProcedure
    .input(z.object({ accountNumber: z.string(), bankCode: z.string() }))
    .query(async ({ input }) => {
      const accounts: Record<string, { name: string; bank: string; currency: string; accountType: string }> = {
        '0044100001': { name: 'OGUNLADE ADEBAYO TAIWO', bank: 'Access Bank', currency: 'NGN', accountType: 'SAVINGS' },
        '0058200002': { name: 'OKAFOR CHIOMA NGOZI', bank: 'GTBank', currency: 'NGN', accountType: 'SAVINGS' },
        '0033400004': { name: 'NWOSU EMEKA CHUKWUDI', bank: 'UBA', currency: 'NGN', accountType: 'CURRENT' },
        '0057300003': { name: 'SHOPRITE NIGERIA LTD', bank: 'Zenith Bank', currency: 'NGN', accountType: 'CURRENT' },
        '0011500005': { name: 'CHICKEN REPUBLIC', bank: 'First Bank', currency: 'NGN', accountType: 'CURRENT' },
      };
      const acct = accounts[input.accountNumber];
      if (!acct) return { found: false as const, accountNumber: input.accountNumber, bankCode: input.bankCode };
      return { found: true as const, accountNumber: input.accountNumber, bankCode: input.bankCode, ...acct };
    }),

  // --- 6. Transaction Status Query (TSQ) ---
  transactionStatusQuery: protectedProcedure
    .input(z.object({ nipRef: z.string() }))
    .query(async ({ input }) => {
      const payment = seedPayments.find(p => p.nipRef === input.nipRef);
      if (!payment) return { found: false as const, nipRef: input.nipRef };
      return {
        found: true as const,
        nipRef: input.nipRef,
        status: payment.status,
        amount: payment.amount,
        senderBank: payment.senderBank,
        receiverBank: payment.receiverBank,
        initiatedAt: payment.initiatedAt,
        completedAt: payment.completedAt,
        responseCode: payment.status === 'COMPLETED' ? '00' : payment.status === 'FAILED' ? '51' : '09',
        responseMessage: payment.status === 'COMPLETED' ? 'Approved or completed successfully' : payment.status === 'FAILED' ? 'Insufficient funds' : 'Request processing in progress',
      };
    }),

  // --- 7. Transaction Reversals ---
  listReversals: protectedProcedure.query(async () => ({
    reversals: seedReversals,
    summary: {
      total: seedReversals.length,
      successful: seedReversals.filter(r => r.status === 'REVERSED').length,
      pending: seedReversals.filter(r => r.status === 'PENDING').length,
      declined: seedReversals.filter(r => r.status === 'DECLINED').length,
      totalReversed: seedReversals.filter(r => r.status === 'REVERSED').reduce((s, r) => s + r.amount, 0),
    },
  })),

  initiateReversal: protectedProcedure
    .input(z.object({ nipRef: z.string(), reason: z.string() }))
    .mutation(async ({ input }) => {
      const reversal: TransactionReversal = {
        id: `REV-${Date.now()}`,
        originalNipRef: input.nipRef,
        amount: 0,
        reason: input.reason,
        status: 'PENDING',
        requestedAt: new Date(),
        resolvedAt: null,
        requestedBy: 'admin',
      };
      const orig = seedPayments.find(p => p.nipRef === input.nipRef);
      if (orig) reversal.amount = orig.amount;
      seedReversals.push(reversal);
      return reversal;
    }),

  // --- 8. Disputes ---
  listDisputes: protectedProcedure.query(async () => ({
    disputes: seedDisputes,
    summary: {
      total: seedDisputes.length,
      open: seedDisputes.filter(d => d.status === 'OPEN').length,
      underReview: seedDisputes.filter(d => d.status === 'UNDER_REVIEW').length,
      resolved: seedDisputes.filter(d => d.status === 'RESOLVED').length,
      escalated: seedDisputes.filter(d => d.status === 'ESCALATED_TO_CBN').length,
      totalDisputedAmount: seedDisputes.reduce((s, d) => s + d.amount, 0),
    },
  })),

  // --- 9. Merchant Registry (mCash+) ---
  listMerchants: protectedProcedure.query(async () => ({
    merchants: seedMerchants,
    summary: {
      total: seedMerchants.length,
      active: seedMerchants.filter(m => m.status === 'ACTIVE').length,
      totalTransactions: seedMerchants.reduce((s, m) => s + m.transactionCount, 0),
      totalVolume: seedMerchants.reduce((s, m) => s + m.totalVolume, 0),
    },
  })),

  // --- 10. PayDirect Collections ---
  listPayDirectCollections: protectedProcedure.query(async () => ({
    collections: seedPayDirectCollections,
    summary: {
      totalCollections: seedPayDirectCollections.length,
      active: seedPayDirectCollections.filter(c => c.status === 'ACTIVE').length,
      totalCollected: seedPayDirectCollections.reduce((s, c) => s + c.totalCollected, 0),
      totalTransactions: seedPayDirectCollections.reduce((s, c) => s + c.transactionCount, 0),
    },
  })),

  // --- 11. ISO 20022 Messages ---
  listIso20022Messages: protectedProcedure.query(async () => ({
    messages: seedIso20022Messages,
    summary: {
      total: seedIso20022Messages.length,
      pain001: seedIso20022Messages.filter(m => m.messageType === 'pain.001').length,
      pacs008: seedIso20022Messages.filter(m => m.messageType === 'pacs.008').length,
      pacs002: seedIso20022Messages.filter(m => m.messageType === 'pacs.002').length,
      camt053: seedIso20022Messages.filter(m => m.messageType === 'camt.053').length,
    },
  })),
});
