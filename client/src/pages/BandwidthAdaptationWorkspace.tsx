import CrudWorkspace from "@/components/CrudWorkspace";

export default function BandwidthAdaptationWorkspace() {
  return (
    <CrudWorkspace
      title="Bandwidth Adaptation"
      apiBase="/api/resilience/bandwidth/profiles"
      columns={[{ key: "id", label: "ID" }, { key: "connectionType", label: "Connection" }, { key: "estimatedKbps", label: "Kbps" }, { key: "strategy", label: "Strategy" }, { key: "compressionLevel", label: "Compression" }, { key: "payloadFormat", label: "Format" }]}
    />
  );
}
