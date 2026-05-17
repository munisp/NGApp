import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

// Commission Calculator Router — Sprint 78

interface CommissionTier {
  tierName: string;
  minVolume: number;
  maxVolume: number;
  baseRatePct: number;
  bonusRatePct: number;
  minTxCount: number;
}

const TIERS: CommissionTier[] = [
  { tierName: "Bronze", minVolume: 0, maxVolume: 500000, baseRatePct: 0.5, bonusRatePct: 0, minTxCount: 0 },
  { tierName: "Silver", minVolume: 500001, maxVolume: 2000000, baseRatePct: 0.7, bonusRatePct: 0.1, minTxCount: 50 },
  { tierName: "Gold", minVolume: 2000001, maxVolume: 10000000, baseRatePct: 0.9, bonusRatePct: 0.2, minTxCount: 200 },
  { tierName: "Platinum", minVolume: 10000001, maxVolume: 50000000, baseRatePct: 1.1, bonusRatePct: 0.3, minTxCount: 500 },
  { tierName: "Diamond", minVolume: 50000001, maxVolume: Infinity, baseRatePct: 1.3, bonusRatePct: 0.5, minTxCount: 1000 },
];

const TX_TYPE_MULTIPLIERS: Record<string, number> = {
  cash_in: 1.0, cash_out: 1.2, transfer: 0.8, bill_payment: 0.6,
  airtime: 0.4, card_payment: 0.9, qr_payment: 0.7, nfc_payment: 0.9, ussd: 0.5,
};

function getTier(volume: number): CommissionTier {
  return TIERS.find(t => volume >= t.minVolume && volume <= t.maxVolume) ?? TIERS[0];
}

export const commissionCalculatorRouter = router({
  getTiers: protectedProcedure.query(() => {
    return { tiers: TIERS, multipliers: TX_TYPE_MULTIPLIERS };
  }),

  calculate: protectedProcedure
    .input(z.object({
      agentId: z.string(),
      transactions: z.array(z.object({
        ref: z.string(),
        type: z.string(),
        amount: z.number(),
        status: z.string(),
      })),
      period: z.string().optional(),
    }))
    .mutation(({ input }) => {
      const totalVolume = input.transactions.reduce((sum: any, tx: any) => sum + tx.amount, 0);
      const txCount = input.transactions.length;
      const tier = getTier(totalVolume);
      let baseTotal = 0;
      const breakdown = input.transactions.slice(0, 10).map(tx => {
        const multiplier = TX_TYPE_MULTIPLIERS[tx.type] ?? 1.0;
        const commission = tx.amount * (tier.baseRatePct / 100) * multiplier;
        baseTotal += commission;
        return { txRef: tx.ref, type: tx.type, amount: tx.amount, multiplier, commission: Math.round(commission * 100) / 100 };
      });
      // Calculate remaining
      input.transactions.slice(10).forEach(tx => {
        const multiplier = TX_TYPE_MULTIPLIERS[tx.type] ?? 1.0;
        baseTotal += tx.amount * (tier.baseRatePct / 100) * multiplier;
      });
      const bonus = txCount >= tier.minTxCount && tier.bonusRatePct > 0 ? totalVolume * (tier.bonusRatePct / 100) : 0;
      const reversedTxs = input.transactions.filter(tx => tx.status === "reversed");
      const clawback = reversedTxs.reduce((sum: any, tx: any) => {
        const mult = TX_TYPE_MULTIPLIERS[tx.type] ?? 1.0;
        return sum + tx.amount * (tier.baseRatePct / 100) * mult;
      }, 0);
      const total = baseTotal + bonus;
      const net = total - clawback;
      const effectiveRate = totalVolume > 0 ? (net / totalVolume) * 100 : 0;
      return {
        agentId: input.agentId,
        period: input.period ?? "current",
        tier: tier.tierName,
        totalVolume: Math.round(totalVolume * 100) / 100,
        txCount,
        baseCommission: Math.round(baseTotal * 100) / 100,
        bonusCommission: Math.round(bonus * 100) / 100,
        totalCommission: Math.round(total * 100) / 100,
        effectiveRatePct: Math.round(effectiveRate * 10000) / 10000,
        breakdown,
        clawbackAmount: Math.round(clawback * 100) / 100,
        netCommission: Math.round(net * 100) / 100,
      };
    }),

  simulate: protectedProcedure
    .input(z.object({
      volume: z.number().min(0),
      txCount: z.number().min(0),
      txType: z.string().optional(),
    }))
    .query(({ input }) => {
      const tier = getTier(input.volume);
      const multiplier = TX_TYPE_MULTIPLIERS[input.txType ?? "cash_in"] ?? 1.0;
      const base = input.volume * (tier.baseRatePct / 100) * multiplier;
      const bonus = input.txCount >= tier.minTxCount && tier.bonusRatePct > 0 ? input.volume * (tier.bonusRatePct / 100) : 0;
      return {
        tier: tier.tierName,
        baseCommission: Math.round(base * 100) / 100,
        bonusCommission: Math.round(bonus * 100) / 100,
        totalCommission: Math.round((base + bonus) * 100) / 100,
        effectiveRatePct: Math.round(((base + bonus) / input.volume) * 100 * 10000) / 10000,
        nextTier: TIERS.find(t => t.minVolume > input.volume)?.tierName ?? "Max tier reached",
        volumeToNextTier: TIERS.find(t => t.minVolume > input.volume)?.minVolume ? (TIERS.find(t => t.minVolume > input.volume)!.minVolume - input.volume) : 0,
      };
    }),
});
