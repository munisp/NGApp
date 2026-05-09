import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Landmark, ShieldAlert, Wallet } from "lucide-react";

import ProductShell from "@/components/ProductShell";
import {
  formatCurrency,
  formatRelativeIso,
  getPlatformOverview,
  getTellerOverview,
  type OverviewResponse,
  type TellerOverviewResponse,
} from "@/lib/platform";

function sessionTone(state: string) {
  switch (state) {
    case "open":
      return "text-emerald-200 bg-emerald-500/10 border-emerald-400/30";
    case "balanced":
      return "text-sky-100 bg-sky-500/10 border-sky-400/30";
    case "under_review":
      return "text-amber-100 bg-amber-300/10 border-amber-300/30";
    case "closed":
      return "text-stone-100 bg-white/10 border-white/15";
    default:
      return "text-stone-100 bg-white/10 border-white/15";
  }
}

export default function TellerWorkspace() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [teller, setTeller] = useState<TellerOverviewResponse | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [platformOverview, tellerOverview] = await Promise.all([getPlatformOverview(), getTellerOverview()]);
      if (active) {
        setOverview(platformOverview);
        setTeller(tellerOverview);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const tellerServices = useMemo(
    () => (overview?.serviceHealth ?? []).filter((service) => ["Teller service", "Customer service", "Reconciliation service"].includes(service.name)),
    [overview],
  );

  const products = overview?.products ?? [];
  const sessions = teller?.sessions ?? [];
  const transactions = teller?.recentTransactions ?? [];
  const totalFloat = sessions.reduce((sum, session) => sum + session.availableCash, 0);
  const imbalance = sessions.reduce((sum, session) => sum + Math.abs(session.imbalanceAmount), 0);

  return (
    <ProductShell
      products={products}
      services={tellerServices}
      eyebrow="Branch cash operations"
      title="Teller control, till balances, and over-the-counter execution."
      summary="This restored teller surface is designed around branch sessions, vault movements, customer cash processing, and balancing controls. It turns teller operations into a visible banking domain instead of leaving cash workflows implied inside adjacent agent modules."
    >
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-3 text-amber-200">
                <Wallet size={18} />
                <p className="text-xs uppercase tracking-[0.25em]">Till liquidity</p>
              </div>
              <strong className="mt-4 block font-serif text-4xl text-white">{formatCurrency(totalFloat)}</strong>
              <p className="mt-3 text-sm leading-7 text-stone-300">Cash currently assigned across active teller tills and balancing windows.</p>
            </article>
            <article className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-3 text-amber-200">
                <ShieldAlert size={18} />
                <p className="text-xs uppercase tracking-[0.25em]">Imbalance exposure</p>
              </div>
              <strong className="mt-4 block font-serif text-4xl text-white">{formatCurrency(imbalance)}</strong>
              <p className="mt-3 text-sm leading-7 text-stone-300">Net cash discrepancies requiring balancing, review, or vault settlement.</p>
            </article>
          </div>

          <article className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-amber-300/75">Active teller sessions</p>
                <h3 className="mt-3 font-serif text-3xl text-white">Branch workbench</h3>
              </div>
              <p className="text-sm text-stone-400">Updated {formatRelativeIso(teller?.asOf)}</p>
            </div>
            <div className="mt-5 space-y-4">
              {sessions.length === 0 ? (
                <div className="rounded-[1.4rem] border border-dashed border-white/15 bg-stone-950/40 p-5 text-sm leading-7 text-stone-300">
                  No teller sessions have been loaded yet. Once the teller service endpoints are connected, this view will display branch sessions, opening balances, till states, and end-of-day balancing outcomes.
                </div>
              ) : (
                sessions.map((session) => (
                  <article key={session.tellerId} className="rounded-[1.4rem] border border-white/10 bg-stone-950/50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h4 className="text-lg font-semibold text-white">{session.tellerName}</h4>
                        <p className="mt-1 text-sm text-stone-400">{session.branch} · Till {session.tillAccountId}</p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.24em] ${sessionTone(session.state)}`}>
                        {session.state.replace("_", " ")}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Opening float</p>
                        <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(session.openingFloat)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Available cash</p>
                        <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(session.availableCash)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Pending transactions</p>
                        <p className="mt-2 text-lg font-semibold text-white">{session.pendingTransactions}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Imbalance</p>
                        <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(session.imbalanceAmount)}</p>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </article>
        </section>

        <section className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-amber-300/75">Recent cash movements</p>
              <h3 className="mt-3 font-serif text-3xl text-white">Transaction queue</h3>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-stone-200">
              <Landmark size={12} /> branch cash control
            </span>
          </div>
          <div className="mt-5 space-y-3">
            {transactions.length === 0 ? (
              <div className="rounded-[1.4rem] border border-dashed border-white/15 bg-stone-950/40 p-5 text-sm leading-7 text-stone-300">
                No live teller transactions have been returned yet. This workspace is ready to show posted deposits, withdrawals, vault adjustments, and reversal reviews once the teller APIs are connected.
              </div>
            ) : (
              transactions.map((transaction) => (
                <article key={transaction.transactionId} className="rounded-[1.3rem] border border-white/10 bg-stone-950/55 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{transaction.customerName}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-stone-500">{transaction.transactionId} · {transaction.branch}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-white">{formatCurrency(transaction.amount, transaction.currency)}</p>
                      <p className="mt-1 text-xs text-stone-400">{formatRelativeIso(transaction.createdAt)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-stone-100">
                      {transaction.transactionType.replaceAll("_", " ")}
                    </span>
                    <span className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.24em] ${sessionTone(transaction.status)}`}>
                      {transaction.status}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-stone-400">
                      {transaction.transactionType === "cash_deposit" || transaction.transactionType === "vault_funding" ? <ArrowDownToLine size={14} /> : <ArrowUpFromLine size={14} />}
                      Cash movement recorded
                    </span>
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
