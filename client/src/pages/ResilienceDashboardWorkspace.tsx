import CrudWorkspace from "@/components/CrudWorkspace";

export default function ResilienceDashboardWorkspace() {
  return (
    <CrudWorkspace
      title="Resilience Dashboard"
      apiBase="/api/resilience/dashboard"
      columns={[{ key: "channel", label: "Channel" }, { key: "status", label: "Status" }, { key: "users", label: "Users" }, { key: "latency", label: "Latency" }]}
    />
  );
}
