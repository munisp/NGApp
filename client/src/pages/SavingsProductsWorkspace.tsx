import { PiggyBank } from "lucide-react";
import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "savings-products",
  title: "Savings Accounts",
  subtitle: "Fixed deposits, target savings, joint accounts, children's savings, flexi savings",
  icon: PiggyBank,
  accentColor: "bg-emerald-600",
  idField: "id",
  statusField: "status",
  searchFields: ["id", "customerId", "accountName", "accountType"],
  apiBase: "/api/platform/savings/accounts",
  fields: [
    { key: "customerId", label: "Customer ID", type: "text", required: true },
    { key: "accountType", label: "Account Type", type: "select", options: ["fixed_deposit", "target_savings", "joint", "children", "flexi"], required: true },
    { key: "accountName", label: "Account Name", type: "text", required: true, placeholder: "e.g. My Target Savings" },
    { key: "targetAmount", label: "Target Amount (₦)", type: "number" },
    { key: "tenorDays", label: "Tenor (Days)", type: "number", placeholder: "For fixed deposits" },
    { key: "guardianId", label: "Guardian ID", type: "text", placeholder: "For children accounts" },
  ],
  columns: [
    { key: "id", label: "Account ID" },
    { key: "accountType", label: "Type", render: (v) => String(v).replace(/_/g, " ") },
    { key: "accountName", label: "Name" },
    { key: "balance", label: "Balance", render: (v) => `₦${Number(v).toLocaleString()}` },
    { key: "interestRate", label: "Rate", render: (v) => `${v}%` },
    { key: "status", label: "Status" },
  ],
  actions: [
    { label: "Deposit", key: "deposit", condition: (r) => r.status === "active" },
    { label: "Withdraw", key: "withdraw", condition: (r) => r.status === "active" && r.accountType !== "fixed_deposit" },
    { label: "Close", key: "close", condition: (r) => Number(r.balance) === 0 },
  ],
};

export default function SavingsProductsWorkspace() {
  return <CrudWorkspace config={config} />;
}
