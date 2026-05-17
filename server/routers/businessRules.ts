/**
 * 54Link Agency Banking Platform — Business Rules tRPC Router
 * Exposes the business rules engine to the frontend for real-time validation,
 * tier upgrade eligibility checks, and reward catalog management.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc.js";
import {
  CBN_LIMITS,
  KYC_TIER_LIMITS,
  REWARD_CATALOG,
  DEFAULT_COMMISSION_RATES,
  LOYALTY_EARN_RATES,
  TIER_COMMISSION_MULTIPLIERS,
  TIER_LOYALTY_MULTIPLIERS,
  STREAK_BONUSES,
  checkCbnSingleTxLimit,
  checkCbnDailyLimit,
  checkCbnHourlyCount,
  checkKycTierForTransaction,
  calculateCommission,
  calculateLoyaltyPoints,
  evaluateFloatAlert,
  scoreFraud,
  evaluateTierUpgrade,
  validateRedemption,
} from "../lib/businessRules.js";

export const businessRulesRouter = router({
  // ── CBN Limits Reference ─────────────────────────────────────────────────
  cbnLimits: protectedProcedure.query(() => {
    return Object.entries(CBN_LIMITS).map(([tier, limits]) => ({ tier, ...limits }));
  }),

  // ── KYC Tier Limits Reference ────────────────────────────────────────────
  kycTierLimits: protectedProcedure.query(() => {
    return Object.entries(KYC_TIER_LIMITS).map(([tier, limits]) => ({
      tier: Number(tier),
      ...limits,
    }));
  }),

  // ── Reward Catalog ────────────────────────────────────────────────────────
  rewardCatalog: protectedProcedure
    .input(z.object({ category: z.string().optional() }).optional())
    .query(({ input }) => {
      let catalog = REWARD_CATALOG;
      if (input?.category) {
        catalog = catalog.filter(r => r.category === input.category);
      }
      return catalog;
    }),

  // ── Commission Rates Reference ────────────────────────────────────────────
  commissionRates: protectedProcedure.query(() => {
    return Object.entries(DEFAULT_COMMISSION_RATES).map(([txType, rate]) => ({
      txType,
      baseRate: rate,
      baseRatePct: `${(rate * 100).toFixed(2)}%`,
      tierRates: Object.entries(TIER_COMMISSION_MULTIPLIERS).map(([tier, mult]) => ({
        tier,
        effectiveRate: rate * mult,
        effectiveRatePct: `${(rate * mult * 100).toFixed(3)}%`,
      })),
    }));
  }),

  // ── Loyalty Earn Rates Reference ──────────────────────────────────────────
  loyaltyRates: protectedProcedure.query(() => {
    return {
      earnRates: Object.entries(LOYALTY_EARN_RATES).map(([txType, rate]) => ({
        txType,
        pointsPer1000: rate,
      })),
      tierMultipliers: TIER_LOYALTY_MULTIPLIERS,
      streakBonuses: STREAK_BONUSES,
    };
  }),

  // ── Real-Time Transaction Validation ─────────────────────────────────────
  validateTransaction: protectedProcedure
    .input(z.object({
      amount: z.number().positive(),
      agentTier: z.string(),
      currentDailyVolume: z.number().default(0),
      currentHourlyCount: z.number().default(0),
      customerKycTier: z.number().int().min(1).max(3).default(1),
    }))
    .query(({ input }) => {
      const singleCheck = checkCbnSingleTxLimit(input.agentTier, input.amount);
      const dailyCheck  = checkCbnDailyLimit(input.agentTier, input.currentDailyVolume, input.amount);
      const hourlyCheck = checkCbnHourlyCount(input.agentTier, input.currentHourlyCount);
      const kycCheck    = checkKycTierForTransaction(input.customerKycTier, input.amount);

      const commission = calculateCommission(input.agentTier, input.amount, input.agentTier);
      const loyalty    = calculateLoyaltyPoints("Cash In", input.amount, input.agentTier, 0);

      const allowed = singleCheck.allowed && dailyCheck.allowed && hourlyCheck.allowed && kycCheck.allowed;
      const blockers = [singleCheck, dailyCheck, hourlyCheck, kycCheck].filter(c => !c.allowed);

      return {
        allowed,
        blockers,
        commission,
        loyalty,
      };
    }),

  // ── Commission Calculator ─────────────────────────────────────────────────
  calculateCommission: protectedProcedure
    .input(z.object({
      txType: z.string(),
      amount: z.number().positive(),
      agentTier: z.string(),
    }))
    .query(({ input }) => {
      return calculateCommission(input.txType, input.amount, input.agentTier);
    }),

  // ── Loyalty Calculator ────────────────────────────────────────────────────
  calculateLoyalty: protectedProcedure
    .input(z.object({
      txType: z.string(),
      amount: z.number().positive(),
      agentTier: z.string(),
      streakDays: z.number().int().min(0).default(0),
    }))
    .query(({ input }) => {
      return calculateLoyaltyPoints(input.txType, input.amount, input.agentTier, input.streakDays);
    }),

  // ── Float Alert Evaluator ─────────────────────────────────────────────────
  evaluateFloatAlert: protectedProcedure
    .input(z.object({
      currentBalance: z.number(),
      avgDailyVolume: z.number().default(0),
      agentTier: z.string(),
    }))
    .query(({ input }) => {
      return evaluateFloatAlert(input.currentBalance, input.avgDailyVolume, input.agentTier);
    }),

  // ── Fraud Score Calculator ────────────────────────────────────────────────
  scoreFraud: protectedProcedure
    .input(z.object({
      amount: z.number().positive(),
      tier: z.string(),
      hourlyCount: z.number().int().min(0).default(0),
      dailyVolume: z.number().min(0).default(0),
      isOutsideGeofence: z.boolean().default(false),
      failedPinAttempts: z.number().int().min(0).default(0),
      isNewCustomer: z.boolean().default(false),
      isRoundAmount: z.boolean().default(false),
      timeSinceLastTx: z.number().default(-1),
      customerKycTier: z.number().int().min(1).max(3).default(1),
    }))
    .query(({ input }) => {
      return scoreFraud(input);
    }),

  // ── Tier Upgrade Eligibility ──────────────────────────────────────────────
  checkTierUpgrade: protectedProcedure
    .input(z.object({
      currentTier: z.string(),
      monthlyVolume: z.number().default(0),
      monthlyTxCount: z.number().int().default(0),
      loyaltyPoints: z.number().default(0),
      kycLevel: z.number().int().min(1).max(3).default(1),
      streakDays: z.number().int().min(0).default(0),
    }))
    .query(({ input }) => {
      return evaluateTierUpgrade(input);
    }),

  // ── Validate Reward Redemption ────────────────────────────────────────────
  validateRedemption: protectedProcedure
    .input(z.object({
      rewardId: z.string(),
      agentPoints: z.number().int().min(0),
    }))
    .query(({ input }) => {
      return validateRedemption(input.rewardId, input.agentPoints);
    }),
});
