import { useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";

import DomainWorkspace from "@/components/DomainWorkspace";
import {
  getEsusuOverview,
  getPlatformOverview,
  type DomainOverviewResponse,
  type OverviewResponse,
} from "@/lib/platform";

export default function EsusuWorkspace() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [domainOverview, setDomainOverview] = useState<DomainOverviewResponse | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      const [platformOverview, esusuOverview] = await Promise.all([getPlatformOverview(), getEsusuOverview()]);
      if (!active) {
        return;
      }
      setOverview(platformOverview);
      setDomainOverview(esusuOverview);
    })();

    return () => {
      active = false;
    };
  }, []);

  const products = overview?.products ?? [];
  const esusuProduct = useMemo(() => products.find((product) => product.key === "esusu-groups"), [products]);
  const relatedServices = esusuProduct?.services ?? ["esusu-service", "notification-service", "agent-service"];
  const esusuMetrics = domainOverview?.metrics;
  const esusuActions = domainOverview?.actions ?? [];
  const esusuAudits = domainOverview?.audits ?? [];
  const esusuExports = domainOverview?.exports ?? [];
  const criticalAudits = esusuAudits.filter((item) => item.severity === "critical").length;
  const warningAudits = esusuAudits.filter((item) => item.severity === "warning").length;

  return (
    <DomainWorkspace
      overview={overview}
      eyebrow="Rotating savings and communal collections"
      title="Esusu group collections, payout readiness, and reminder controls."
      summary="The esusu route deepens another still-thin retail domain so contribution reminders, group-health supervision, payout-hold exceptions, and signed communal-savings evidence stay visible as first-class operations work instead of remaining hidden inside platform-level notes."
      serviceNames={["Customer service", ...relatedServices.map((service) => service.replace(/(^|-|\b)\w/g, (value) => value.toUpperCase()).replaceAll("-", " "))]}
      domainKey="esusu-groups"
      domainRoute="/esusu"
      defaultRole="operations"
      allowedRoles={["operations", "branch"]}
      exportTitle="Esusu control pack"
      exportFormat="json"
      heroIcon={Users}
      accentLabel="Community savings desk"
      metrics={[
        {
          label: "Surface status",
          value: esusuProduct?.status ?? "unknown",
          detail: "Esusu collections are now backed by a dedicated routed overview instead of staying implicit in middleware notes.",
          tone: esusuProduct?.status === "healthy" ? "healthy" : esusuProduct?.status === "degraded" ? "degraded" : "neutral",
        },
        {
          label: "Open actions",
          value: String(esusuMetrics?.openActions ?? esusuActions.filter((item) => item.status !== "Done").length),
          detail: "Contribution-cycle exceptions, payout holds, and reminder reviews remain visible for branch and central operators.",
          tone: (esusuMetrics?.pendingActions ?? 0) > 0 ? "degraded" : "healthy",
        },
        {
          label: "Signed exports",
          value: String(esusuMetrics?.signedExports ?? esusuExports.filter((item) => item.approvalState === "Signed").length),
          detail: "Payout and defaulter review packs stay attached to the communal-savings desk through the shared export rail.",
          tone: esusuExports.length > 0 ? "healthy" : "neutral",
        },
        {
          label: "Critical controls",
          value: String(criticalAudits || esusuMetrics?.auditEvents || 0),
          detail: "Payout blockers, missed contributions, and reminder failures surface directly through the routed audit rail.",
          tone: criticalAudits > 0 || warningAudits > 0 ? "degraded" : "neutral",
        },
      ]}
      collectionTitle="Esusu workflow lanes"
      collectionSummary="Communal-savings operations focus"
      collectionItems={[
        {
          title: "Contribution-cycle supervision",
          subtitle: `${esusuActions.length || 0} routed operator actions`,
          state: esusuProduct?.status === "degraded" ? "warning" : "active",
          detail: "Keep missed-contribution remediation, agent follow-up, and payout-sequence checks visible inside the same operator shell as the other banking workflows.",
          chips: ["Collections", "Agent follow-up", "Payout gate"],
        },
        {
          title: "Reminder and outreach posture",
          subtitle: `${warningAudits} reminder-pressure signals`,
          state: warningAudits > 0 ? "warning" : "healthy",
          detail: "Reminder cadence, customer communication posture, and collection continuity should remain operator-visible instead of collapsing into generic service-health notes.",
          chips: ["SMS / WhatsApp", "Defaulter outreach", "Continuity"],
        },
        {
          title: "Group-health evidence",
          subtitle: `${esusuExports.length || 0} retained evidence packs`,
          state: esusuExports.length > 0 ? "active" : "review",
          detail: "Signed payout and defaulter review packages now stay attached to the routed esusu desk for downstream review and branch escalation.",
          chips: ["Group health", "Signed pack", "Escalation"],
        },
      ]}
      collectionEmpty="No esusu evidence has loaded yet. This routed workspace is ready to host contribution, reminder, and payout-control flows as the communal-savings domain deepens further."
      actionTitle="Esusu control rail"
      actionSummary="These controls keep rotating-savings supervision visible for branch and operations teams inside the shared banking shell."
      actionItems={[
        {
          title: "Contribution exception handling",
          detail: esusuActions[0]?.detail || "Keep missed-contribution remediation, payout gating, and group-rotation exceptions visible inside the routed esusu desk.",
          state: esusuActions[0]?.status || "review",
        },
        {
          title: "Reminder and communication posture",
          detail: esusuAudits[0]?.detail || "Reminder timing, outreach posture, and collection-continuity signals should remain operator-visible with explicit review posture rather than being implied in summary metrics.",
          state: warningAudits > 0 ? "warning" : "active",
        },
        {
          title: "Group payout coordination",
          detail: esusuActions[1]?.detail || "Branch and central teams should keep payout readiness and communal-savings evidence aligned inside the same routed workspace.",
          state: esusuActions[1]?.status || "active",
        },
      ]}
      actionEmpty="No esusu control actions are available yet. This workspace is in place to host them as deeper communal-savings APIs expand."
    />
  );
}
