import CrudWorkspace from "@/components/CrudWorkspace";
import { Shield } from "lucide-react";

export default function EscrowWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "escrow",
        title: "Escrow",
        subtitle: "Property, M&A, trade, litigation escrow accounts (Go :8186)",
        icon: Shield,
        accentColor: "text-blue-800",
        idField: "id",
        statusField: "status",
        searchFields: ["buyer", "seller", "escrow_type"],
        apiBase: "/api/platform/escrow/list",
        pageSize: 25,
        columns: [
          { key: "id", label: "Escrow ID" },
          { key: "escrow_type", label: "Type", sortable: true },
          { key: "buyer", label: "Buyer", sortable: true },
          { key: "seller", label: "Seller", sortable: true },
          { key: "amount", label: "Amount", sortable: true, render: (v) => `₦${Number(v).toLocaleString()}` },
          { key: "condition", label: "Condition" },
          { key: "status", label: "Status", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
