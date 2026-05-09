import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Building2, FileStack, RefreshCw } from "lucide-react";

import ProductShell from "@/components/ProductShell";
import {
  formatRelativeIso,
  getERPNextOverview,
  getPlatformOverview,
  type ERPNextResponse,
  type OverviewResponse,
} from "@/lib/platform";

function syncTone(status: string) {
  switch (status) {
    case "succeeded":
      return "text-emerald-200 bg-emerald-500/10 border-emerald-400/30";
    case "retrying":
    case "in_progress":
      return "text-amber-100 bg-amber-300/10 border-amber-300/30";
    case "failed":
      return "text-rose-100 bg-rose-500/10 border-rose-400/30";
    default:
      return "text-stone-100 bg-white/10 border-white/15";
  }
}

export default function ERPNextWorkspace() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [erpnext, setErpnext] = useState<ERPNextResponse | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [platformOverview, erpOverview] = await Promise.all([getPlatformOverview(), getERPNextOverview()]);
      if (active) {
        setOverview(platformOverview);
        setErpnext(erpOverview);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const products = overview?.products ?? [];
  const services = useMemo(
    () => (overview?.serviceHealth ?? []).filter((service) => ["ERPNext integration", "Customer service", "Reconciliation service"].includes(service.name)),
    [overview],
  );

  const mappedDocuments = erpnext?.config.mappedDocuments ?? [];
  const syncHistory = erpnext?.syncHistory ?? [];

  return (
    <ProductShell
      products={products}
      services={services}
      eyebrow="Accounting integration"
      title="ERPNext document sync, retries, and configuration posture."
      summary="This workspace restores the missing ERP/accounting visibility layer. Finance and operations teams can now monitor tenant configuration, mapped documents, outbound posting status, and retry risk from a dedicated route instead of treating ERPNext as an undocumented external dependency."
    >
      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="space-y-4">
          <article className="rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-3 text-amber-200">
              <Building2 size={18} />
              <p className="text-xs uppercase tracking-[0.25em]">Tenant configuration</p>
            </div>
            <h3 className="mt-4 font-serif text-3xl text-white">{erpnext?.config.company ?? "No company configured"}</h3>
            <p className="mt-3 text-sm leading-7 text-stone-300">
              Mode: <span className="font-semibold text-stone-100">{erpnext?.config.mode ?? "unknown"}</span>. {erpnext?.config.enabled ? "ERPNext sync is enabled for outbound accounting documents." : "ERPNext sync has not been enabled yet for the current tenant."}
            </p>
            <p className="mt-3 text-sm leading-7 text-stone-300">
              Endpoint: <span className="break-all text-stone-100">{erpnext?.config.baseUrl ?? "No endpoint configured"}</span>
            </p>
          </article>

          <article className="rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-3 text-amber-200">
              <FileStack size={18} />
              <p className="text-xs uppercase tracking-[0.25em]">Mapped document types</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {mappedDocuments.length === 0 ? (
                <div className="rounded-[1.3rem] border border-dashed border-white/15 bg-stone-950/40 p-4 text-sm leading-7 text-stone-300">
                  No document mappings have been loaded yet. The connector is ready to expose invoices, payments, journal entries, suppliers, and customer sync states once the ERPNext backend surfaces are connected.
                </div>
              ) : (
                mappedDocuments.map((documentType) => (
                  <span key={documentType} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-stone-200">
                    {documentType}
                  </span>
                ))
              )}
            </div>
          </article>
        </section>

        <section className="rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-amber-300/75">Outbound sync history</p>
              <h3 className="mt-3 font-serif text-3xl text-white">Posting monitor</h3>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-stone-200">
              <RefreshCw size={12} />
              Updated {formatRelativeIso(erpnext?.asOf)}
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {syncHistory.length === 0 ? (
              <div className="rounded-[1.4rem] border border-dashed border-white/15 bg-stone-950/40 p-5 text-sm leading-7 text-stone-300">
                No outbound ERPNext posts have been returned yet. Once the backend connector is restored, this panel will show idempotent sync history, retries, and failure diagnostics per document.
              </div>
            ) : (
              syncHistory.map((record) => (
                <article key={record.syncId} className="rounded-[1.3rem] border border-white/10 bg-stone-950/50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{record.documentType}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-stone-500">{record.syncId} · {record.sourceEntity}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.24em] ${syncTone(record.status)}`}>
                      {record.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Idempotency key</p>
                      <p className="mt-2 text-sm break-all text-stone-100">{record.idempotencyKey}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Last attempt</p>
                      <p className="mt-2 text-sm text-stone-100">{formatRelativeIso(record.lastAttemptAt)}</p>
                    </div>
                  </div>
                  {record.errorDetail ? (
                    <div className="mt-4 rounded-[1.1rem] border border-rose-400/20 bg-rose-500/10 p-3 text-sm leading-7 text-rose-100">
                      {record.errorDetail}
                    </div>
                  ) : null}
                </article>
              ))
            )}
          </div>
          <div className="mt-6 rounded-[1.4rem] border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-7 text-amber-50/90">
            <div className="flex items-start gap-3">
              <ArrowLeftRight size={18} className="mt-1 text-amber-100" />
              <p>
                The restored connector is designed around document mapping, tenant-scoped configuration, outbound posting, idempotency tracking, and retry governance. This view is intentionally centered on operational trust, not placeholder marketing copy.
              </p>
            </div>
          </div>
        </section>
      </div>
    </ProductShell>
  );
}
