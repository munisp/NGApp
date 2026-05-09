import { useEffect, useMemo, useState } from "react";
import { ShipWheel } from "lucide-react";

import DomainWorkspace from "@/components/DomainWorkspace";
import {
  getPlatformOverview,
  getTradeFinanceOverview,
  type DomainOverviewResponse,
  type OverviewResponse,
} from "@/lib/platform";

export default function TradeFinanceWorkspace() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [domainOverview, setDomainOverview] = useState<DomainOverviewResponse | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      const [platformOverview, tradeOverview] = await Promise.all([getPlatformOverview(), getTradeFinanceOverview()]);
      if (active) {
        setOverview(platformOverview);
        setDomainOverview(tradeOverview);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const products = overview?.products ?? [];
  const tradeProduct = useMemo(() => products.find((product) => product.key === "trade-finance"), [products]);
  const relatedServices = tradeProduct?.services ?? ["trade-finance-service", "fx-service", "compliance-service"];
  const tradeMetrics = domainOverview?.metrics;
  const tradeActions = domainOverview?.actions ?? [];
  const tradeAudits = domainOverview?.audits ?? [];
  const tradeExports = domainOverview?.exports ?? [];

  return (
    <DomainWorkspace
      overview={overview}
      eyebrow="Trade and treasury execution"
      title="Letters of credit, FX readiness, and documentary trade controls."
      summary="The trade-finance route keeps documentary operations visible inside the product shell so letters of credit, partner bank exposure, compliance review, and FX dependency posture are reachable instead of being buried as secondary fragments inside other pages."
      serviceNames={["Customer service", ...relatedServices.map((service) => service.replace(/(^|-)\w/g, (value) => value.toUpperCase()).replaceAll("-", " "))]}
      domainKey="trade-finance"
      domainRoute="/trade-finance"
      defaultRole="treasury"
      allowedRoles={["treasury", "operations"]}
      exportTitle="Trade finance control pack"
      heroIcon={ShipWheel}
      accentLabel="Cross-border instruments"
      metrics={[
        {
          label: "Surface status",
          value: tradeProduct?.status ?? "unknown",
          detail: "This route now reflects a dedicated backend overview rather than only a shell-level summary.",
          tone: tradeProduct?.status === "healthy" ? "healthy" : tradeProduct?.status === "degraded" ? "degraded" : "neutral",
        },
        {
          label: "Open actions",
          value: String(tradeMetrics?.openActions ?? tradeActions.filter((item) => item.status !== "Done").length),
          detail: "The trade desk now receives backend-sourced action counts for documentary and treasury workflows.",
          tone: (tradeMetrics?.pendingActions ?? 0) > 0 ? "degraded" : "healthy",
        },
        {
          label: "Signed exports",
          value: String(tradeMetrics?.signedExports ?? tradeExports.filter((item) => item.approvalState === "Signed").length),
          detail: "Evidence retention for trade operations is now exposed through the dedicated domain endpoint.",
          tone: "neutral",
        },
        {
          label: "Audit events",
          value: String(tradeMetrics?.auditEvents ?? tradeAudits.length),
          detail: "Recent audit evidence is counted directly from the routed trade-finance overview payload.",
          tone: tradeAudits.length > 0 ? "healthy" : "neutral",
        },
      ]}
      collectionTitle="Trade instrument focus"
      collectionSummary="Documentary execution lanes"
      collectionItems={[
        {
          title: "Letters of credit",
          subtitle: `${tradeActions.length || 0} routed operator actions`,
          state: tradeProduct?.status === "degraded" ? "warning" : "active",
          detail: "Operationally track issuance, discrepancy review, and final settlement for documentary trade instruments across partner-bank and compliance checkpoints.",
          chips: ["Documentary review", "Partner bank", "Settlement"],
        },
        {
          title: "FX approval posture",
          subtitle: `${tradeMetrics?.pendingActions ?? 0} pending escalations`,
          state: (tradeMetrics?.pendingActions ?? 0) > 0 ? "warning" : "healthy",
          detail: "Expose the dependency between customer trade journeys and external FX pricing so outages are treated as degraded operations rather than silent approvals.",
          chips: ["FX service", "Treasury", "Audit trail"],
        },
        {
          title: "Evidence retention",
          subtitle: `${tradeExports.length || 0} export artifacts`,
          state: tradeExports.length > 0 ? "active" : "review",
          detail: "Connect trade documentation, evidence packs, and downstream financing workflows without forcing operators back to the landing page.",
          chips: ["Exports", "Controls", "Financing"],
        },
      ]}
      collectionEmpty="No trade-finance instrumentation has loaded yet. This route is ready to host letters of credit, FX workflow state, and trade-document controls as their APIs are expanded."
      actionTitle="Operator control rail"
      actionSummary="These controls represent the kinds of work the trade desk and operations teams need to keep visible in the same shell as other restored banking domains."
      actionItems={[
        {
          title: "Partner-bank coordination",
          detail: tradeActions[0]?.detail || "Keep escalation, amendment, and settlement work visible when external banks or messaging rails slow down a trade transaction.",
          state: tradeActions[0]?.status || "active",
        },
        {
          title: "Compliance hold handling",
          detail: tradeActions[1]?.detail || "Trade instruments should surface screening or documentation holds as operator-visible control items, not background assumptions.",
          state: tradeActions[1]?.status || "review",
        },
        {
          title: "FX dependency disclosure",
          detail: tradeActions[2]?.detail || "If pricing or treasury confirmation is unavailable, the route should still remain reachable while showing degraded operational posture clearly.",
          state: tradeActions[2]?.status || "warning",
        },
      ]}
      actionEmpty="No trade actions are available yet. This workspace is in place to host them as endpoints are wired."
    />
  );
}
