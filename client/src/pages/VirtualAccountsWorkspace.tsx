import { useEffect, useMemo, useState } from "react";
import { Landmark } from "lucide-react";

import DomainWorkspace from "@/components/DomainWorkspace";
import {
  getPlatformOverview,
  getVirtualAccountsOverview,
  type DomainOverviewResponse,
  type OverviewResponse,
} from "@/lib/platform";

export default function VirtualAccountsWorkspace() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [domainOverview, setDomainOverview] = useState<DomainOverviewResponse | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      const [platformOverview, virtualAccountsOverview] = await Promise.all([
        getPlatformOverview(),
        getVirtualAccountsOverview(),
      ]);
      if (!active) {
        return;
      }
      setOverview(platformOverview);
      setDomainOverview(virtualAccountsOverview);
    })();

    return () => {
      active = false;
    };
  }, []);

  const products = overview?.products ?? [];
  const vanProduct = useMemo(() => products.find((product) => product.key === "virtual-accounts"), [products]);
  const relatedServices = vanProduct?.services ?? ["virtual-account-service", "payment-service", "ledger-service"];
  const vanMetrics = domainOverview?.metrics;
  const vanActions = domainOverview?.actions ?? [];
  const vanAudits = domainOverview?.audits ?? [];
  const vanExports = domainOverview?.exports ?? [];
  const criticalAudits = vanAudits.filter((item) => item.severity === "critical").length;
  const warningAudits = vanAudits.filter((item) => item.severity === "warning").length;

  return (
    <DomainWorkspace
      overview={overview}
      eyebrow="Dedicated and dynamic virtual account operations"
      title="Virtual account issuance, suspension, and settlement controls."
      summary="The virtual-accounts route deepens the last major overview-only payments domain so dedicated VAN supervision, dynamic account issuance, payment-allocation exceptions, and signed settlement evidence remain visible as first-class operational work instead of staying buried inside middleware references."
      serviceNames={["Customer service", ...relatedServices.map((service) => service.replace(/(^|-|\b)\w/g, (value) => value.toUpperCase()).replaceAll("-", " "))]}
      domainKey="virtual-accounts"
      domainRoute="/virtual-accounts"
      defaultRole="operations"
      allowedRoles={["operations", "branch"]}
      exportTitle="Virtual account control pack"
      exportFormat="json"
      heroIcon={Landmark}
      accentLabel="VAN management desk"
      metrics={[
        {
          label: "Surface status",
          value: vanProduct?.status ?? "unknown",
          detail: "Virtual-account servicing is now backed by a dedicated routed overview instead of remaining only an integration note.",
          tone: vanProduct?.status === "healthy" ? "healthy" : vanProduct?.status === "degraded" ? "degraded" : "neutral",
        },
        {
          label: "Open actions",
          value: String(vanMetrics?.openActions ?? vanActions.filter((item) => item.status !== "Done").length),
          detail: "Dedicated VAN suspension, dynamic issuance review, and inbound allocation exceptions stay visible for branch and central operators.",
          tone: (vanMetrics?.pendingActions ?? 0) > 0 ? "degraded" : "healthy",
        },
        {
          label: "Signed exports",
          value: String(vanMetrics?.signedExports ?? vanExports.filter((item) => item.approvalState === "Signed").length),
          detail: "Settlement, suspension, and exception packs now stay attached to the virtual-accounts desk through the shared evidence rail.",
          tone: vanExports.length > 0 ? "healthy" : "neutral",
        },
        {
          label: "Critical controls",
          value: String(criticalAudits || vanMetrics?.auditEvents || 0),
          detail: "Issuance blockers, settlement mismatches, and payment-allocation failures surface directly through the routed audit rail.",
          tone: criticalAudits > 0 || warningAudits > 0 ? "degraded" : "neutral",
        },
      ]}
      collectionTitle="Virtual-account workflow lanes"
      collectionSummary="Collections and settlement focus"
      collectionItems={[
        {
          title: "Dedicated VAN supervision",
          subtitle: `${vanActions.length || 0} routed operator actions`,
          state: vanProduct?.status === "degraded" ? "warning" : "active",
          detail: "Keep permanent account suspension, inbound collection monitoring, and settlement posture visible inside the same operator shell as the other banking workflows.",
          chips: ["Dedicated VAN", "Suspension", "Collections"],
        },
        {
          title: "Dynamic issuance and allocation",
          subtitle: `${warningAudits} issuance-pressure signals`,
          state: warningAudits > 0 ? "warning" : "healthy",
          detail: "Dynamic account creation, failed inbound payment retries, and merchant allocation posture should remain operator-visible instead of collapsing into generic payments notes.",
          chips: ["Dynamic VAN", "Allocation", "Merchant rails"],
        },
        {
          title: "Settlement evidence",
          subtitle: `${vanExports.length || 0} retained evidence packs`,
          state: vanExports.length > 0 ? "active" : "review",
          detail: "Signed settlement and suspension review packages now stay attached to the routed VAN desk for downstream review and branch escalation.",
          chips: ["Settlement", "Signed pack", "Escalation"],
        },
      ]}
      collectionEmpty="No virtual-account evidence has loaded yet. This routed workspace is ready to host issuance, allocation, and settlement-control flows as the VAN domain deepens further."
      actionTitle="Virtual-account control rail"
      actionSummary="These controls keep VAN issuance and settlement supervision visible for branch and operations teams inside the shared banking shell."
      actionItems={[
        {
          title: "Dedicated VAN exception handling",
          detail: vanActions[0]?.detail || "Keep dedicated account suspension, settlement holds, and downstream collection routing visible inside the routed virtual-accounts desk.",
          state: vanActions[0]?.status || "review",
        },
        {
          title: "Dynamic issuance posture",
          detail: vanAudits[0]?.detail || "Dynamic account creation and payment-allocation exceptions should remain operator-visible with explicit review posture rather than being implied in summary metrics.",
          state: warningAudits > 0 ? "warning" : "active",
        },
        {
          title: "Settlement and reconciliation coordination",
          detail: vanActions[1]?.detail || "Branch and central teams should keep settlement readiness and retained VAN evidence aligned inside the same routed workspace.",
          state: vanActions[1]?.status || "active",
        },
      ]}
      actionEmpty="No virtual-account control actions are available yet. This workspace is in place to host them as deeper VAN APIs expand."
    />
  );
}
