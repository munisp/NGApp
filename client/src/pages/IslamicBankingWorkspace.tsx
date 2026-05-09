import { useEffect, useMemo, useState } from "react";
import { Banknote, BadgePercent, Handshake, ShieldCheck } from "lucide-react";

import ProductShell from "@/components/ProductShell";
import {
  formatCurrency,
  formatRelativeIso,
  getIslamicBankingOverview,
  getPlatformOverview,
  type IslamicBankingResponse,
  type OverviewResponse,
} from "@/lib/platform";

function contractTone(state: string) {
  switch (state) {
    case "active":
      return "text-emerald-200 bg-emerald-500/10 border-emerald-400/30";
    case "review":
      return "text-amber-100 bg-amber-300/10 border-amber-300/30";
    case "delinquent":
      return "text-rose-100 bg-rose-500/10 border-rose-400/30";
    case "matured":
      return "text-sky-100 bg-sky-500/10 border-sky-400/30";
    default:
      return "text-stone-100 bg-white/10 border-white/15";
  }
}

export default function IslamicBankingWorkspace() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [islamic, setIslamic] = useState<IslamicBankingResponse | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [platformOverview, islamicOverview] = await Promise.all([getPlatformOverview(), getIslamicBankingOverview()]);
      if (active) {
        setOverview(platformOverview);
        setIslamic(islamicOverview);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const products = overview?.products ?? [];
  const services = useMemo(
    () => (overview?.serviceHealth ?? []).filter((service) => ["Islamic banking service", "Customer service", "ERPNext integration"].includes(service.name)),
    [overview],
  );
  const summary = islamic?.summary;
  const contracts = islamic?.contracts ?? [];

  return (
    <ProductShell
      products={products}
      services={services}
      eyebrow="Sharia-compliant portfolio"
      title="Murabaha, Ijara, and Mudarabah as visible banking products."
      summary="Islamic banking is restored here as a first-class domain with contract visibility, profit-structure language, asset context, and takaful-aware portfolio posture. This route exists because the audit confirmed that the prior archive had no surviving active Islamic banking surface at all."
    >
      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
          <article className="rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-3 text-amber-200">
              <Handshake size={18} />
              <p className="text-xs uppercase tracking-[0.25em]">Active contracts</p>
            </div>
            <strong className="mt-4 block font-serif text-4xl text-white">{summary?.activeContracts ?? 0}</strong>
            <p className="mt-3 text-sm leading-7 text-stone-300">Live Murabaha, Ijara, and Mudarabah contracts currently in the managed portfolio.</p>
          </article>
          <article className="rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-3 text-amber-200">
              <Banknote size={18} />
              <p className="text-xs uppercase tracking-[0.25em]">Outstanding exposure</p>
            </div>
            <strong className="mt-4 block font-serif text-4xl text-white">{formatCurrency(summary?.outstandingExposure ?? 0)}</strong>
            <p className="mt-3 text-sm leading-7 text-stone-300">Current financed asset or investment exposure under compliant contracts.</p>
          </article>
          <article className="rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-3 text-amber-200">
              <BadgePercent size={18} />
              <p className="text-xs uppercase tracking-[0.25em]">Approved exposure</p>
            </div>
            <strong className="mt-4 block font-serif text-4xl text-white">{formatCurrency(summary?.approvedExposure ?? 0)}</strong>
            <p className="mt-3 text-sm leading-7 text-stone-300">Approved portfolio capacity across financing and investment structures.</p>
          </article>
          <article className="rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-3 text-amber-200">
              <ShieldCheck size={18} />
              <p className="text-xs uppercase tracking-[0.25em]">Takaful coverage</p>
            </div>
            <strong className="mt-4 block font-serif text-4xl text-white">{summary?.takafulCoverageRate ?? 0}%</strong>
            <p className="mt-3 text-sm leading-7 text-stone-300">Coverage rate across active compliant contracts requiring insurance participation.</p>
          </article>
        </section>

        <section className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-amber-300/75">Contract register</p>
              <h3 className="mt-3 font-serif text-3xl text-white">Portfolio view</h3>
            </div>
            <p className="text-sm text-stone-400">Updated {formatRelativeIso(islamic?.asOf)}</p>
          </div>
          <div className="mt-5 space-y-4">
            {contracts.length === 0 ? (
              <div className="rounded-[1.4rem] border border-dashed border-white/15 bg-stone-950/40 p-5 text-sm leading-7 text-stone-300">
                No Islamic banking contracts have been returned yet. As the backend restoration proceeds, this route will surface compliant product applications, contract states, asset records, profit schedules, and delinquency posture.
              </div>
            ) : (
              contracts.map((contract) => (
                <article key={contract.productId} className="rounded-[1.4rem] border border-white/10 bg-stone-950/55 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-semibold text-white">{contract.name}</h4>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-stone-500">{contract.contractType} · {contract.assetClass}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.24em] ${contractTone(contract.state)}`}>
                      {contract.state}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Approved</p>
                      <p className="mt-2 text-sm font-semibold text-white">{formatCurrency(contract.approvedExposure)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Outstanding</p>
                      <p className="mt-2 text-sm font-semibold text-white">{formatCurrency(contract.outstandingExposure)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Profit structure</p>
                      <p className="mt-2 text-sm text-stone-100">{contract.profitRateDescription}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Next milestone</p>
                      <p className="mt-2 text-sm text-stone-100">{contract.nextMilestone}</p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </ProductShell>
  );
}
