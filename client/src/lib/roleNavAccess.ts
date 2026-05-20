export const roleNavAccess = {
  admin: {
    core: true,
    finance: true,
    notifications: true,
    admin: true,
    compliance: true,
    settings: true,
  },
  agent: {
    core: true,
    finance: true,
    notifications: true,
    admin: false,
    compliance: false,
    settings: false,
  },
  merchant: {
    core: true,
    finance: true,
    notifications: true,
    admin: false,
    compliance: false,
    settings: false,
  },
  viewer: {
    core: true,
    finance: false,
    notifications: true,
    admin: false,
    compliance: false,
    settings: false,
  },
};

export function canAccessRoute(role: string, route: string): boolean {
  const adminRoutes = [
    "/admin",
    "/compliance",
    "/settings",
    "/user-management",
  ];
  if (role !== "admin" && adminRoutes.some(r => route.startsWith(r)))
    return false;
  return true;
}

export function filterNavGroupsByRole(
  role: string,
  groups: string[]
): string[] {
  const access =
    roleNavAccess[role as keyof typeof roleNavAccess] || roleNavAccess.viewer;
  return groups.filter(g => access[g as keyof typeof access]);
}
