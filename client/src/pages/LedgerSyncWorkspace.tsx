import { useEffect, useMemo, useState } from "react";
import { DatabaseZap, Download, FileClock, Scale, ShieldAlert, TimerReset } from "lucide-react";

import ProductShell from "@/components/ProductShell";
import { Button } from "@/components/ui/button";
import {
  createExportJob,
  formatCurrency,
  formatRelativeIso,
  getAuditEntries,
  getAuthContext,
  getExportJobs,
  getLedgerSyncOverview,
  getPlatformOverview,
  type AuditEntry,
  type AuthContextResponse,
  type ExportJob,
  type OverviewResponse,
  type ReconciliationResponse,
} from "@/lib/platform";

function severityTone(severity: string) {
  switch (severity) {
    case "critical":
      return "text-rose-100 bg-rose-500/10 border-rose-400/30";
    case "high":
      return "text-orange-100 bg-orange-500/10 border-orange-400/30";
    case "medium":
      return "text-amber-100 bg-amber-300/10 border-amber-300/30";
    default:
      return "text-stone-100 bg-white/10 border-white/15";
  }
}

function stateTone(state: string) {
  switch (state) {
    case "healthy":
    case "repaired":
    case "ready":
    case "signed":
      return "text-emerald-200 bg-emerald-500/10 border-emerald-400/30";
    case "warning":
    case "acknowledged":
    case "pending":
    case "queued":
      return "text-amber-100 bg-amber-300/10 border-amber-300/30";
    case "critical":
    case "open":
    case "failed":
      return "text-rose-100 bg-rose-500/10 border-rose-400/30";
    default:
      return "text-stone-100 bg-white/10 border-white/15";
  }
}

function downloadTextFile(filename: string, content: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function toCsvRow(values: Array<string | number | null | undefined>) {
  return values.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",");
}

