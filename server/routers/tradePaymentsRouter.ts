import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, router } from '../_core/trpc';

// --- Types & Seed Data ---

type LetterOfCredit = {
  id: string;
  lcNumber: string;
  type: string;
  applicant: string;
  applicantBank: string;
  beneficiary: string;
  beneficiaryBank: string;
  beneficiaryCountry: string;
  amount: number;
  currency: string;
  goodsDescription: string;
  shipmentPort: string;
  destinationPort: string;
  shipmentDeadline: Date;
  expiryDate: Date;
  status: string;
  documents: TradeDocument[];
  issuedAt: Date;
  formMRef: string;
};

type TradeDocument = {
  id: string;
  type: string;
  documentRef: string;
  uploadedBy: string;
  uploadedAt: Date;
  status: string;
};

type EscrowPayment = {
  id: string;
  buyerName: string;
  sellerName: string;
  totalAmount: number;
  currency: string;
  milestones: { id: string; description: string; amount: number; dueDate: Date; status: string }[];
  status: string;
  createdAt: Date;
};

type CustomsDutyPayment = {
  id: string;
  assessmentRef: string;
  importerName: string;
  dutyAmount: number;
  vatAmount: number;
  surchargeAmount: number;
  totalAmount: number;
  hsCode: string;
  goodsDesc: string;
  portOfEntry: string;
  status: string;
  paidAt: Date | null;
};

const seedLCs: LetterOfCredit[] = [
  { id: 'LC-001', lcNumber: 'LC-2026-A001', type: 'import', applicant: 'Dangote Industries', applicantBank: 'Access Bank', beneficiary: 'Sinopec Corp', beneficiaryBank: 'Bank of China', beneficiaryCountry: 'CN', amount: 25_000_000, currency: 'USD', goodsDescription: 'Industrial chemicals and petrochemical feedstock', shipmentPort: 'Shanghai', destinationPort: 'Apapa, Lagos', shipmentDeadline: new Date('2026-06-30'), expiryDate: new Date('2026-07-31'), status: 'CONFIRMED', documents: [{ id: 'DOC-001', type: 'commercial_invoice', documentRef: 'INV-2026-SC001', uploadedBy: 'Sinopec Corp', uploadedAt: new Date('2026-04-15'), status: 'verified' }], issuedAt: new Date('2026-04-01'), formMRef: 'FORM-M-2026-001' },
  { id: 'LC-002', lcNumber: 'LC-2026-A002', type: 'import', applicant: 'BUA Cement', applicantBank: 'GTBank', beneficiary: 'Thyssen Krupp AG', beneficiaryBank: 'Deutsche Bank', beneficiaryCountry: 'DE', amount: 8_500_000, currency: 'EUR', goodsDescription: 'Cement plant machinery and spare parts', shipmentPort: 'Hamburg', destinationPort: 'Tin Can Island, Lagos', shipmentDeadline: new Date('2026-07-15'), expiryDate: new Date('2026-08-15'), status: 'ISSUED', documents: [], issuedAt: new Date('2026-04-20'), formMRef: 'FORM-M-2026-002' },
  { id: 'LC-003', lcNumber: 'LC-2026-E001', type: 'export', applicant: 'Olam Nigeria', applicantBank: 'Zenith Bank', beneficiary: 'Cargill Europe', beneficiaryBank: 'ING Bank', beneficiaryCountry: 'NL', amount: 12_000_000, currency: 'USD', goodsDescription: 'Raw cocoa beans (Grade 1)', shipmentPort: 'Apapa, Lagos', destinationPort: 'Rotterdam', shipmentDeadline: new Date('2026-06-15'), expiryDate: new Date('2026-07-15'), status: 'DRAWN_DOWN', documents: [{ id: 'DOC-002', type: 'bill_of_lading', documentRef: 'BOL-2026-OL001', uploadedBy: 'Olam Nigeria', uploadedAt: new Date('2026-05-01'), status: 'verified' }, { id: 'DOC-003', type: 'certificate_of_origin', documentRef: 'COO-2026-OL001', uploadedBy: 'NEPC', uploadedAt: new Date('2026-04-28'), status: 'verified' }], issuedAt: new Date('2026-03-15'), formMRef: 'FORM-A-2026-001' },
  { id: 'LC-004', lcNumber: 'LC-2026-A003', type: 'import', applicant: 'MTN Nigeria', applicantBank: 'UBA', beneficiary: 'Ericsson AB', beneficiaryBank: 'SEB Bank', beneficiaryCountry: 'SE', amount: 45_000_000, currency: 'USD', goodsDescription: '5G network equipment and base stations', shipmentPort: 'Gothenburg', destinationPort: 'Apapa, Lagos', shipmentDeadline: new Date('2026-08-01'), expiryDate: new Date('2026-09-01'), status: 'ADVISED', documents: [], issuedAt: new Date('2026-04-25'), formMRef: 'FORM-M-2026-003' },
  { id: 'LC-005', lcNumber: 'LC-2026-E002', type: 'export', applicant: 'Nigerian Breweries', applicantBank: 'First Bank', beneficiary: 'Heineken NV', beneficiaryBank: 'ABN AMRO', beneficiaryCountry: 'NL', amount: 3_500_000, currency: 'EUR', goodsDescription: 'Star Lager beer for export', shipmentPort: 'Apapa, Lagos', destinationPort: 'Rotterdam', shipmentDeadline: new Date('2026-06-01'), expiryDate: new Date('2026-07-01'), status: 'SETTLED', documents: [{ id: 'DOC-004', type: 'bill_of_lading', documentRef: 'BOL-2026-NB001', uploadedBy: 'Nigerian Breweries', uploadedAt: new Date('2026-04-10'), status: 'verified' }], issuedAt: new Date('2026-03-01'), formMRef: 'FORM-A-2026-002' },
];

