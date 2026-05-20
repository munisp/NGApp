export const roleNavAccess: Record<string, string[]> = {
  admin: [
    "core",
    "finance",
    "notifications",
    "admin",
    "compliance",
    "settings",
    "infra",
    "tenant",
    "billing",
    "security",
    "analytics",
    "reports",
  ],
  supervisor: [
    "core",
    "finance",
    "notifications",
    "admin",
    "compliance",
    "settings",
    "reports",
    "analytics",
  ],
  agent: ["core", "finance", "notifications"],
  merchant: ["core", "finance", "notifications", "reports"],
  viewer: ["core", "notifications"],
  customer: ["core"],
};

export function canAccessRoute(arg1: string, arg2: string): boolean {
  // Detect parameter order: if arg1 starts with "/" it's (route, role), otherwise (role, route)
  const role = arg1.startsWith("/") ? arg2 : arg1;
  const route = arg1.startsWith("/") ? arg1 : arg2;
  const adminRoutes = [
    "/admin",
    "/compliance",
    "/settings",
    "/user-management",
    "/infra",
    "/tenant",
    "/gdpr",
    "/vault",
    "/tigerbeetle",
  ];
  if (role === "admin" || role === "supervisor") return true;
  if (adminRoutes.some(r => route.startsWith(r))) return false;
  return true;
}

export function filterNavGroupsByRole(
  groups: Array<{
    label: string;
    items: Array<{ label: string; path: string }>;
  }>,
  role: string
): Array<{ label: string; items: Array<{ label: string; path: string }> }> {
  if (role === "admin" || role === "supervisor") return groups;
  return groups
    .map(g => ({
      ...g,
      items: g.items.filter(item => canAccessRoute(item.path, role)),
    }))
    .filter(g => g.items.length > 0);
}

export function getRoleDisplayName(role: string): string {
  const names: Record<string, string> = {
    admin: "Administrator",
    supervisor: "Supervisor",
    agent: "Agent",
    merchant: "Merchant",
    viewer: "Viewer",
    customer: "Customer",
    user: "User",
    operator: "Operator",
  };
  return names[role] || role.charAt(0).toUpperCase() + role.slice(1);
}

export function getRoleBadgeColor(role: string): string {
  const colors: Record<string, string> = {
    admin: "red",
    supervisor: "orange",
    agent: "blue",
    merchant: "green",
    viewer: "gray",
    customer: "purple",
    user: "teal",
    operator: "indigo",
  };
  return colors[role] || "gray";
}
