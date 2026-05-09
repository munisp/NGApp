import { useEffect, useMemo, useState } from "react";
import { Scale } from "lucide-react";

import DomainWorkspace from "@/components/DomainWorkspace";
import {
  getDisputesOverview,
  getPlatformOverview,
  type DomainOverviewResponse,
  type OverviewResponse,
} from "@/lib/platform";

export default function DisputeManagementWorkspace() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [domainOverview, setDomainOverview] = useState<DomainOverviewResponse | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      const [platformOverview, disputesOverview] = await Promise.all([getPlatformOverview(), getDisputesOverview()]);
      if (active) {
        setOverview(platformOverview);
        setDomainOverview(disputesOverview);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const products = overview?.products ?? [];
  const disputeProduct = useMemo(() => products.find((product) => product.key === "dispute-management"), [products]);
  const relatedServices = disputeProduct?.services ?? ["dispute-service", "transfer-service", "merchant-service"];
  const disputeMetrics = domainOverview?.metrics;
  const disputeActions = domainOverview?.actions ?? [];
  const disputeAudits = domainOverview?.audits ?? [];
  const disputeExports = domainOverview?.exports ?? [];

  return (
    <DomainWorkspace
      overview={overview}
      eyebrow="Customer remediation"
      title="Dispute intake, investigation posture, and operator-visible resolution controls."
      summary="This workspace makes dispute management a visible platform route so transaction issues, card chargebacks, merchant claims, and manual review posture are reachable instead of being hidden behind ad hoc support flows."
      serviceNames={relatedServices.map((service) => service.replace(/(^|-)\w/g, (value) => value.toUpperCase()).replaceAll("-", " "))}
      domainKey="dispute-management"
      domainRoute="/disputes"
      defaultRole="operations"
      allowedRoles={["operations", "compliance"]}
      exportTitle="Dispute case review pack"
      heroIcon={Scale}
      accentLabel="Exception handling"
      metrics={[
        {
          label: "Surface status",
          value: disputeProduct?.status ?? "unknown",
          detail: "A dedicated backend overview now backs the dispute route instead of relying only on the shell-level product summary.",
          tone: disputeProduct?.status === "healthy" ? "healthy" : disputeProduct?.status === "degraded" ? "degraded" : "neutral",
        },
        {
          label: "Open actions",
          value: String(disputeMetrics?.openActions ?? disputeActions.filter((item) => item.status !== "Done").length),
          detail: "Dispute queues now expose backend-derived action volume for case review and escalation posture.",
          tone: (disputeMetrics?.pendingActions ?? 0) > 0 ? "degraded" : "healthy",
        },
        {
          label: "Signed exports",
          value: String(disputeMetrics?.signedExports ?? disputeExports.filter((item) => item.approvalState === "Signed").length),
          detail: "Evidence packs and retained review exports are now surfaced through the dedicated disputes overview endpoint.",
          tone: "neutral",
        },
        {
          label: "Audit events",
          value: String(disputeMetrics?.auditEvents ?? disputeAudits.length),
          detail: "Recent remediation and investigation evidence is counted directly from the dispute domain payload.",
          tone: disputeAudits.length > 0 ? "healthy" : "neutral",
        },
      ]}
      collectionTitle="Dispute lanes"
      collectionSummary="Investigation and resolution coverage"
      collectionItems={[
        {
          title: "Transfer disputes",
          subtitle: `${disputeActions.length || 0} routed operator actions`,
          state: disputeProduct?.status === "degraded" ? "warning" : "active",
          detail: "Keep transaction-reversal, exception, and confirmation handling visible when interbank dependencies or ledgers require manual review.",
          chips: ["Transfers", "Manual review", "Reversal"],
        },
        {
          title: "Merchant claims",
          subtitle: `${disputeMetrics?.pendingActions ?? 0} pending escalations`,
          state: (disputeMetrics?.pendingActions ?? 0) > 0 ? "warning" : "review",
          detail: "Surface merchant-payment disputes and settlement questions as routed operational work, not hidden chat-thread tasks.",
          chips: ["Merchants", "Settlement", "Claims"],
        },
        {
          title: "Customer evidence workflow",
          subtitle: `${disputeExports.length || 0} export artifacts`,
          state: disputeExports.length > 0 ? "active" : "review",
          detail: "A dedicated route now carries retained evidence packs and case-state data from the dispute domain endpoint itself.",
          chips: ["Evidence", "Audit", "Customer"],
        },
      ]}
      collectionEmpty="No dispute records have loaded yet. This route is ready to host active cases, evidence, and resolution states as service APIs deepen."
      actionTitle="Resolution controls"
      actionSummary="Dispute operations depend on clear intake, adjudication, and escalation posture across multiple financial domains."
      actionItems={[
        {
          title: disputeActions[0]?.title || "Manual resolution queue",
          detail: disputeActions[0]?.detail || "Explicit operator review remains necessary when payment confirmations, ledgers, or partner rails cannot conclusively resolve a case automatically.",
          state: disputeActions[0]?.status || "review",
        },
        {
          title: disputeActions[1]?.title || "Escalation to treasury or merchant ops",
          detail: disputeActions[1]?.detail || "Disputes should route cleanly to downstream teams instead of disappearing into generic support navigation.",
          state: disputeActions[1]?.status || "active",
        },
        {
          title: disputeActions[2]?.title || "Customer-status transparency",
          detail: disputeActions[2]?.detail || "Degraded dependencies should show up as visible case posture, not as silent resolution or disappearance from the user interface.",
          state: disputeActions[2]?.status || "warning",
        },
      ]}
      actionEmpty="No dispute control actions are loaded yet. This workspace is ready to host them as routes and APIs expand."
    />
  );
}
