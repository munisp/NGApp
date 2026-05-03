import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, router } from '../_core/trpc';

// --- Seed Data ---

type InboundTransfer = {
  id: string;
  externalRef: string;
  sourceRail: string;
  sourceCountry: string;
  sourceCountryName: string;
  sourceCurrency: string;
  sourceAmount: number;
  destAmount: number;
  fxRate: number;
  senderName: string;
  senderBank: string;
  beneficiaryName: string;
  beneficiaryBank: string;
  beneficiaryAcct: string;
  nipRef: string;
  status: string;
  complianceScore: number;
  screeningResult: string;
  receivedAt: Date;
  creditedAt: Date | null;
  failureReason: string;
  corridorId: string;
};

type InboundCorridor = {
  id: string;
  sourceCountry: string;
  sourceCountryName: string;
  sourceCurrency: string;
  rails: string[];
  receivingBanks: string[];
  dailyVolumeUSD: number;
  avgSettlementMs: number;
  complianceLevel: string;
  isActive: boolean;
};

type ReceivingBank = {
  code: string;
  name: string;
  nipCode: string;
  swiftCode: string;
  dailyCapacity: number;
  status: string;
};

const seedInboundTransfers: InboundTransfer[] = [
  { id: 'INB-001', externalRef: 'SWIFT-GPI-20260501-001', sourceRail: 'SWIFT', sourceCountry: 'GB', sourceCountryName: 'United Kingdom', sourceCurrency: 'GBP', sourceAmount: 5000, destAmount: 9_750_000, fxRate: 1950, senderName: 'James Wilson', senderBank: 'Barclays UK', beneficiaryName: 'Adebayo Ogunlade', beneficiaryBank: 'Access Bank', beneficiaryAcct: '0044123456', nipRef: 'NIP-20260501-001', status: 'CREDITED', complianceScore: 12, screeningResult: 'CLEAR', receivedAt: new Date('2026-05-01T08:30:00Z'), creditedAt: new Date('2026-05-01T08:32:00Z'), failureReason: '', corridorId: 'GB-NG' },
  { id: 'INB-002', externalRef: 'SWIFT-GPI-20260501-002', sourceRail: 'SWIFT', sourceCountry: 'US', sourceCountryName: 'United States', sourceCurrency: 'USD', sourceAmount: 10000, destAmount: 15_200_000, fxRate: 1520, senderName: 'Michael Johnson', senderBank: 'Wells Fargo', beneficiaryName: 'Chioma Okafor', beneficiaryBank: 'GTBank', beneficiaryAcct: '0058234567', nipRef: 'NIP-20260501-002', status: 'CREDITED', complianceScore: 8, screeningResult: 'CLEAR', receivedAt: new Date('2026-05-01T09:15:00Z'), creditedAt: new Date('2026-05-01T09:18:00Z'), failureReason: '', corridorId: 'US-NG' },
  { id: 'INB-003', externalRef: 'PAPSS-20260501-001', sourceRail: 'PAPSS', sourceCountry: 'GH', sourceCountryName: 'Ghana', sourceCurrency: 'GHS', sourceAmount: 15000, destAmount: 2_850_000, fxRate: 190, senderName: 'Kwame Mensah', senderBank: 'GCB Bank', beneficiaryName: 'Emeka Nwosu', beneficiaryBank: 'Zenith Bank', beneficiaryAcct: '0057345678', nipRef: 'NIP-20260501-003', status: 'CREDITED', complianceScore: 5, screeningResult: 'CLEAR', receivedAt: new Date('2026-05-01T10:00:00Z'), creditedAt: new Date('2026-05-01T10:00:08Z'), failureReason: '', corridorId: 'GH-NG' },
  { id: 'INB-004', externalRef: 'CIPS-20260501-001', sourceRail: 'CIPS', sourceCountry: 'CN', sourceCountryName: 'China', sourceCurrency: 'CNY', sourceAmount: 50000, destAmount: 10_640_000, fxRate: 212.8, senderName: 'Wei Zhang', senderBank: 'Bank of China', beneficiaryName: 'Ibrahim Musa', beneficiaryBank: 'Access Bank', beneficiaryAcct: '0044456789', nipRef: 'NIP-20260501-004', status: 'SCREENING_HELD', complianceScore: 68, screeningResult: 'HELD', receivedAt: new Date('2026-05-01T11:30:00Z'), creditedAt: null, failureReason: '', corridorId: 'CN-NG' },
  { id: 'INB-005', externalRef: 'UPI-20260501-001', sourceRail: 'UPI', sourceCountry: 'IN', sourceCountryName: 'India', sourceCurrency: 'INR', sourceAmount: 200000, destAmount: 3_648_000, fxRate: 18.24, senderName: 'Rajesh Patel', senderBank: 'SBI', beneficiaryName: 'Oluwaseun Adesanya', beneficiaryBank: 'First Bank', beneficiaryAcct: '0011567890', nipRef: 'NIP-20260501-005', status: 'CREDITED', complianceScore: 15, screeningResult: 'CLEAR', receivedAt: new Date('2026-05-01T12:45:00Z'), creditedAt: new Date('2026-05-01T12:45:05Z'), failureReason: '', corridorId: 'IN-NG' },
  { id: 'INB-006', externalRef: 'SEPA-20260501-001', sourceRail: 'SEPA', sourceCountry: 'DE', sourceCountryName: 'Germany', sourceCurrency: 'EUR', sourceAmount: 3000, destAmount: 4_920_000, fxRate: 1640, senderName: 'Hans Mueller', senderBank: 'Deutsche Bank', beneficiaryName: 'Fatima Bello', beneficiaryBank: 'UBA', beneficiaryAcct: '0033678901', nipRef: 'NIP-20260501-006', status: 'CREDITED', complianceScore: 10, screeningResult: 'CLEAR', receivedAt: new Date('2026-05-01T13:00:00Z'), creditedAt: new Date('2026-05-01T13:00:35Z'), failureReason: '', corridorId: 'DE-NG' },
  { id: 'INB-007', externalRef: 'SWIFT-GPI-20260501-003', sourceRail: 'SWIFT', sourceCountry: 'AE', sourceCountryName: 'UAE', sourceCurrency: 'AED', sourceAmount: 20000, destAmount: 8_280_000, fxRate: 414, senderName: 'Mohammed Al-Rashid', senderBank: 'Emirates NBD', beneficiaryName: 'Tunde Bakare', beneficiaryBank: 'GTBank', beneficiaryAcct: '0058789012', nipRef: 'NIP-20260501-007', status: 'FAILED', complianceScore: 22, screeningResult: 'CLEAR', receivedAt: new Date('2026-05-01T14:20:00Z'), creditedAt: null, failureReason: 'Beneficiary account closed', corridorId: 'AE-NG' },
  { id: 'INB-008', externalRef: 'PAPSS-20260501-002', sourceRail: 'PAPSS', sourceCountry: 'KE', sourceCountryName: 'Kenya', sourceCurrency: 'KES', sourceAmount: 100000, destAmount: 1_200_000, fxRate: 12, senderName: 'Wanjiku Kamau', senderBank: 'Equity Bank', beneficiaryName: 'Grace Adeyemi', beneficiaryBank: 'First Bank', beneficiaryAcct: '0011890123', nipRef: 'NIP-20260501-008', status: 'FX_CONVERSION', complianceScore: 7, screeningResult: 'CLEAR', receivedAt: new Date('2026-05-01T15:00:00Z'), creditedAt: null, failureReason: '', corridorId: 'KE-NG' },
];

