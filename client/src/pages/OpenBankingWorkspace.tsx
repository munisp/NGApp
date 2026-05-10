import CrudWorkspace from "@/components/CrudWorkspace";
import { Globe } from "lucide-react";

export default function OpenBankingWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "open-banking",
        title: "Open Banking",
        subtitle: "Consent management, TPP registration, API catalog, PSD2/CBN compliance (Go :8165)",
        icon: Globe,
        accentColor: "text-teal-600",
        idField: "id",
        statusField: "status",
        searchFields: ["tpp_name", "consent_type", "customer_id"],
        apiBase: "/api/platform/open-banking/consents",
        pageSize: 25,
        columns: [
          { key: "id", label: "Consent ID" },
          { key: "tpp_name", label: "TPP Name", sortable: true },
          { key: "consent_type", label: "Type", sortable: true },
          { key: "customer_id", label: "Customer", sortable: true },
          { key: "permissions", label: "Permissions" },
          { key: "granted_at", label: "Granted", sortable: true },
          { key: "expires_at", label: "Expires", sortable: true },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
