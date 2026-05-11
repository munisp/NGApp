import CrudWorkspace from "@/components/CrudWorkspace";

export default function USSDBankingWorkspace() {
  return (
    <CrudWorkspace
      title="USSD Banking"
      apiBase="/api/resilience/ussd/sessions"
      columns={[{ key: "id", label: "ID" }, { key: "msisdn", label: "MSISDN" }, { key: "shortCode", label: "Short Code" }, { key: "menu", label: "Menu" }, { key: "language", label: "Language" }, { key: "status", label: "Status" }]}
    />
  );
}