const seedEscrows: EscrowPayment[] = [
  { id: 'ESC-001', buyerName: 'Nestle Nigeria', sellerName: 'Shandong Machinery Co.', totalAmount: 2_800_000, currency: 'USD', milestones: [{ id: 'MS-001', description: 'Advance payment on order confirmation', amount: 840000, dueDate: new Date('2026-04-01'), status: 'released' }, { id: 'MS-002', description: 'Payment on shipment from origin', amount: 1120000, dueDate: new Date('2026-05-15'), status: 'buyer_approved' }, { id: 'MS-003', description: 'Final payment on delivery & inspection', amount: 840000, dueDate: new Date('2026-06-30'), status: 'pending' }], status: 'active', createdAt: new Date('2026-03-15') },
  { id: 'ESC-002', buyerName: 'Lafarge Africa', sellerName: 'Caterpillar Inc.', totalAmount: 5_200_000, currency: 'USD', milestones: [{ id: 'MS-004', description: 'Equipment deposit', amount: 2600000, dueDate: new Date('2026-04-15'), status: 'released' }, { id: 'MS-005', description: 'Balance on delivery', amount: 2600000, dueDate: new Date('2026-07-01'), status: 'pending' }], status: 'active', createdAt: new Date('2026-04-01') },
];

const seedCustomsDuties: CustomsDutyPayment[] = [
  { id: 'DUTY-001', assessmentRef: 'NCS-2026-LAG-001234', importerName: 'Dangote Industries', dutyAmount: 5_000_000, vatAmount: 1_875_000, surchargeAmount: 250_000, totalAmount: 7_125_000, hsCode: '2902.11', goodsDesc: 'Cyclohexane', portOfEntry: 'Apapa, Lagos', status: 'cleared', paidAt: new Date('2026-04-28') },
  { id: 'DUTY-002', assessmentRef: 'NCS-2026-LAG-001235', importerName: 'MTN Nigeria', dutyAmount: 12_000_000, vatAmount: 4_500_000, surchargeAmount: 600_000, totalAmount: 17_100_000, hsCode: '8517.62', goodsDesc: '5G Base station equipment', portOfEntry: 'Tin Can Island', status: 'paid', paidAt: new Date('2026-05-01') },
  { id: 'DUTY-003', assessmentRef: 'NCS-2026-PHC-000567', importerName: 'Nigerian Breweries', dutyAmount: 800_000, vatAmount: 300_000, surchargeAmount: 40_000, totalAmount: 1_140_000, hsCode: '8438.40', goodsDesc: 'Brewery equipment parts', portOfEntry: 'Port Harcourt', status: 'pending', paidAt: null },
];

