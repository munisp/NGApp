import CrudWorkspace from "@/components/CrudWorkspace";
import { FileText } from "lucide-react";

export default function AuditTrailWorkspace() {
  return (
    <CrudWorkspace
      config={{
        domainKey: "audit-trail",
        title: "Audit Trail",
        subtitle: "Immutable event log — all system actions with actor, resource, result, and risk level",
        icon: FileText,
        accentColor: "text-slate-600",
        idField: "id",
        statusField: "result",
        searchFields: ["id", "actor", "action", "resource", "resourceId", "channel"],
        apiBase: "/api/platform/audit/entries",
        pageSize: 25,
        columns: [
          { key: "id", label: "ID" },
          { key: "timestamp", label: "Timestamp", sortable: true },
          { key: "actor", label: "Actor", sortable: true },
          { key: "actorType", label: "Type" },
          { key: "action", label: "Action", sortable: true },
          { key: "resource", label: "Resource" },
          { key: "channel", label: "Channel" },
          { key: "result", label: "Result", sortable: true },
          { key: "riskLevel", label: "Risk", sortable: true },
        ],
        fields: [],
      }}
    />
  );
}
