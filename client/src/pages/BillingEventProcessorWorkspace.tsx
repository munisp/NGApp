import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { Cpu } from "lucide-react";

const config: CrudConfig = {
  domainKey: "billing-event-processor",
  title: "Billing Event Processor",
  subtitle: "Real-time metering, Kafka event consumption, revenue capture, overhead allocation, and analytics pipeline",
  icon: Cpu,
  accentColor: "amber",
  fields: [],
  columns: [
    { key: "id", label: "Event ID", sortable: true },
    { key: "tenant_id", label: "Tenant", sortable: true },
    { key: "source_service", label: "Source", sortable: true },
    { key: "event_type", label: "Event Type", sortable: true },
    { key: "meter_key", label: "Meter Key", sortable: true },
    { key: "quantity", label: "Quantity", sortable: true },
    { key: "unit_amount", label: "Unit Amount", sortable: true },
    { key: "processing_status", label: "Status", sortable: true },
  ],
  tabs: [
    {
      key: "metering",
      label: "Metering Events",
      fetchUrl: "/api/platform/billing-events/v1/billing/events/metering",
      itemsPath: "items",
    },
    {
      key: "revenue",
      label: "Revenue Captures",
      fetchUrl: "/api/platform/billing-events/v1/billing/events/revenue-captures",
      itemsPath: "items",
      columns: [
        { key: "id", label: "ID", sortable: true },
        { key: "tenant_id", label: "Tenant", sortable: true },
        { key: "segment", label: "Segment", sortable: true },
        { key: "pricing_model", label: "Model", sortable: true },
        { key: "total_revenue", label: "Total Revenue", sortable: true },
        { key: "platform_share", label: "Platform Share", sortable: true },
        { key: "partner_share", label: "Partner Share", sortable: true },
        { key: "tigerbeetle_ledger", label: "TigerBeetle Ledger", sortable: false },
      ],
    },
    {
      key: "overhead",
      label: "Overhead Allocations",
      fetchUrl: "/api/platform/billing-events/v1/billing/events/overhead-allocations",
      itemsPath: "items",
      columns: [
        { key: "id", label: "ID", sortable: true },
        { key: "category", label: "Category", sortable: true },
        { key: "item", label: "Item", sortable: true },
        { key: "monthly_cost", label: "Monthly Cost", sortable: true },
        { key: "allocated_tenants", label: "Tenants", sortable: true },
        { key: "cost_per_tenant", label: "Cost/Tenant", sortable: true },
        { key: "adjustable", label: "Adjustable", sortable: true },
      ],
    },
    {
      key: "alerts",
      label: "Billing Alerts",
      fetchUrl: "/api/platform/billing-events/v1/billing/events/alerts",
      itemsPath: "items",
      columns: [
        { key: "id", label: "ID", sortable: true },
        { key: "tenant_id", label: "Tenant", sortable: true },
        { key: "alert_type", label: "Type", sortable: true },
        { key: "severity", label: "Severity", sortable: true },
        { key: "message", label: "Message", sortable: false },
        { key: "metric_value", label: "Value", sortable: true },
        { key: "threshold_value", label: "Threshold", sortable: true },
        { key: "acknowledged", label: "Ack'd", sortable: true },
      ],
    },
    {
      key: "pipelines",
      label: "Pipeline Status",
      fetchUrl: "/api/platform/billing-events/v1/billing/events/pipelines",
      itemsPath: "items",
      columns: [
        { key: "id", label: "ID", sortable: true },
        { key: "pipeline_name", label: "Pipeline", sortable: true },
        { key: "status", label: "Status", sortable: true },
        { key: "events_processed", label: "Processed", sortable: true },
        { key: "events_failed", label: "Failed", sortable: true },
        { key: "avg_latency_ms", label: "Avg Latency", sortable: true },
        { key: "kafka_lag", label: "Kafka Lag", sortable: true },
        { key: "temporal_workflow_id", label: "Temporal WF", sortable: false },
      ],
    },
  ],
};

export default function BillingEventProcessorWorkspace() {
  return <CrudWorkspace config={config} />;
}
