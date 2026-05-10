import CrudWorkspace from "@/components/CrudWorkspace";
import { FileText } from "lucide-react";

export default function RegulatoryReportingWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "regulatory-reporting",
        title: "Regulatory Reporting",
        subtitle: "CBN eFASS, NDIC, FIRS VAT, CTR, Basel III, IFRS 9 ECL (Python :8146)",
        icon: FileText,
        accentColor: "text-amber-800",
        idField: "id",
        statusField: "status",
        searchFields: ["name", "regulator", "report_type", "period"],
        apiBase: "/api/platform/regulatory-reporting/v1/regulatory/reports",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "name", label: "Report", sortable: true },
          { key: "regulator", label: "Regulator", sortable: true },
          { key: "frequency", label: "Freq" },
          { key: "period", label: "Period", sortable: true },
          { key: "status", label: "Status", sortable: true },
          { key: "due_date", label: "Due", sortable: true },
          { key: "submitted_date", label: "Submitted" },
          { key: "data_points", label: "Data Points", sortable: true },
          { key: "validation_errors", label: "Errors" },
          { key: "file_format", label: "Format" },
        ],
        fields: [],
      }}
    />
  );
}
