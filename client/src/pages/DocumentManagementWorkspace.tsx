import CrudWorkspace from "@/components/CrudWorkspace";
import { FolderOpen } from "lucide-react";

export default function DocumentManagementWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "document-management",
        title: "Document Management",
        subtitle: "KYC files, loan docs, compliance records — versioning, expiry tracking (Python :8152)",
        icon: FolderOpen,
        accentColor: "text-amber-700",
        idField: "id",
        statusField: "status",
        searchFields: ["customer_name", "title", "category", "doc_type"],
        apiBase: "/api/platform/documents/v1/documents",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "customer_name", label: "Customer", sortable: true },
          { key: "category", label: "Category", sortable: true },
          { key: "doc_type", label: "Type" },
          { key: "title", label: "Title" },
          { key: "file_name", label: "File" },
          { key: "file_size_bytes", label: "Size", render: (v) => `${(Number(v)/1000).toFixed(0)}KB` },
          { key: "version", label: "Ver" },
          { key: "verified", label: "Verified", render: (v) => v ? "Yes" : "No" },
          { key: "status", label: "Status", sortable: true },
          { key: "expires_at", label: "Expires" },
        ],
        fields: [],
      }}
    />
  );
}
