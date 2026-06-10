'use client';

import React, { useEffect, useState } from 'react';
import { useAuth, ROLES } from '@/lib/auth';
import { Loader2, ShieldAlert, Lock } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  requiredPermissions?: string[];
  fallback?: React.ReactNode;
}

export function ProtectedRoute({
  children,
  requiredRoles = [],
  requiredPermissions = [],
  fallback,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user, hasRole, hasPermission } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      // Check roles
      const hasRequiredRoles =
        requiredRoles.length === 0 || requiredRoles.some((role) => hasRole(role));

      // Check permissions
      const hasRequiredPermissions =
        requiredPermissions.length === 0 ||
        requiredPermissions.some((permission) => hasPermission(permission));

      setIsAuthorized(hasRequiredRoles && hasRequiredPermissions);
    }
  }, [isLoading, isAuthenticated, user, requiredRoles, requiredPermissions, hasRole, hasPermission]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-primary-600 animate-spin mx-auto" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return fallback || null;
  }

  // Not authorized
  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-8">
          <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">
            You don't have permission to access this page. Please contact your administrator if you
            believe this is an error.
          </p>
          <div className="bg-gray-100 rounded-lg p-4 text-left">
            <p className="text-sm text-gray-500 mb-2">Required access:</p>
            {requiredRoles.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {requiredRoles.map((role) => (
                  <span
                    key={role}
                    className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded"
                  >
                    {role}
                  </span>
                ))}
              </div>
            )}
            {requiredPermissions.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {requiredPermissions.map((permission) => (
                  <span
                    key={permission}
                    className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded"
                  >
                    {permission}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// Higher-order component for role-based access
export function withRoles<P extends object>(
  Component: React.ComponentType<P>,
  requiredRoles: string[]
) {
  return function WrappedComponent(props: P) {
    return (
      <ProtectedRoute requiredRoles={requiredRoles}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}

// Higher-order component for permission-based access
export function withPermissions<P extends object>(
  Component: React.ComponentType<P>,
  requiredPermissions: string[]
) {
  return function WrappedComponent(props: P) {
    return (
      <ProtectedRoute requiredPermissions={requiredPermissions}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}

// Role-based visibility component
export function RoleGate({
  children,
  roles,
  fallback = null,
}: {
  children: React.ReactNode;
  roles: string[];
  fallback?: React.ReactNode;
}) {
  const { hasRole, isAuthenticated } = useAuth();

  if (!isAuthenticated) return <>{fallback}</>;

  const hasAccess = roles.some((role) => hasRole(role));
  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

// Permission-based visibility component
export function PermissionGate({
  children,
  permissions,
  fallback = null,
}: {
  children: React.ReactNode;
  permissions: string[];
  fallback?: React.ReactNode;
}) {
  const { hasPermission, isAuthenticated } = useAuth();

  if (!isAuthenticated) return <>{fallback}</>;

  const hasAccess = permissions.some((permission) => hasPermission(permission));
  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

export default ProtectedRoute;
