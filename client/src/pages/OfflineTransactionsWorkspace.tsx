import CrudWorkspace from "@/components/CrudWorkspace";

export default function OfflineTransactionsWorkspace() {
  return (
    <CrudWorkspace
      title="Offline Transactions"
      apiBase="/api/resilience/offline/transactions"
      columns={[{ key: "id", label: "ID" }, { key: "type", label: "Type" }, { key: "amount", label: "Amount" }, { key: "status", label: "Status" }, { key: "deviceId", label: "Device" }, { key: "signatureValid", label: "Signed" }]}
    />
  );
}
