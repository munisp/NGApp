/**
 * AcceptInvite.tsx — Public invitation acceptance page
 *
 * Flow:
 *  1. Extract token from URL query param
 *  2. Validate token via acceptInvitation query (public, no auth required)
 *  3. Show invitation details (inviter, role, message)
 *  4. User clicks "Accept & Sign In" → redirected to Manus OAuth
 *  5. After OAuth callback, user is authenticated; completeOnboarding mutation
 *     links the invitation to the user record and assigns the role
 */

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, UserCheck, AlertTriangle, Loader2, Shield } from "lucide-react";
import { toast } from "sonner";

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-500/20 text-red-400 border-red-500/30",
  operator: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  supervisor: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  engineer: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  user: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

export default function AcceptInvitePage() {
  const [location, navigate] = useLocation();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [completed, setCompleted] = useState(false);

  // Extract token from URL
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") ?? "";

  // Validate the invitation token
  const { data: invitation, isLoading, error } = trpc.userOnboarding.acceptInvitation.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  // Complete onboarding mutation (called after user is authenticated)
  const completeOnboarding = trpc.userOnboarding.completeOnboarding.useMutation({
    onSuccess: (data) => {
      setCompleted(true);
      toast.success(`Welcome! You've been assigned the ${data.role} role.`);
      setTimeout(() => navigate("/"), 2000);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // If user just authenticated and we have a token, complete onboarding
  useEffect(() => {
    if (isAuthenticated && token && invitation?.valid && !completed && !completeOnboarding.isPending) {
      completeOnboarding.mutate({ token });
    }
  }, [isAuthenticated, token, invitation?.valid, completed]);

  // No token in URL
  if (!token) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-[#111827] border-[#1f2937]">
          <CardHeader className="text-center">
            <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
            <CardTitle className="text-white">Invalid Invitation Link</CardTitle>
            <CardDescription>This invitation link is missing a token. Please check your email for the correct link.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Loading state
  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-[#c9a84c] animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Validating invitation…</p>
        </div>
      </div>
    );
  }

  // Token error
  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-[#111827] border-[#1f2937]">
          <CardHeader className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <CardTitle className="text-white">Invitation Invalid</CardTitle>
            <CardDescription className="text-red-400">{error.message}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-slate-500 text-sm">Please contact your platform administrator to request a new invitation.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Completed
  if (completed) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-[#111827] border-[#1f2937]">
          <CardHeader className="text-center">
            <CheckCircle className="w-14 h-14 text-emerald-400 mx-auto mb-3" />
            <CardTitle className="text-white text-xl">Welcome to OG-RMM!</CardTitle>
            <CardDescription>Your account has been set up. Redirecting to the dashboard…</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Valid invitation — show details
  return (
    <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a2744]/40 via-transparent to-[#0a0e1a] pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Logo / Platform header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <Shield className="w-8 h-8 text-[#c9a84c]" />
            <span className="text-[#c9a84c] font-bold text-xl tracking-wide">OG-RMM Platform</span>
          </div>
          <p className="text-slate-500 text-sm">Oil & Gas Remote Monitoring & Management</p>
        </div>

        <Card className="bg-[#111827] border-[#1f2937] shadow-2xl">
          <CardHeader className="text-center pb-4">
            <UserCheck className="w-12 h-12 text-[#c9a84c] mx-auto mb-3" />
            <CardTitle className="text-white text-xl">You've Been Invited</CardTitle>
            <CardDescription>
              <span className="text-slate-300 font-medium">{invitation?.inviterName ?? "A platform administrator"}</span>
              {" "}has invited you to join the platform
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Role badge */}
            <div className="flex items-center justify-between p-3 bg-[#1f2937] rounded-lg border border-[#374151]">
              <span className="text-slate-400 text-sm">Your Role</span>
              <Badge className={`capitalize font-semibold border ${ROLE_COLORS[invitation?.role ?? "user"] ?? ROLE_COLORS.user}`}>
                {invitation?.role ?? "user"}
              </Badge>
            </div>

            {/* Expiry */}
            {invitation?.expiresAt && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Clock className="w-4 h-4 shrink-0" />
                <span>
                  Invitation expires{" "}
                  <span className="text-slate-400">
                    {new Date(invitation.expiresAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </span>
              </div>
            )}

            {/* Personal message */}
            {invitation?.message && (
              <div className="p-3 bg-[#1a2744]/60 border border-[#c9a84c]/20 rounded-lg">
                <p className="text-slate-300 text-sm italic">"{invitation.message}"</p>
                <p className="text-slate-500 text-xs mt-1">— {invitation.inviterName}</p>
              </div>
            )}

            {/* CTA */}
            {isAuthenticated ? (
              <Button
                className="w-full bg-[#c9a84c] hover:bg-[#b8943d] text-[#0a0e1a] font-bold h-12"
                onClick={() => completeOnboarding.mutate({ token })}
                disabled={completeOnboarding.isPending}
              >
                {completeOnboarding.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Setting up your account…</>
                ) : (
                  <><CheckCircle className="w-4 h-4 mr-2" />Complete Setup</>
                )}
              </Button>
            ) : (
              <Button
                className="w-full bg-[#c9a84c] hover:bg-[#b8943d] text-[#0a0e1a] font-bold h-12"
                onClick={() => {
                  // Store token in sessionStorage so we can complete onboarding after OAuth
                  sessionStorage.setItem("pendingInviteToken", token);
                  window.location.href = getLoginUrl();
                }}
              >
                <UserCheck className="w-4 h-4 mr-2" />
                Accept & Sign In
              </Button>
            )}

            <p className="text-slate-600 text-xs text-center">
              By accepting, you agree to the platform's terms of use. Your account will be created using Manus OAuth.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
