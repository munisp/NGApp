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
});
