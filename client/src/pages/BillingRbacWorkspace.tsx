import CrudWorkspace from "@/components/CrudWorkspace";
import type { CrudConfig } from "@/components/CrudWorkspace";
import { ShieldPlus } from "lucide-react";

const config: CrudConfig = {
  domainKey: "billing-rbac",
  title: "Billing RBAC Gateway",
  subtitle: "Permify/Keycloak permission enforcement, policy rules, access decisions, change notifications",
  icon: ShieldPlus,
  accentColor: "purple",
  fields: [],
  columns: [
    { key: "id", label: "Policy ID", sortable: true },
    { key: "resource", label: "Resource", sortable: true },
    { key: "action", label: "Action", sortable: true },
    { key: "allowedRoles", label: "Allowed Roles", sortable: false },
    { key: "enforcementMode", label: "Mode", sortable: true },
    { key: "permifyRelation", label: "Permify Relation", sortable: false },
    { key: "keycloakScope", label: "Keycloak Scope", sortable: false },
  ],
  tabs: [
    {
      key: "policies",
      label: "Policy Rules",
      fetchUrl: "/api/platform/billing-rbac/v1/billing/rbac/policies",
      itemsPath: "items",
    },
    {
      key: "decisions",
      label: "Access Decisions",
      fetchUrl: "/api/platform/billing-rbac/v1/billing/rbac/decisions",
      itemsPath: "items",
      columns: [
        { key: "id", label: "ID", sortable: true },
        { key: "actorRole", label: "Actor Role", sortable: true },
        { key: "resource", label: "Resource", sortable: true },
        { key: "action", label: "Action", sortable: true },
        { key: "decision", label: "Decision", sortable: true },
        { key: "reason", label: "Reason", sortable: false },
        { key: "permifyCheck", label: "Permify", sortable: true },
        { key: "keycloakValidated", label: "Keycloak", sortable: true },
        { key: "latencyMs", label: "Latency (ms)", sortable: true },
      ],
    },
    {
      key: "notifications",
      label: "Change Notifications",
      fetchUrl: "/api/platform/billing-rbac/v1/billing/rbac/notifications",
      itemsPath: "items",
      columns: [
        { key: "id", label: "ID", sortable: true },
        { key: "tenantId", label: "Tenant", sortable: true },
        { key: "changeType", label: "Change Type", sortable: true },
        { key: "resource", label: "Resource", sortable: true },
        { key: "description", label: "Description", sortable: false },
        { key: "kafkaTopic", label: "Kafka Topic", sortable: false },
        { key: "notificationChannels", label: "Channels", sortable: false },
        { key: "acknowledged", label: "Acknowledged", sortable: true },
      ],
    },
    {
      key: "sessions",
      label: "Active Sessions",
      fetchUrl: "/api/platform/billing-rbac/v1/billing/rbac/sessions",
      itemsPath: "items",
      columns: [
        { key: "id", label: "Session ID", sortable: true },
        { key: "actorId", label: "Actor", sortable: true },
        { key: "actorRole", label: "Role", sortable: true },
        { key: "tenantId", label: "Tenant", sortable: true },
        { key: "permissions", label: "Permissions", sortable: false },
        { key: "keycloakSession", label: "Keycloak Session", sortable: false },
        { key: "redisCacheKey", label: "Redis Cache Key", sortable: false },
        { key: "expiresAt", label: "Expires", sortable: true },
      ],
    },
  ],
};

export default function BillingRbacWorkspace() {
  return <CrudWorkspace config={config} />;
}
