// Carrier Cost Comparison Router — Sprint 76
// Per-carrier SMS/data pricing, cost comparison, billing integration
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

const CARRIER_RATES = [
  { carrier: "MTN", country: "NG", smsCostUsd: 0.015, dataCostPerMbUsd: 0.08, ussdCostUsd: 0.005, voiceCostPerMinUsd: 0.03, currency: "NGN", exchangeRate: 1550 },
  { carrier: "Airtel", country: "NG", smsCostUsd: 0.012, dataCostPerMbUsd: 0.07, ussdCostUsd: 0.004, voiceCostPerMinUsd: 0.025, currency: "NGN", exchangeRate: 1550 },
  { carrier: "Glo", country: "NG", smsCostUsd: 0.010, dataCostPerMbUsd: 0.06, ussdCostUsd: 0.003, voiceCostPerMinUsd: 0.02, currency: "NGN", exchangeRate: 1550 },
  { carrier: "9mobile", country: "NG", smsCostUsd: 0.013, dataCostPerMbUsd: 0.075, ussdCostUsd: 0.004, voiceCostPerMinUsd: 0.028, currency: "NGN", exchangeRate: 1550 },
  { carrier: "Safaricom", country: "KE", smsCostUsd: 0.008, dataCostPerMbUsd: 0.05, ussdCostUsd: 0.003, voiceCostPerMinUsd: 0.02, currency: "KES", exchangeRate: 155 },
  { carrier: "MTN_GH", country: "GH", smsCostUsd: 0.011, dataCostPerMbUsd: 0.065, ussdCostUsd: 0.004, voiceCostPerMinUsd: 0.022, currency: "GHS", exchangeRate: 15.5 },
  { carrier: "Vodafone_GH", country: "GH", smsCostUsd: 0.012, dataCostPerMbUsd: 0.07, ussdCostUsd: 0.005, voiceCostPerMinUsd: 0.025, currency: "GHS", exchangeRate: 15.5 },
  { carrier: "Orange_SN", country: "SN", smsCostUsd: 0.009, dataCostPerMbUsd: 0.055, ussdCostUsd: 0.003, voiceCostPerMinUsd: 0.018, currency: "XOF", exchangeRate: 610 },
  { carrier: "MTN_ZA", country: "ZA", smsCostUsd: 0.018, dataCostPerMbUsd: 0.09, ussdCostUsd: 0.006, voiceCostPerMinUsd: 0.035, currency: "ZAR", exchangeRate: 18.5 },
  { carrier: "Vodacom_ZA", country: "ZA", smsCostUsd: 0.020, dataCostPerMbUsd: 0.095, ussdCostUsd: 0.007, voiceCostPerMinUsd: 0.038, currency: "ZAR", exchangeRate: 18.5 },
];

export const carrierCostRouter = router({
  getRates: protectedProcedure
    .input(z.object({ country: z.string().optional() }))
    .query(({ input }) => {
      return input.country ? CARRIER_RATES.filter(r => r.country === input.country) : CARRIER_RATES;
    }),

  compare: protectedProcedure
    .input(z.object({
      country: z.string(),
      smsCount: z.number().min(0).default(0),
      dataMb: z.number().min(0).default(0),
      ussdCount: z.number().min(0).default(0),
      voiceMin: z.number().min(0).default(0),
    }))
    .query(({ input }) => {
      const rates = CARRIER_RATES.filter(r => r.country === input.country);
      const results = rates.map(rate => {
        const breakdown = {
          sms: Math.round(input.smsCount * rate.smsCostUsd * 1000) / 1000,
          data: Math.round(input.dataMb * rate.dataCostPerMbUsd * 1000) / 1000,
          ussd: Math.round(input.ussdCount * rate.ussdCostUsd * 1000) / 1000,
          voice: Math.round(input.voiceMin * rate.voiceCostPerMinUsd * 1000) / 1000,
        };
        const totalUsd = Math.round((breakdown.sms + breakdown.data + breakdown.ussd + breakdown.voice) * 1000) / 1000;
        return {
          carrier: rate.carrier,
          totalCostUsd: totalUsd,
          totalCostLocal: Math.round(totalUsd * rate.exchangeRate * 100) / 100,
          currency: rate.currency,
          breakdown,
          rank: 0,
          savingsVsWorstUsd: 0,
        };
      }).sort((a: any, b: any) => a.totalCostUsd - b.totalCostUsd);

      const worst = results.length > 0 ? results[results.length - 1].totalCostUsd : 0;
      results.forEach((r, i) => {
        r.rank = i + 1;
        r.savingsVsWorstUsd = Math.round((worst - r.totalCostUsd) * 1000) / 1000;
      });
      return results;
    }),

  getCountries: protectedProcedure.query(() => {
    const countries = [...new Set(CARRIER_RATES.map(r => r.country))];
    return countries.map(c => ({
      code: c,
      carriers: CARRIER_RATES.filter(r => r.country === c).map(r => r.carrier),
      currency: CARRIER_RATES.find(r => r.country === c)!.currency,
    }));
  }),
});
