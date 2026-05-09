import { Building2 } from "lucide-react";
import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "branch-operations",
  title: "Branch Operations",
  subtitle: "Branch network management, ATM monitoring, cash positions, queue management",
  icon: Building2,
  accentColor: "bg-stone-600",
  idField: "id",
  statusField: "status",
  searchFields: ["id", "branchName", "branchCode", "region"],
  apiBase: "/api/platform/branches",
  fields: [
    { key: "branchName", label: "Branch Name", type: "text", required: true },
    { key: "branchCode", label: "Branch Code", type: "text", required: true },
    { key: "region", label: "Region", type: "select", options: ["Lagos", "Abuja", "Port Harcourt", "Kano", "Ibadan", "Enugu", "Kaduna", "Benin City"], required: true },
    { key: "address", label: "Address", type: "text" },
    { key: "managerName", label: "Manager", type: "text" },
    { key: "tellerCount", label: "Teller Positions", type: "number", defaultValue: 5 },
    { key: "atmCount", label: "ATM Count", type: "number", defaultValue: 2 },
  ],
  columns: [
    { key: "id", label: "ID" },
    { key: "branchName", label: "Branch" },
    { key: "branchCode", label: "Code" },
    { key: "region", label: "Region" },
    { key: "tellerCount", label: "Tellers" },
    { key: "atmCount", label: "ATMs" },
    { key: "queueDepth", label: "Queue" },
    { key: "status", label: "Status" },
  ],
  actions: [
    { label: "Open", key: "open", condition: (r) => r.status === "closed" },
    { label: "Close", key: "close", condition: (r) => r.status === "open" },
    { label: "Cash Position", key: "cash_position", condition: () => true },
  ],
};

export default function BranchOperationsWorkspace() {
  return <CrudWorkspace config={config} />;
}
