import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Lock, Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type Tier = "starter" | "professional" | "enterprise";

const TIER_RANK: Record<Tier, number> = {
  starter: 0,
  professional: 1,
  enterprise: 2,
};

const TIER_LABELS: Record<Tier, string> = {
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

const TIER_COLORS: Record<Tier, string> = {
  starter: "text-slate-500",
  professional: "text-emerald-600",
  enterprise: "text-amber-600",
};

interface SubscriptionGateProps {
  requiredTier: Tier;
  featureName: string;
  children: React.ReactNode;
}

export function SubscriptionGate({ requiredTier, featureName, children }: SubscriptionGateProps) {
  const { data, isLoading } = trpc.accreditation.getMyTier.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentTier = (data?.tier ?? "starter") as Tier;
  const hasAccess = TIER_RANK[currentTier] >= TIER_RANK[requiredTier];

  if (hasAccess) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] bg-slate-50 px-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
        <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-5">
          <Lock className="w-6 h-6 text-amber-500" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900 mb-2">
          {featureName} requires {TIER_LABELS[requiredTier]}
        </h2>
        <p className="text-sm text-slate-500 mb-4 leading-relaxed">
          Your current plan is{" "}
          <span className={`font-semibold ${TIER_COLORS[currentTier]}`}>
            {TIER_LABELS[currentTier]}
          </span>
          . Upgrade to{" "}
          <span className={`font-semibold ${TIER_COLORS[requiredTier]}`}>
            {TIER_LABELS[requiredTier]}
          </span>{" "}
          or higher to unlock {featureName}.
        </p>

        <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 mb-6 text-left">
          <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-emerald-500" />
            What you get with {TIER_LABELS[requiredTier]}:
          </p>
          {requiredTier === "professional" && (
            <ul className="space-y-1.5">
              {[
                "AI Gap Analysis — map NDPA gaps in under 60 seconds",
                "CAR Narrative Generator — professional narratives from ratings",
                "Risk Prediction Engine — DCPMI-based client risk scoring",
                "Up to 25 active audit engagements",
                "Performance Scorecard visibility",
              ].map(f => (
                <li key={f} className="text-xs text-slate-600 flex items-start gap-1.5">
                  <span className="text-emerald-500 mt-0.5">✓</span> {f}
                </li>
              ))}
            </ul>
          )}
          {requiredTier === "enterprise" && (
            <ul className="space-y-1.5">
              {[
                "Unlimited audit engagements",
                "Full AI suite + Risk Prediction",
                "Unlimited Evidence Vault",
                "Dedicated account manager",
                "API access",
              ].map(f => (
                <li key={f} className="text-xs text-slate-600 flex items-start gap-1.5">
                  <span className="text-emerald-500 mt-0.5">✓</span> {f}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Link href="/dpco/subscription">
            <Button className="w-full bg-emerald-700 hover:bg-emerald-800 text-white text-sm h-9">
              Upgrade to {TIER_LABELS[requiredTier]} <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
          <Link href="/dpco-brochure">
            <Button variant="outline" className="w-full text-sm h-9 text-slate-600">
              Compare Plans
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
