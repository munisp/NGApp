import CrudWorkspace from "@/components/CrudWorkspace";
import { Users } from "lucide-react";

export default function Customer360Workspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "customer-360",
        title: "Customer 360",
        subtitle: "Unified customer view — accounts, cards, loans, transactions, disputes, engagement, KYC, and risk",
        icon: Users,
        accentColor: "text-indigo-600",
        idField: "customerId",
        statusField: "status",
        searchFields: ["name", "email", "phone", "segment", "location"],
        apiBase: "/api/platform/customer-360/profiles",
        pageSize: 25,
        columns: [
          { key: "name", label: "Name", sortable: true },
          { key: "segment", label: "Segment", sortable: true },
          { key: "tier", label: "Tier" },
          { key: "riskBand", label: "Risk" },
          { key: "totalRelationshipValue", label: "Relationship Value", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "engagementScore", label: "Engagement", sortable: true, render: (v) => `${v}/100` },
          { key: "kycLevel", label: "KYC Level" },
          { key: "status", label: "Status" },
        ],
        fields: [
          { key: "name", label: "Full Name", type: "text", required: true },
          { key: "email", label: "Email", type: "text", required: true },
          { key: "phone", label: "Phone", type: "text", required: true },
          { key: "segment", label: "Segment", type: "select", options: ["Retail", "Corporate", "Trade", "Agriculture", "Public sector"], required: true },
          { key: "tier", label: "Tier", type: "select", options: ["Tier 1", "Tier 2", "Tier 3"], required: true },
          { key: "riskBand", label: "Risk Band", type: "select", options: ["Low", "Medium", "High"] },
        ],
      }}
    />
  );
}
