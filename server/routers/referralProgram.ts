/**
 * Referral Program — Agent referral tracking, rewards, and leaderboard
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

interface ReferralTier {
  id: string; name: string; minReferrals: number; bonusPerReferral: number;
  monthlyBonus: number; badge: string;
}

interface Referral {
  id: string; referrerCode: string; referrerName: string; referredCode: string;
  referredName: string; status: "pending" | "active" | "qualified" | "rewarded" | "expired";
  bonusAmount: number; referredAt: number; qualifiedAt: number | null;
  rewardedAt: number | null;
}

const tiers: ReferralTier[] = [
  { id: "RT-001", name: "Bronze Referrer", minReferrals: 1, bonusPerReferral: 500, monthlyBonus: 0, badge: "🥉" },
  { id: "RT-002", name: "Silver Referrer", minReferrals: 5, bonusPerReferral: 750, monthlyBonus: 2000, badge: "🥈" },
  { id: "RT-003", name: "Gold Referrer", minReferrals: 15, bonusPerReferral: 1000, monthlyBonus: 5000, badge: "🥇" },
  { id: "RT-004", name: "Diamond Referrer", minReferrals: 30, bonusPerReferral: 1500, monthlyBonus: 15000, badge: "💎" },
  { id: "RT-005", name: "Platinum Referrer", minReferrals: 50, bonusPerReferral: 2500, monthlyBonus: 30000, badge: "👑" },
];

const referrals: Referral[] = [];
for (let i = 1; i <= 50; i++) {
  const statuses: Referral["status"][] = ["pending", "active", "qualified", "rewarded", "expired"];
  referrals.push({
    id: `REF-${String(i).padStart(4, "0")}`,
    referrerCode: `AGT${String((i % 10) + 1).padStart(3, "0")}`,
    referrerName: `Agent ${["Adebayo", "Okonkwo", "Ibrahim", "Okafor", "Bello"][i % 5]}`,
    referredCode: `AGT${String(100 + i).padStart(3, "0")}`,
    referredName: `New Agent ${["Titi", "Emeka", "Aminu", "Ngozi", "Kunle"][i % 5]}`,
    status: statuses[i % statuses.length],
    bonusAmount: [500, 750, 1000, 1500, 2500][i % 5],
    referredAt: Date.now() - i * 604800000,
    qualifiedAt: ["qualified", "rewarded"].includes(statuses[i % statuses.length]) ? Date.now() - i * 604800000 + 604800000 : null,
    rewardedAt: statuses[i % statuses.length] === "rewarded" ? Date.now() - i * 604800000 + 1209600000 : null,
  });
}

export const referralProgramRouter = router({
  tiers: protectedProcedure.query(() => ({ tiers })),

  refer: protectedProcedure
    .input(z.object({ referrerCode: z.string(), referrerName: z.string(), referredName: z.string(), referredPhone: z.string() }))
    .mutation(({ input }) => {
      const referral: Referral = {
        id: `REF-${String(referrals.length + 1).padStart(4, "0")}`,
        referrerCode: input.referrerCode, referrerName: input.referrerName,
        referredCode: `AGT${String(200 + referrals.length).padStart(3, "0")}`,
        referredName: input.referredName,
        status: "pending", bonusAmount: 500, referredAt: Date.now(),
        qualifiedAt: null, rewardedAt: null,
      };
      referrals.push(referral);
      return { success: true, referral };
    }),

  list: protectedProcedure
    .input(z.object({ referrerCode: z.string().optional(), status: z.string().optional(), limit: z.number().default(20) }).optional())
    .query(({ input }) => {
      let filtered = [...referrals].sort((a: any, b: any) => b.referredAt - a.referredAt);
      if (input?.referrerCode) filtered = filtered.filter(r => r.referrerCode === input.referrerCode);
      if (input?.status) filtered = filtered.filter(r => r.status === input.status);
      return { referrals: filtered.slice(0, input?.limit ?? 20), total: filtered.length };
    }),

  leaderboard: protectedProcedure.query(() => {
    const agentCounts: Record<string, { name: string; count: number; earned: number }> = {};
    referrals.forEach(r => {
      if (!agentCounts[r.referrerCode]) agentCounts[r.referrerCode] = { name: r.referrerName, count: 0, earned: 0 };
      agentCounts[r.referrerCode].count++;
      if (r.status === "rewarded") agentCounts[r.referrerCode].earned += r.bonusAmount;
    });
    const leaders = Object.entries(agentCounts)
      .map(([code, data]) => ({
        agentCode: code, agentName: data.name, referralCount: data.count, totalEarned: data.earned,
        tier: tiers.filter(t => data.count >= t.minReferrals).pop() || tiers[0],
      }))
      .sort((a: any, b: any) => b.referralCount - a.referralCount);
    return { leaderboard: leaders.slice(0, 20) };
  }),

  analytics: protectedProcedure.query(() => ({
    totalReferrals: referrals.length,
    qualified: referrals.filter(r => r.status === "qualified" || r.status === "rewarded").length,
    totalBonusPaid: referrals.filter(r => r.status === "rewarded").reduce((s: any, r: any) => s + r.bonusAmount, 0),
    conversionRate: referrals.length > 0 ? Math.round(referrals.filter(r => ["qualified", "rewarded"].includes(r.status)).length / referrals.length * 100) : 0,
    byStatus: referrals.reduce((a: any, r: any) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {} as Record<string, number>),
  })),
});
