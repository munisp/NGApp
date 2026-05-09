import { useEffect, useMemo, useState } from "react";
import { GraduationCap } from "lucide-react";

import DomainWorkspace from "@/components/DomainWorkspace";
import {
  getEducationLoansOverview,
  getPlatformOverview,
  type DomainOverviewResponse,
  type OverviewResponse,
} from "@/lib/platform";

export default function EducationLoansWorkspace() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [domainOverview, setDomainOverview] = useState<DomainOverviewResponse | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      const [platformOverview, educationLoansOverview] = await Promise.all([
        getPlatformOverview(),
        getEducationLoansOverview(),
      ]);
      if (!active) {
        return;
      }
      setOverview(platformOverview);
      setDomainOverview(educationLoansOverview);
    })();

    return () => {
      active = false;
    };
  }, []);

  const products = overview?.products ?? [];
  const educationProduct = useMemo(() => products.find((product) => product.key === "education-loans"), [products]);
  const relatedServices = educationProduct?.services ?? ["education-loan-service", "document-service", "collections-service"];
  const educationMetrics = domainOverview?.metrics;
  const educationActions = domainOverview?.actions ?? [];
  const educationAudits = domainOverview?.audits ?? [];
  const educationExports = domainOverview?.exports ?? [];
  const blockedAudits = educationAudits.filter((item) => item.severity === "critical").length;

  return (
    <DomainWorkspace
      overview={overview}
      eyebrow="School-fee and student-finance operations"
      title="Education-loan intake, guarantor controls, and delinquency intervention."
      summary="The education-loan route brings another still-thin lending domain into the shared operating shell so guarantor review, admission-document remediation, school-fee disbursement controls, and signed exception evidence are visible as first-class workflow work instead of remaining implied in platform notes."
      serviceNames={["Customer service", ...relatedServices.map((service) => service.replace(/(^|-|\b)\w/g, (value) => value.toUpperCase()).replaceAll("-", " "))]}
      domainKey="education-loans"
      domainRoute="/education-loans"
      defaultRole="operations"
      allowedRoles={["operations", "branch"]}
      exportTitle="Education-loan control pack"
      heroIcon={GraduationCap}
      accentLabel="Student-finance desk"
      metrics={[
        {
          label: "Surface status",
          value: educationProduct?.status ?? "unknown",
          detail: "Education-loan servicing is now backed by a dedicated routed overview instead of remaining only an integration note.",
          tone: educationProduct?.status === "healthy" ? "healthy" : educationProduct?.status === "degraded" ? "degraded" : "neutral",
        },
        {
          label: "Open actions",
          value: String(educationMetrics?.openActions ?? educationActions.filter((item) => item.status !== "Done").length),
          detail: "Operator actions stay visible for guarantor review, school-fee disbursement gating, and delinquency follow-through.",
          tone: (educationMetrics?.pendingActions ?? 0) > 0 ? "degraded" : "healthy",
        },
        {
          label: "Signed exports",
          value: String(educationMetrics?.signedExports ?? educationExports.filter((item) => item.approvalState === "Signed").length),
          detail: "Admission, guarantor, and disbursement exception packs are retained through the same export rail used by the hardened domains.",
          tone: educationExports.length > 0 ? "healthy" : "neutral",
        },
        {
          label: "Critical controls",
          value: String(blockedAudits || educationMetrics?.auditEvents || 0),
          detail: "Guarantor, admission, and fee-disbursement blockers now surface directly through the audit rail for routed education-finance review.",
          tone: blockedAudits > 0 ? "degraded" : "neutral",
        },
      ]}
      collectionTitle="Education-loan workflow lanes"
      collectionSummary="Student-finance and collections focus"
      collectionItems={[
        {
          title: "Guarantor readiness",
          subtitle: `${educationActions.length || 0} routed operator actions`,
          state: educationProduct?.status === "degraded" ? "warning" : "active",
          detail: "Keep guarantor verification, admission-letter refresh, and school-fee release posture visible in the same operator shell as the other banking workflows.",
          chips: ["Guarantor", "Admission", "Release gate"],
        },
        {
          title: "Disbursement controls",
          subtitle: `${blockedAudits} critical control signals`,
          state: blockedAudits > 0 ? "warning" : "healthy",
          detail: "School-fee remittance blockers, guarantor exceptions, and branch follow-through remain operator-visible instead of collapsing into generic notes.",
          chips: ["School fees", "Branch desk", "Exception review"],
        },
        {
          title: "Delinquency intervention",
          subtitle: `${educationExports.length || 0} retained evidence packs`,
          state: educationExports.length > 0 ? "active" : "review",
          detail: "Guardian outreach, rescheduling posture, and signed student-finance documentation stay attached to the education-loan route for downstream review.",
          chips: ["Guardian outreach", "Rescheduling", "Evidence"],
        },
      ]}
      collectionEmpty="No education-loan evidence has loaded yet. This routed workspace is ready to host guarantor, disbursement, and delinquency-control flows as the domain deepens further."
      actionTitle="Education-loan control rail"
      actionSummary="These controls keep student-finance work visible for branch and central operations teams inside the shared banking shell."
      actionItems={[
        {
          title: "Guarantor exception handling",
          detail: educationActions[0]?.detail || "Keep guarantor remediation, admission-pack follow-through, and fee-disbursement gating visible inside the routed education-loan desk.",
          state: educationActions[0]?.status || "review",
        },
        {
          title: "Admission and document posture",
          detail: educationAudits[0]?.detail || "Admission and guarantor exceptions should remain operator-visible with explicit review posture rather than being implied in summary metrics.",
          state: blockedAudits > 0 ? "warning" : "active",
        },
        {
          title: "Repayment and rollover coordination",
          detail: educationActions[1]?.detail || "Collections follow-through and repayment-support posture should stay connected to the same route as the active student-finance portfolio view.",
          state: educationActions[1]?.status || "active",
        },
      ]}
      actionEmpty="No education-loan control actions are available yet. This workspace is in place to host them as deeper education-finance APIs expand."
    />
  );
}