const seedInboundCorridors: InboundCorridor[] = [
  { id: 'GB-NG', sourceCountry: 'GB', sourceCountryName: 'United Kingdom', sourceCurrency: 'GBP', rails: ['SWIFT', 'FASTER_PAY'], receivingBanks: ['ACCESS', 'GTB', 'ZENITH'], dailyVolumeUSD: 2_400_000, avgSettlementMs: 45000, complianceLevel: 'standard', isActive: true },
  { id: 'US-NG', sourceCountry: 'US', sourceCountryName: 'United States', sourceCurrency: 'USD', rails: ['SWIFT', 'ACH'], receivingBanks: ['ACCESS', 'GTB', 'ZENITH', 'UBA', 'FIRSTBANK'], dailyVolumeUSD: 5_800_000, avgSettlementMs: 120000, complianceLevel: 'enhanced', isActive: true },
  { id: 'CA-NG', sourceCountry: 'CA', sourceCountryName: 'Canada', sourceCurrency: 'CAD', rails: ['SWIFT'], receivingBanks: ['GTB', 'UBA'], dailyVolumeUSD: 890_000, avgSettlementMs: 180000, complianceLevel: 'standard', isActive: true },
  { id: 'GH-NG', sourceCountry: 'GH', sourceCountryName: 'Ghana', sourceCurrency: 'GHS', rails: ['PAPSS', 'MOBILE_MONEY'], receivingBanks: ['ACCESS', 'ZENITH'], dailyVolumeUSD: 450_000, avgSettlementMs: 8000, complianceLevel: 'standard', isActive: true },
  { id: 'KE-NG', sourceCountry: 'KE', sourceCountryName: 'Kenya', sourceCurrency: 'KES', rails: ['PAPSS'], receivingBanks: ['UBA', 'FIRSTBANK'], dailyVolumeUSD: 320_000, avgSettlementMs: 12000, complianceLevel: 'standard', isActive: true },
  { id: 'ZA-NG', sourceCountry: 'ZA', sourceCountryName: 'South Africa', sourceCurrency: 'ZAR', rails: ['SWIFT', 'PAPSS'], receivingBanks: ['ACCESS', 'GTB'], dailyVolumeUSD: 670_000, avgSettlementMs: 60000, complianceLevel: 'standard', isActive: true },
  { id: 'AE-NG', sourceCountry: 'AE', sourceCountryName: 'UAE', sourceCurrency: 'AED', rails: ['SWIFT'], receivingBanks: ['GTB', 'ZENITH', 'UBA'], dailyVolumeUSD: 1_200_000, avgSettlementMs: 90000, complianceLevel: 'enhanced', isActive: true },
  { id: 'CN-NG', sourceCountry: 'CN', sourceCountryName: 'China', sourceCurrency: 'CNY', rails: ['CIPS'], receivingBanks: ['ACCESS'], dailyVolumeUSD: 340_000, avgSettlementMs: 240000, complianceLevel: 'enhanced', isActive: true },
  { id: 'IN-NG', sourceCountry: 'IN', sourceCountryName: 'India', sourceCurrency: 'INR', rails: ['UPI'], receivingBanks: ['FIRSTBANK'], dailyVolumeUSD: 180_000, avgSettlementMs: 5000, complianceLevel: 'standard', isActive: true },
  { id: 'DE-NG', sourceCountry: 'DE', sourceCountryName: 'Germany', sourceCurrency: 'EUR', rails: ['SEPA', 'SWIFT'], receivingBanks: ['GTB', 'ZENITH'], dailyVolumeUSD: 780_000, avgSettlementMs: 35000, complianceLevel: 'standard', isActive: true },
  { id: 'FR-NG', sourceCountry: 'FR', sourceCountryName: 'France', sourceCurrency: 'EUR', rails: ['SEPA'], receivingBanks: ['ACCESS', 'UBA'], dailyVolumeUSD: 560_000, avgSettlementMs: 40000, complianceLevel: 'standard', isActive: true },
  { id: 'IT-NG', sourceCountry: 'IT', sourceCountryName: 'Italy', sourceCurrency: 'EUR', rails: ['SEPA'], receivingBanks: ['GTB'], dailyVolumeUSD: 420_000, avgSettlementMs: 45000, complianceLevel: 'standard', isActive: true },
];

