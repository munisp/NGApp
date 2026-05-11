import CrudWorkspace from "@/components/CrudWorkspace";

export default function SMSBankingWorkspace() {
  return (
    <CrudWorkspace
      title="SMS Banking"
      apiBase="/api/resilience/sms-banking/commands"
      columns={[{ key: "id", label: "ID" }, { key: "command", label: "Command" }, { key: "syntax", label: "Syntax" }, { key: "example", label: "Example" }, { key: "description", label: "Description" }]}
    />
  );
}
