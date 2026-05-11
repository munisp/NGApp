import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { CircuitBoard } from "lucide-react";

const config: CrudConfig = {
  domainKey: "billing-orchestrator",
  title: "Billing Orchestrator",
  subtitle: "Real-time billing capture, role-based access, audit trail, tenant onboarding billing setup with Kafka/Permify/TigerBeetle",
  icon: CircuitBoard,
  accentColor: "green",
  fields: [],
  columns: [
    { key: "id", label: "Profile ID", sortable: true },
    { key: "tenantId", label: "Tenant", sortable: true },
    { key: "pricingModel", label: "Pricing Model", sortable: true },
    { key: "segment", label: "Segment", sortable: true },
    { key: "signOnFee", label: "Sign-On Fee", sortable: true },
    { key: "monthlyFee", label: "Monthly Fee", sortable: true },
    { key: "feePerTxn", label: "Fee/Txn", sortable: true },
    { key: "platformSharePct", label: "Platform %", sortable: true },
    { key: "status", label: "Status", sortable: true },
  ],
  tabs: [
    {
      key: "profiles",
      label: "Billing Profiles",
      fetchUrl: "/api/platform/billing-orchestrator/v1/billing/profiles",
      itemsPath: "items",
    },
    {
      key: "audit",
      label: "Audit Log",
      fetchUrl: "/api/platform/billing-orchestrator/v1/billing/audit",
      itemsPath: "items",
      columns: [
        { key: "id", label: "ID", sortable: true },
        { key: "tenantId", label: "Tenant", sortable: true },
        { key: "actorRole", label: "Actor Role", sortable: true },
        { key: "action", label: "Action", sortable: true },
        { key: "resource", label: "Resource", sortable: true },
        { key: "kafkaTopic", label: "Kafka Topic", sortable: false },
        { key: "notified", label: "Notified", sortable: true },
        { key: "timestamp", label: "Timestamp", sortable: true },
      ],
    },
    {
      key: "metrics",
      label: "Realtime Metrics",
      fetchUrl: "/api/platform/billing-orchestrator/v1/billing/realtime-metrics",
      itemsPath: "items",
      columns: [
        { key: "id", label: "ID", sortable: true },
        { key: "tenantId", label: "Tenant", sortable: true },
        { key: "metricType", label: "Metric Type", sortable: true },
        { key: "meterKey", label: "Meter Key", sortable: true },
        { key: "value", label: "Value", sortable: true },
        { key: "source", label: "Source", sortable: true },
        { key: "daprBinding", label: "Dapr Binding", sortable: false },
      ],
    },
    {
      key: "onboarding",
      label: "Onboarding Jobs",
      fetchUrl: "/api/platform/billing-orchestrator/v1/billing/onboarding",
      itemsPath: "items",
      columns: [
        { key: "id", label: "ID", sortable: true },
        { key: "tenantId", label: "Tenant", sortable: true },
        { key: "segment", label: "Segment", sortable: true },
        { key: "status", label: "Status", sortable: true },
        { key: "currentStep", label: "Step", sortable: true },
        { key: "temporalWorkflowId", label: "Temporal Workflow", sortable: false },
      ],
    },
    {
      key: "roles",
      label: "Roles & Permissions",
      fetchUrl: "/api/platform/billing-orchestrator/v1/billing/roles",
      itemsPath: "items",
      columns: [
        { key: "role", label: "Role", sortable: true },
        { key: "description", label: "Description", sortable: false },
        { key: "permissions", label: "Permissions", sortable: false },
      ],
    },
    {
      key: "splits",
      label: "Transaction Splits",
      fetchUrl: "/api/platform/billing-orchestrator/v1/billing/transaction-splits",
      itemsPath: "items",
      columns: [
        { key: "id", label: "ID", sortable: true },
        { key: "tenantId", label: "Tenant", sortable: true },
        { key: "txnType", label: "Txn Type", sortable: true },
        { key: "platformAmount", label: "Platform", sortable: true },
        { key: "partnerAmount", label: "Partner", sortable: true },
        { key: "superAgentAmount", label: "Super Agent", sortable: true },
        { key: "totalAmount", label: "Total", sortable: true },
        { key: "tigerBeetleTxnId", label: "TigerBeetle Txn", sortable: false },
      ],
    },
  ],
};

export default function BillingOrchestratorWorkspace() {
  return <CrudWorkspace config={config} />;
}