const seedReceivingBanks: ReceivingBank[] = [
  { code: 'ACCESS', name: 'Access Bank Plc', nipCode: '044', swiftCode: 'ABORNGLA', dailyCapacity: 50_000_000, status: 'active' },
  { code: 'GTB', name: 'Guaranty Trust Bank', nipCode: '058', swiftCode: 'GTBINGLA', dailyCapacity: 45_000_000, status: 'active' },
  { code: 'ZENITH', name: 'Zenith Bank Plc', nipCode: '057', swiftCode: 'ZELOIGLA', dailyCapacity: 48_000_000, status: 'active' },
  { code: 'UBA', name: 'United Bank for Africa', nipCode: '033', swiftCode: 'UNAFNGLA', dailyCapacity: 40_000_000, status: 'active' },
  { code: 'FIRSTBANK', name: 'First Bank of Nigeria', nipCode: '011', swiftCode: 'FBNINGLA', dailyCapacity: 42_000_000, status: 'active' },
];

function getScope(user: { role: string }) {
  return {
    isAdmin: user.role === 'admin' || user.role === 'cbn',
    isCbn: user.role === 'cbn',
  };
}

export const inboundRemittanceRouter = router({
  listTransfers: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      corridorId: z.string().optional(),
      sourceRail: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      let transfers = [...seedInboundTransfers];
      if (input?.status) transfers = transfers.filter(t => t.status === input.status);
      if (input?.corridorId) transfers = transfers.filter(t => t.corridorId === input.corridorId);
      if (input?.sourceRail) transfers = transfers.filter(t => t.sourceRail === input.sourceRail);

      const totalVolumeNGN = transfers.filter(t => t.status === 'CREDITED').reduce((s, t) => s + t.destAmount, 0);
      return {
        transfers,
        total: transfers.length,
        summary: {
          totalReceived: seedInboundTransfers.length,
          credited: seedInboundTransfers.filter(t => t.status === 'CREDITED').length,
          held: seedInboundTransfers.filter(t => t.status === 'SCREENING_HELD').length,
          failed: seedInboundTransfers.filter(t => t.status === 'FAILED').length,
          processing: seedInboundTransfers.filter(t => !['CREDITED', 'FAILED', 'RETURNED', 'SCREENING_HELD'].includes(t.status)).length,
          totalVolumeNGN,
          avgProcessingMs: 42000,
        },
      };
    }),

  listCorridors: protectedProcedure.query(async () => {
    return { corridors: seedInboundCorridors, totalDailyVolumeUSD: seedInboundCorridors.reduce((s, c) => s + c.dailyVolumeUSD, 0) };
  }),

  listReceivingBanks: protectedProcedure.query(async () => {
    return { banks: seedReceivingBanks };
  }),

  returnTransfer: protectedProcedure
    .input(z.object({ transferId: z.string(), reason: z.string().min(5) }))
    .mutation(async ({ ctx, input }) => {
      const { isAdmin } = getScope(ctx.user as { role: string });
      if (!isAdmin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
      const t = seedInboundTransfers.find(t => t.id === input.transferId);
      if (!t) throw new TRPCError({ code: 'NOT_FOUND' });
      t.status = 'RETURNED';
      t.failureReason = input.reason;
      return t;
    }),

  releaseHeld: protectedProcedure
    .input(z.object({ transferId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { isAdmin } = getScope(ctx.user as { role: string });
      if (!isAdmin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
      const t = seedInboundTransfers.find(t => t.id === input.transferId);
      if (!t) throw new TRPCError({ code: 'NOT_FOUND' });
      if (t.status !== 'SCREENING_HELD') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Transfer not held' });
      t.status = 'SCREENING_CLEARED';
      t.screeningResult = 'MANUALLY_CLEARED';
      return t;
    }),

  updateCorridor: protectedProcedure
    .input(z.object({ corridorId: z.string(), isActive: z.boolean().optional(), complianceLevel: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { isAdmin } = getScope(ctx.user as { role: string });
      if (!isAdmin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
      const c = seedInboundCorridors.find(c => c.id === input.corridorId);
      if (!c) throw new TRPCError({ code: 'NOT_FOUND' });
      if (input.isActive !== undefined) c.isActive = input.isActive;
      if (input.complianceLevel) c.complianceLevel = input.complianceLevel;
      return c;
    }),
});
