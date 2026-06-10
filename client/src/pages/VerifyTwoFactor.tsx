import { useEffect } from 'react';
import { useLocation } from 'wouter';
import TwoFactorVerify from '@/components/TwoFactorVerify';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';

/**
 * VerifyTwoFactor Page
 * 
 * Displayed after initial login when user has 2FA enabled.
 * Requires verification before granting full access to the application.
 */

export default function VerifyTwoFactor() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();

  // Check 2FA status
  const { data: twoFactorStatus } = trpc.twoFactor.getStatus.useQuery(undefined, {
    enabled: !!user,
  });

  useEffect(() => {
    // Redirect if not logged in
    if (!loading && !user) {
      setLocation('/');
      return;
    }

    // Redirect if 2FA is not enabled (shouldn't happen, but just in case)
    if (twoFactorStatus && !twoFactorStatus.enabled) {
      setLocation('/');
      return;
    }
  }, [user, loading, twoFactorStatus, setLocation]);

  const handleSuccess = () => {
    // Invalidate auth queries to refresh user session
    utils.auth.me.invalidate();
    
    // Redirect to home or intended destination
    const intendedPath = sessionStorage.getItem('intendedPath') || '/';
    sessionStorage.removeItem('intendedPath');
    setLocation(intendedPath);
  };

  const handleCancel = () => {
    // Log out and redirect to home
    setLocation('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Security Verification</h1>
          <p className="text-muted-foreground">
            Your account is protected with two-factor authentication
          </p>
        </div>
        
        <TwoFactorVerify
          onSuccess={handleSuccess}
          onCancel={handleCancel}
          title="Verify Your Identity"
          description="Enter the 6-digit code from your authenticator app to continue"
        />
        
        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>
            Don't have access to your authenticator?{' '}
            <button
              onClick={() => setLocation('/account-recovery')}
              className="text-primary hover:underline font-medium"
            >
              Recover your account
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
