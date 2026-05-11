import CrudWorkspace from "@/components/CrudWorkspace";

export default function RansomwareProtectionWorkspace() {
  return (
    <CrudWorkspace
      title="Ransomware Protection"
      apiBase="/api/security/ransomware/indicators"
      columns={[{ key: "id", label: "ID" }, { key: "pattern", label: "Pattern" }, { key: "type", label: "Type" }, { key: "severity", label: "Severity" }, { key: "action", label: "Action" }]}
    />
  );
}
