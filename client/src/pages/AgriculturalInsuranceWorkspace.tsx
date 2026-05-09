import { useEffect, useMemo, useState } from "react";
import { Sprout } from "lucide-react";

import DomainWorkspace from "@/components/DomainWorkspace";
import {
  getAgriculturalInsuranceOverview,
  getPlatformOverview,
  type DomainOverviewResponse,
  type OverviewResponse,
} from "@/lib/platform";

export default function AgriculturalInsuranceWorkspace() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [domainOverview, setDomainOverview] = useState<DomainOverviewResponse | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      const [platformOverview, insuranceOverview] = await Promise.all([getPlatformOverview(), getAgriculturalInsuranceOverview()]);
      if (active) {
        setOverview(platformOverview);
        setDomainOverview(insuranceOverview);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const products = overview?.products ?? [];
  const insuranceProduct = useMemo(() => products.find((product) => product.key === "agricultural-insurance"), [products]);
  const relatedServices = insuranceProduct?.services ?? ["agricultural-insurance-service", "insurance-service", "compliance-service"];
  const insuranceMetrics = domainOverview?.metrics;
  const insuranceActions = domainOverview?.actions ?? [];
  const insuranceAudits = domainOverview?.audits ?? [];
  const insuranceExports = domainOverview?.exports ?? [];

  return (
    <DomainWorkspace
      overview={overview}
      eyebrow="Agricultural resilience"
      title="Agricultural insurance, weather-response coverage, and rural risk controls."
      summary="This workspace keeps micro-insurance, weather-triggered policy administration, and field-operations visibility inside the same routed platform shell so agricultural programs are no longer hidden behind generic onboarding or lending surfaces."
      serviceNames={relatedServices.map((service) => service.replace(/(^|-)\w/g, (value) => value.toUpperCase()).replaceAll("-", " "))}
      domainKey="agricultural-insurance"
      domainRoute="/agricultural-insurance"
      defaultRole="operations"
      allowedRoles={["operations", "branch"]}
      exportTitle="Agricultural insurance field controls"
      heroIcon={Sprout}
      accentLabel="Field protection"
      metrics={[
        {
          label: "Surface status",
          value: insuranceProduct?.status ?? "unknown",
          detail: "The agricultural insurance route now receives its own backend overview payload instead of relying only on the shell-level product summary.",
          tone: insuranceProduct?.status === "healthy" ? "healthy" : insuranceProduct?.status === "degraded" ? "degraded" : "neutral",
        },
        {
          label: "Open actions",
          value: String(insuranceMetrics?.openActions ?? insuranceActions.filter((item) => item.status !== "Done").length),
          detail: "Field operations now expose backend-derived action volume for claims review, partner coordination, and trigger monitoring.",
          tone: (insuranceMetrics?.pendingActions ?? 0) > 0 ? "degraded" : "healthy",
        },
        {
          label: "Signed exports",
          value: String(insuranceMetrics?.signedExports ?? insuranceExports.filter((item) => item.approvalState === "Signed").length),
          detail: "Insurance evidence packs and retained compliance exports are now visible through the dedicated agricultural-insurance endpoint.",
          tone: "neutral",
        },
        {
          label: "Audit events",
          value: String(insuranceMetrics?.auditEvents ?? insuranceAudits.length),
          detail: "Recent field and claims evidence is counted directly from the domain payload.",
          tone: insuranceAudits.length > 0 ? "healthy" : "neutral",
        },
      ]}
      collectionTitle="Program lanes"
      collectionSummary="Policy and claims visibility"
      collectionItems={[
        {
          title: "Parametric crop protection",
          subtitle: `${insuranceActions.length || 0} routed operator actions`,
          state: insuranceProduct?.status === "degraded" ? "warning" : "active",
          detail: "Represent weather-indexed policy monitoring and program administration as a first-class platform surface for rural finance operations.",
          chips: ["Weather trigger", "Claims", "Policy"],
        },
        {
          title: "Livestock and equipment cover",
          subtitle: `${insuranceMetrics?.pendingActions ?? 0} pending escalations`,
          state: (insuranceMetrics?.pendingActions ?? 0) > 0 ? "warning" : "review",
          detail: "Keep field-asset protection visible alongside financing and collections so rural operators see risk posture in one place.",
          chips: ["Livestock", "Equipment", "Field review"],
        },
        {
          title: "Claims and remediation",
          subtitle: `${insuranceExports.length || 0} export artifacts`,
          state: insuranceExports.length > 0 ? "active" : "review",
          detail: "The route now surfaces retained evidence and review outputs from the agricultural-insurance overview payload itself.",
          chips: ["Claims", "Audit", "Operations"],
        },
      ]}
      collectionEmpty="No agricultural insurance records have loaded yet. This route is ready to host live policy, trigger, and claims data as the service surfaces deepen."
      actionTitle="Field operations controls"
      actionSummary="Agricultural programs need clear operator controls around policy triggers, partner remediation, and customer communication even before all CRUD endpoints are exposed."
      actionItems={[
        {
          title: insuranceActions[0]?.title || "Weather-trigger review",
          detail: insuranceActions[0]?.detail || "Keep policy-trigger evaluation reachable for operations teams when satellite, weather, or partner feeds fluctuate.",
          state: insuranceActions[0]?.status || "active",
        },
        {
          title: insuranceActions[1]?.title || "Claim adjudication posture",
          detail: insuranceActions[1]?.detail || "Claims should appear as visible control items rather than hidden side effects of backend processing.",
          state: insuranceActions[1]?.status || "review",
        },
        {
          title: insuranceActions[2]?.title || "Farmer communication readiness",
          detail: insuranceActions[2]?.detail || "The shared shell should keep communications and program transparency reachable across web and mobile surfaces.",
          state: insuranceActions[2]?.status || "warning",
        },
      ]}
      actionEmpty="No agricultural operations controls have loaded yet. This workspace is prepared to host them as service contracts are expanded."
    />
  );
}
