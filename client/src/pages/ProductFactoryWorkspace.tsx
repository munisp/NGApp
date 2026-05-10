import { Layers } from "lucide-react";
import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "product-factory",
  title: "Product Factory",
  subtitle: "Parameterized product configuration — create new products without code changes",
  icon: Layers,
  accentColor: "violet",
  fields: [
    { key: "id", label: "Product ID", type: "readonly" },
    { key: "name", label: "Product Name", type: "text", required: true },
    { key: "productType", label: "Type", type: "select", options: ["savings", "fixed-deposit", "loan", "current", "domiciliary", "islamic"] },
    { key: "category", label: "Category", type: "text" },
    { key: "currency", label: "Currency", type: "select", options: ["NGN", "USD", "GBP", "EUR"] },
  ],
  columns: [
    { key: "id", label: "Product ID" },
    { key: "name", label: "Product Name" },
    { key: "productType", label: "Type" },
    { key: "category", label: "Category" },
    { key: "currency", label: "Currency" },
    { key: "status", label: "Status" },
    { key: "version", label: "Version" },
  ],
  idField: "id",
  searchFields: ["id", "name", "productType"],
  apiBase: "/api/platform/products/catalog",
};

export default function ProductFactoryWorkspace() {
  return <CrudWorkspace config={config} />;
}
