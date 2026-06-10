import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';

/**
 * use2FAGuard Hook
 * 
 * Checks if the current user has 2FA enabled and redirects to verification page
 * if they haven't completed 2FA verification yet.
 * 
 * Usage: Call this hook at the top of protected pages/components
 * 
 * @param options - Configuration options
 * @param options.redirectTo - Path to redirect after successful 2FA (default: current path)
 * @param options.skip - Skip 2FA check (useful for public pages)
 */

interface Use2FAGuardOptions {
  redirectTo?: string;
  skip?: boolean;
}

export function use2FAGuard(options: Use2FAGuardOptions = {}) {
  const { redirectTo, skip = false } = options;
  const [location, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();

  // Get session 2FA status (checks if session has twoFactorVerified flag)
  const { data: sessionStatus, isLoading: statusLoading } = trpc.auth.session2FAStatus.useQuery(
    undefined,
    {
      enabled: !skip,
      retry: false,
    }
  );

  useEffect(() => {
    // Skip if guard is disabled or still loading
    if (skip || authLoading || statusLoading) {
      return;
    }

    // Skip if not logged in (let other auth guards handle this)
    if (!user) {
      return;
    }

    // Skip if already on 2FA verification page
    if (location === '/verify-2fa') {
      return;
    }

    // Check if 2FA verification is needed
    if (sessionStatus?.needsVerification) {
      // Store intended destination
      if (redirectTo) {
        sessionStorage.setItem('intendedPath', redirectTo);
      } else if (location !== '/') {
        sessionStorage.setItem('intendedPath', location);
      }

      // Redirect to 2FA verification
      setLocation('/verify-2fa');
    }
  }, [
    user,
    authLoading,
    statusLoading,
    sessionStatus,
    location,
    redirectTo,
    skip,
    setLocation,
  ]);

  return {
    isChecking: authLoading || statusLoading,
    requires2FA: sessionStatus?.requires2FA ?? false,
    isVerified: sessionStatus?.verified ?? true,
    needsVerification: sessionStatus?.needsVerification ?? false,
  };
}
