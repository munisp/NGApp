import { CheckSquare } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "maker-checker",
  title: "Maker-Checker Approvals",
  subtitle: "Dual-authorization workflow — every sensitive operation needs maker + checker approval",
  icon: CheckSquare,
  accentColor: "amber",
  fields: [
    { key: "id", label: "Request ID", type: "readonly" },
    { key: "operation", label: "Operation", type: "readonly" },
    { key: "status", label: "Status", type: "readonly" },
  ],
  columns: [
    { key: "id", label: "Request ID" },
    { key: "operation", label: "Operation" },
    { key: "entity", label: "Entity" },
    { key: "status", label: "Status" },
    { key: "makerName", label: "Maker" },
    { key: "checkerName", label: "Checker" },
    { key: "riskScore", label: "Risk Score" },
  ],
  idField: "id",
  searchFields: ["id", "operation", "status"],
  apiBase: "/api/platform/approvals/requests",
};

export default function MakerCheckerWorkspace() {
  return <CrudWorkspace config={config} />;
}