export default function LedgerSyncWorkspace() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [reconciliation, setReconciliation] = useState<ReconciliationResponse | null>(null);
  const [auditItems, setAuditItems] = useState<AuditEntry[]>([]);
  const [exportItems, setExportItems] = useState<ExportJob[]>([]);
  const [authContext, setAuthContext] = useState<AuthContextResponse | null>(null);
  const [railError, setRailError] = useState<string | null>(null);
  const [busyExport, setBusyExport] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [platformOverview, syncOverview, auditResponse, exportResponse, authContextResponse] = await Promise.all([
          getPlatformOverview(),
          getLedgerSyncOverview(),
          getAuditEntries("operations", "ledger"),
          getExportJobs("operations"),
          getAuthContext("operations"),
        ]);
        if (active) {
          setOverview(platformOverview);
          setReconciliation(syncOverview);
          setAuditItems(auditResponse.items ?? []);
          setExportItems(exportResponse.items ?? []);
          setAuthContext(authContextResponse ?? null);
        }
      } catch (error) {
        if (active) {
          setRailError(error instanceof Error ? error.message : "Unable to load ledger control evidence and export history.");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const products = overview?.products ?? [];
  const services = useMemo(
    () => (overview?.serviceHealth ?? []).filter((service) => ["Reconciliation service", "Teller service", "ERPNext integration"].includes(service.name)),
    [overview],
  );
  const snapshot = reconciliation?.latestSnapshot;
  const discrepancies = reconciliation?.discrepancies ?? [];
  const visibleExportItems = useMemo(
    () => exportItems.filter((item) => item.domainKey === "ledger-reconciliation" || item.route === "/ledger-sync").slice(0, 4),
    [exportItems],
  );
  const signedEvidenceItems = useMemo(
    () => visibleExportItems.filter((item) => item.approvalState === "Signed" || item.status === "Ready"),
    [visibleExportItems],
  );
  const allowedDomainKeys = authContext?.visibleDomains ?? [];
  const activePermissions = authContext?.permissions ?? [];
  const activeExportScopes = authContext?.exportScopes ?? [];
  const canOperateLedger = !allowedDomainKeys.length || allowedDomainKeys.includes("ledger-reconciliation");
  const canCreateExports = activeExportScopes.some((scope) => ["ledger", "reconciliation", "audit"].includes(scope));
  const canDownloadEvidence = canCreateExports || activePermissions.includes("export.audit") || activePermissions.includes("ledger.read");
  const retainedDeliveryItems = useMemo(
    () => visibleExportItems.filter((item) => Boolean(item.retainedUntil || item.signedBy?.length || item.approvalChain?.length)).slice(0, 3),
    [visibleExportItems],
  );
  const criticalAuditCount = useMemo(() => auditItems.filter((item) => item.severity === "critical").length, [auditItems]);

  async function handleCreateExport() {
    if (!canOperateLedger || !canCreateExports) {
      setRailError("The active persona cannot create ledger-control export packages for this workspace.");
      return;
    }

    setBusyExport(true);
    setRailError(null);

    try {
      const created = await createExportJob(
        {
          domainKey: "ledger-reconciliation",
          title: "Ledger discrepancy evidence pack",
          format: "csv",
          route: "/ledger-sync",
          rowCount: Math.max(discrepancies.length, auditItems.length, 1),
        },
        "operations",
      );
      setExportItems((current) => [created, ...current]);
    } catch (error) {
      setRailError(error instanceof Error ? error.message : "Unable to create the ledger discrepancy export package.");
    } finally {
      setBusyExport(false);
    }
  }

  function handleDownloadEvidence() {
    if (!canOperateLedger || !canDownloadEvidence) {
      setRailError("The active persona cannot download retained ledger evidence for this workspace.");
      return;
    }

    const evidence = (signedEvidenceItems.length ? signedEvidenceItems : visibleExportItems).map((item) => ({
      id: item.id,
      title: item.title,
      route: item.route,
      format: item.format,
      status: item.status,
      approvalState: item.approvalState,
      rowCount: item.rowCount,
      retainedUntil: item.retainedUntil ?? null,
      signedBy: item.signedBy ?? [],
      approvalChain: item.approvalChain ?? [],
      createdAt: item.createdAt,
    }));

    const csvLines = [
      toCsvRow(["Title", "Format", "Status", "Approval State", "Rows", "Retained Until"]),
      ...evidence.map((item) => toCsvRow([item.title, item.format.toUpperCase(), item.status, item.approvalState, item.rowCount, item.retainedUntil ?? "default retention"])),
    ].join("\n");

    downloadTextFile(
      "ledger-reconciliation-evidence.json",
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          snapshotId: snapshot?.snapshotId ?? null,
          discrepancyCount: discrepancies.length,
          evidence,
        },
        null,
        2,
      ),
      "application/json;charset=utf-8",
    );
    downloadTextFile("ledger-reconciliation-evidence.csv", csvLines, "text/csv;charset=utf-8");
  }

  return (
    <ProductShell
      products={products}
      services={services}
      eyebrow="Ledger parity"
      title="TigerBeetle to PostgreSQL synchronization and discrepancy repair."
      summary="This workspace restores visibility into ledger parity. It is centered on snapshots, classified mismatches, operator review, repair posture, and now retained export evidence so the previously underexposed TigerBeetle-Postgres sync capability becomes a first-class operational surface."
    >
      <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
        <section className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-3 text-amber-200">
                <DatabaseZap size={18} />
                <p className="text-xs uppercase tracking-[0.25em]">Snapshot state</p>
              </div>
              <strong className="mt-4 block font-serif text-4xl text-white">{snapshot?.state ?? "unknown"}</strong>
              <p className="mt-3 text-sm leading-7 text-stone-300">Latest reconciliation run posture across ledger and relational storage.</p>
            </article>
            <article className="rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-3 text-amber-200">
                <ShieldAlert size={18} />
                <p className="text-xs uppercase tracking-[0.25em]">Discrepancies</p>
              </div>
              <strong className="mt-4 block font-serif text-4xl text-white">{snapshot?.discrepancyCount ?? discrepancies.length}</strong>
              <p className="mt-3 text-sm leading-7 text-stone-300">Open parity issues detected during the latest comparison cycle.</p>
            </article>
            <article className="rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-3 text-amber-200">
                <Scale size={18} />
                <p className="text-xs uppercase tracking-[0.25em]">Auto resolved</p>
              </div>
              <strong className="mt-4 block font-serif text-4xl text-white">{snapshot?.autoResolvedCount ?? 0}</strong>
              <p className="mt-3 text-sm leading-7 text-stone-300">Mismatches closed automatically through deterministic repair rules.</p>
            </article>
            <article className="rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-3 text-amber-200">
                <TimerReset size={18} />
                <p className="text-xs uppercase tracking-[0.25em]">Manual review</p>
              </div>
              <strong className="mt-4 block font-serif text-4xl text-white">{snapshot?.manualReviewCount ?? 0}</strong>
              <p className="mt-3 text-sm leading-7 text-stone-300">Cases still awaiting operator review, suppression, or repair approval.</p>
            </article>
          </div>

          <article className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5 text-sm leading-7 text-stone-300">
            <p className="text-xs uppercase tracking-[0.25em] text-amber-300/75">Latest run</p>
            <h3 className="mt-3 font-serif text-3xl text-white">{snapshot?.summary ?? "No reconciliation summary has been loaded yet."}</h3>
            <p className="mt-4">Snapshot identifier: <span className="text-stone-100">{snapshot?.snapshotId ?? "Unavailable"}</span>.</p>
            <p className="mt-2">Observed at: <span className="text-stone-100">{formatRelativeIso(snapshot?.lastRunAt)}</span>.</p>
          </article>

          <article className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-amber-300/75">Ledger evidence controls</p>
                <h3 className="mt-3 font-serif text-3xl text-white">Export and audit trail</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                  onClick={handleDownloadEvidence}
                  disabled={visibleExportItems.length === 0 || !canOperateLedger || !canDownloadEvidence}
                >
                  <FileClock className="mr-2 h-4 w-4" />
                  Download retained evidence
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-amber-300/30 bg-amber-300/10 text-amber-100 hover:bg-amber-300/20"
                  onClick={handleCreateExport}
                  disabled={busyExport || !canOperateLedger || !canCreateExports}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {busyExport ? "Creating export..." : "Create ledger export pack"}
                </Button>
              </div>
            </div>
            {railError ? <p className="mt-4 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{railError}</p> : null}
            {!canOperateLedger ? (
              <p className="mt-4 rounded-[1.3rem] border border-white/10 bg-stone-950/45 p-4 text-sm leading-7 text-stone-300">
                The active persona can inspect the latest reconciliation posture, but export and evidence controls remain restricted until a role with visibility for <span className="font-semibold text-white">ledger-reconciliation</span> is selected.
              </p>
            ) : null}
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <article className={`rounded-[1.3rem] border p-4 ${criticalAuditCount ? "border-rose-400/30 bg-rose-500/10 text-rose-100" : "border-white/10 bg-white/[0.03] text-stone-100"}`}>
                <p className="text-xs uppercase tracking-[0.22em] text-current/80">Audit events</p>
                <strong className="mt-3 block text-lg text-white">{auditItems.length}</strong>
                <p className="mt-2 text-sm leading-6 text-current/90">
                  {criticalAuditCount
                    ? `${criticalAuditCount} critical reconciliation audit event${criticalAuditCount === 1 ? "" : "s"} remain in the retained history.`
                    : "Audit evidence is now surfaced directly in the ledger-control workspace."}
                </p>
              </article>
              <article className={`rounded-[1.3rem] border p-4 ${signedEvidenceItems.length ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-white/[0.03] text-stone-100"}`}>
                <p className="text-xs uppercase tracking-[0.22em] text-current/80">Signed deliveries</p>
                <strong className="mt-3 block text-lg text-white">{signedEvidenceItems.length}</strong>
                <p className="mt-2 text-sm leading-6 text-current/90">
                  {signedEvidenceItems.length
                    ? `${signedEvidenceItems[0]?.title ?? "Latest package"} is available as the newest signed ledger-control artifact.`
                    : "No signed export package has been retained yet for this workspace."}
                </p>
              </article>
              <article className={`rounded-[1.3rem] border p-4 ${retainedDeliveryItems.length ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-white/[0.03] text-stone-100"}`}>
                <p className="text-xs uppercase tracking-[0.22em] text-current/80">Retention trail</p>
                <strong className="mt-3 block text-lg text-white">{retainedDeliveryItems.length}</strong>
                <p className="mt-2 text-sm leading-6 text-current/90">
                  {retainedDeliveryItems.length
                    ? `${retainedDeliveryItems[0]?.approvalChain?.length ?? 0} approval checkpoint${(retainedDeliveryItems[0]?.approvalChain?.length ?? 0) === 1 ? "" : "s"} are preserved on the newest retained delivery record.`
                    : "Retention windows and signer metadata will appear here once export approvals begin flowing through the workspace."}
                </p>
              </article>
            </div>
          </article>
        </section>

        <section className="space-y-4">
          <article className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-amber-300/75">Mismatch register</p>
                <h3 className="mt-3 font-serif text-3xl text-white">Discrepancy queue</h3>
              </div>
              <p className="text-sm text-stone-400">Updated {formatRelativeIso(reconciliation?.asOf)}</p>
            </div>
            <div className="mt-5 space-y-3">
              {discrepancies.length === 0 ? (
                <div className="rounded-[1.4rem] border border-dashed border-white/15 bg-stone-950/40 p-5 text-sm leading-7 text-stone-300">
                  No discrepancies have been returned yet. Once the restored sync endpoints are active, this queue will show account-level parity gaps, severity, classification, and resolution state.
                </div>
              ) : (
                discrepancies.map((discrepancy) => (
                  <article key={discrepancy.discrepancyId} className="rounded-[1.35rem] border border-white/10 bg-stone-950/55 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{discrepancy.accountId}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-stone-500">{discrepancy.discrepancyId} · {discrepancy.classification}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.24em] ${severityTone(discrepancy.severity)}`}>
                          {discrepancy.severity}
                        </span>
                        <span className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.24em] ${stateTone(discrepancy.resolutionState)}`}>
                          {discrepancy.resolutionState}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-stone-500">TigerBeetle</p>
                        <p className="mt-2 text-sm font-semibold text-white">{formatCurrency(discrepancy.tigerbeetleValue)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-stone-500">PostgreSQL</p>
                        <p className="mt-2 text-sm font-semibold text-white">{formatCurrency(discrepancy.postgresValue)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Delta</p>
                        <p className="mt-2 text-sm font-semibold text-white">{formatCurrency(discrepancy.delta)}</p>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </article>

          <article className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-amber-300/75">Audit and delivery evidence</p>
                <h3 className="mt-3 font-serif text-3xl text-white">Live ledger-control history</h3>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-stone-200">
                <FileClock size={12} /> evidence rail
              </span>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.22em] text-stone-400">Recent audit events</p>
                {auditItems.length ? (
                  auditItems.slice(0, 4).map((item) => (
                    <article key={item.id} className="rounded-[1.3rem] border border-white/10 bg-stone-950/55 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{item.action.replaceAll("_", " ")}</p>
                          <p className="mt-2 text-sm leading-7 text-stone-300">{item.outcome}</p>
                          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-stone-500">{item.entityType} · {formatRelativeIso(item.timestamp)}</p>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.24em] ${stateTone(item.severity)}`}>
                          {item.severity}
                        </span>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-[1.3rem] border border-dashed border-white/15 bg-stone-950/40 p-4 text-sm leading-7 text-stone-300">
                    No ledger-filtered audit entries have been returned yet for this routed surface.
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.22em] text-stone-400">Export packages</p>
                {visibleExportItems.length ? (
                  visibleExportItems.map((item) => (
                    <article key={item.id} className="rounded-[1.3rem] border border-white/10 bg-stone-950/55 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{item.title}</p>
                          <p className="mt-2 text-sm leading-7 text-stone-300">
                            {item.format.toUpperCase()} · {item.rowCount} rows · {item.approvalState}
                          </p>
                          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-stone-500">Created {formatRelativeIso(item.createdAt)}</p>
                        </div>
                        <a
                          href={item.downloadUrl}
                          className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-stone-100 transition hover:bg-white/10"
                        >
                          Download
                        </a>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-[1.3rem] border border-dashed border-white/15 bg-stone-950/40 p-4 text-sm leading-7 text-stone-300">
                    No export jobs have been recorded yet for the ledger-control route. Use the control above to create the first discrepancy evidence package.
                  </div>
                )}

                <div className="pt-2">
                  <p className="text-xs uppercase tracking-[0.22em] text-stone-400">Retention and delivery trail</p>
                  <div className="mt-3 space-y-3">
                    {retainedDeliveryItems.length ? (
                      retainedDeliveryItems.map((item) => (
                        <article key={`${item.id}-retention`} className="rounded-[1.3rem] border border-white/10 bg-stone-950/45 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">{item.title}</p>
                              <p className="mt-2 text-sm leading-7 text-stone-300">
                                {item.signedBy?.length ? `Signed by ${item.signedBy.join(", ")}` : "Awaiting signer details"} · {item.approvalChain?.length ?? 0} approval checkpoint{(item.approvalChain?.length ?? 0) === 1 ? "" : "s"}
                              </p>
                              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-stone-500">
                                Retained {item.retainedUntil ? formatRelativeIso(item.retainedUntil) : "under default policy"}
                              </p>
                            </div>
                            <span className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.24em] ${stateTone(item.approvalState)}`}>
                              {item.approvalState}
                            </span>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="rounded-[1.3rem] border border-dashed border-white/15 bg-stone-950/40 p-4 text-sm leading-7 text-stone-300">
                        Signed deliveries, approval chains, and retention windows will appear here once ledger export artifacts begin moving through the approval flow.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </article>
        </section>
      </div>
    </ProductShell>
  );
}