function getScope(user: { role: string }) {
  return { isAdmin: user.role === 'admin' || user.role === 'cbn' };
}

export const tradePaymentsRouter = router({
  listLCs: protectedProcedure
    .input(z.object({ type: z.string().optional(), status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      let lcs = [...seedLCs];
      if (input?.type) lcs = lcs.filter(l => l.type === input.type);
      if (input?.status) lcs = lcs.filter(l => l.status === input.status);
      return {
        lcs,
        total: lcs.length,
        _source: 'SEED' as const,
        summary: {
          totalLCs: seedLCs.length,
          importLCs: seedLCs.filter(l => l.type === 'import').length,
          exportLCs: seedLCs.filter(l => l.type === 'export').length,
          totalValueUSD: seedLCs.reduce((s, l) => s + (l.currency === 'USD' ? l.amount : l.amount * 1.08), 0),
          activeLCs: seedLCs.filter(l => !['SETTLED', 'EXPIRED', 'CANCELLED'].includes(l.status)).length,
        },
      };
    }),

  listEscrows: protectedProcedure.query(async () => ({
    escrows: seedEscrows,
    totalActive: seedEscrows.filter(e => e.status === 'active').length,
    totalValueUSD: seedEscrows.reduce((s, e) => s + e.totalAmount, 0),
    _source: 'SEED' as const,
  })),

  listCustomsDuties: protectedProcedure.query(async () => ({
    duties: seedCustomsDuties,
    totalPaid: seedCustomsDuties.filter(d => ['paid', 'cleared'].includes(d.status)).reduce((s, d) => s + d.totalAmount, 0),
    _source: 'SEED' as const,
  })),

  createLC: protectedProcedure
    .input(z.object({
      type: z.enum(['import', 'export', 'standby']),
      applicant: z.string(),
      applicantBank: z.string(),
      beneficiary: z.string(),
      beneficiaryBank: z.string(),
      beneficiaryCountry: z.string(),
      amount: z.number().positive(),
      currency: z.string(),
      goodsDescription: z.string(),
      shipmentPort: z.string(),
      destinationPort: z.string(),
    }))
    .mutation(async ({ input }) => {
      const lc: LetterOfCredit = {
        id: `LC-${Date.now()}`,
        lcNumber: `LC-2026-${input.type === 'export' ? 'E' : 'A'}${String(seedLCs.length + 1).padStart(3, '0')}`,
        ...input,
        shipmentDeadline: new Date(Date.now() + 60 * 86400000),
        expiryDate: new Date(Date.now() + 90 * 86400000),
        status: 'ISSUED',
        documents: [],
        issuedAt: new Date(),
        formMRef: `FORM-${input.type === 'export' ? 'A' : 'M'}-2026-${String(seedLCs.length + 1).padStart(3, '0')}`,
      };
      seedLCs.push(lc);
      return lc;
    }),

  releaseMilestone: protectedProcedure
    .input(z.object({ escrowId: z.string(), milestoneId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { isAdmin } = getScope(ctx.user as { role: string });
      if (!isAdmin) throw new TRPCError({ code: 'FORBIDDEN' });
      const escrow = seedEscrows.find(e => e.id === input.escrowId);
      if (!escrow) throw new TRPCError({ code: 'NOT_FOUND' });
      const ms = escrow.milestones.find(m => m.id === input.milestoneId);
      if (!ms) throw new TRPCError({ code: 'NOT_FOUND' });
      ms.status = 'released';
      return escrow;
    }),

  payCustomsDuty: protectedProcedure
    .input(z.object({ dutyId: z.string() }))
    .mutation(async ({ input }) => {
      const duty = seedCustomsDuties.find(d => d.id === input.dutyId);
      if (!duty) throw new TRPCError({ code: 'NOT_FOUND' });
      duty.status = 'paid';
      duty.paidAt = new Date();
      return duty;
    }),
});
