import { useEffect, useMemo, useState } from "react";
import { Building2 } from "lucide-react";

import DomainWorkspace from "@/components/DomainWorkspace";
import {
  getMortgageOverview,
  getPlatformOverview,
  type DomainOverviewResponse,
  type OverviewResponse,
} from "@/lib/platform";

export default function MortgageWorkspace() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [domainOverview, setDomainOverview] = useState<DomainOverviewResponse | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      const [platformOverview, mortgageOverview] = await Promise.all([getPlatformOverview(), getMortgageOverview()]);
      if (!active) {
        return;
      }
      setOverview(platformOverview);
      setDomainOverview(mortgageOverview);
    })();

    return () => {
      active = false;
    };
  }, []);

  const products = overview?.products ?? [];
  const mortgageProduct = useMemo(() => products.find((product) => product.key === "mortgage-servicing"), [products]);
  const relatedServices = mortgageProduct?.services ?? ["mortgage-service", "document-service", "compliance-service"];
  const mortgageMetrics = domainOverview?.metrics;
  const mortgageActions = domainOverview?.actions ?? [];
  const mortgageAudits = domainOverview?.audits ?? [];
  const mortgageExports = domainOverview?.exports ?? [];
  const blockedAudits = mortgageAudits.filter((item) => item.severity === "critical").length;

  return (
    <DomainWorkspace
      overview={overview}
      eyebrow="Property-backed lending operations"
      title="Mortgage origination, collateral controls, and arrears intervention."
      summary="The mortgage route brings a previously thin domain into the shared operating shell so underwriting, title-document remediation, repayment-risk outreach, and signed exception evidence are visible as first-class workflow work instead of remaining implied in platform notes."
      serviceNames={["Customer service", ...relatedServices.map((service) => service.replace(/(^|-|\b)\w/g, (value) => value.toUpperCase()).replaceAll("-", " "))]}
      domainKey="mortgage-servicing"
      domainRoute="/mortgage"
      defaultRole="operations"
      allowedRoles={["operations", "branch"]}
      exportTitle="Mortgage control pack"
      heroIcon={Building2}
      accentLabel="Secured lending desk"
      metrics={[
        {
          label: "Surface status",
          value: mortgageProduct?.status ?? "unknown",
          detail: "Mortgage servicing is now backed by a dedicated routed overview instead of remaining a catalog-only note.",
          tone: mortgageProduct?.status === "healthy" ? "healthy" : mortgageProduct?.status === "degraded" ? "degraded" : "neutral",
        },
        {
          label: "Open actions",
          value: String(mortgageMetrics?.openActions ?? mortgageActions.filter((item) => item.status !== "Done").length),
          detail: "Mortgage operator actions stay visible for underwriting, legal-perfection, and collections intervention work.",
          tone: (mortgageMetrics?.pendingActions ?? 0) > 0 ? "degraded" : "healthy",
        },
        {
          label: "Signed exports",
          value: String(mortgageMetrics?.signedExports ?? mortgageExports.filter((item) => item.approvalState === "Signed").length),
          detail: "Underwriting and collateral evidence packs are retained through the same export rail used by other hardened domains.",
          tone: mortgageExports.length > 0 ? "healthy" : "neutral",
        },
        {
          label: "Critical controls",
          value: String(blockedAudits || mortgageMetrics?.auditEvents || 0),
          detail: "Legal-perfection and underwriting exceptions now surface directly through the audit rail for routed mortgage review.",
          tone: blockedAudits > 0 ? "degraded" : "neutral",
        },
      ]}
      collectionTitle="Mortgage workflow lanes"
      collectionSummary="Origination and servicing focus"
      collectionItems={[
        {
          title: "Underwriting readiness",
          subtitle: `${mortgageActions.length || 0} routed operator actions`,
          state: mortgageProduct?.status === "degraded" ? "warning" : "active",
          detail: "Keep affordability review, valuation variance handling, and offer-issuance posture visible in the same operator shell as other banking workflows.",
          chips: ["Valuation", "Affordability", "Offer issuance"],
        },
        {
          title: "Collateral perfection",
          subtitle: `${blockedAudits} critical control signals`,
          state: blockedAudits > 0 ? "warning" : "healthy",
          detail: "Title-document exceptions, legal-perfection blockers, and branch follow-through remain operator-visible instead of collapsing into generic backlog notes.",
          chips: ["Title review", "Legal desk", "Disbursement gate"],
        },
        {
          title: "Arrears intervention",
          subtitle: `${mortgageExports.length || 0} retained evidence packs`,
          state: mortgageExports.length > 0 ? "active" : "review",
          detail: "Collections outreach, restructuring posture, and signed exception documentation stay attached to the mortgage route for downstream review.",
          chips: ["Collections", "Restructuring", "Evidence"],
        },
      ]}
      collectionEmpty="No mortgage servicing evidence has loaded yet. This routed workspace is ready to host underwriting, collateral, and repayment-control flows as the domain deepens further."
      actionTitle="Mortgage control rail"
      actionSummary="These controls keep property-backed lending work visible for branch and central operations teams inside the shared banking shell."
      actionItems={[
        {
          title: "Collateral exception handling",
          detail: mortgageActions[0]?.detail || "Keep title remediation, legal-pack follow-through, and disbursement gating visible inside the routed mortgage desk.",
          state: mortgageActions[0]?.status || "review",
        },
        {
          title: "Affordability review posture",
          detail: mortgageAudits[0]?.detail || "Underwriting exceptions should remain operator-visible with explicit review posture rather than being implied in summary metrics.",
          state: blockedAudits > 0 ? "warning" : "active",
        },
        {
          title: "Arrears outreach coordination",
          detail: mortgageActions[1]?.detail || "Collections follow-through and restructuring posture should stay connected to the same route as the active mortgage portfolio view.",
          state: mortgageActions[1]?.status || "active",
        },
      ]}
      actionEmpty="No mortgage control actions are available yet. This workspace is in place to host them as deeper mortgage APIs expand."
    />
  );
}
