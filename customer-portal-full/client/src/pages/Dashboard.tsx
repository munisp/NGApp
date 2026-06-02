import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, FileText, CreditCard, User, Loader2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { useEffect, useState } from "react";
import { useNotifications } from "@/hooks/useNotifications";

// Demo mode data for demonstration purposes
const DEMO_MODE = process.env.DEMO_MODE === 'true';
const DEMO_USER = { name: "Demo User", email: "demo@insureportal.ng" };
const DEMO_POLICIES = [
  { id: 1, policyNumber: "POL-2026-001", name: "Comprehensive Health Plan", type: "Health", premium: "150000", status: "Active", startDate: "2025-01-15", expiryDate: "2026-01-15" },
  { id: 2, policyNumber: "POL-2026-002", name: "Auto Protection Plus", type: "Auto", premium: "85000", status: "Active", startDate: "2025-03-01", expiryDate: "2026-03-01" },
  { id: 3, policyNumber: "POL-2025-003", name: "Home Shield", type: "Property", premium: "200000", status: "Expired", startDate: "2024-06-01", expiryDate: "2025-06-01" },
];
const DEMO_CLAIMS = [
  { id: 1, claimNumber: "CLM-2026-001", policyId: 1, amount: "45000", status: "Under Review", incidentDate: "2026-01-10", description: "Medical expenses", createdAt: "2026-01-12" },
  { id: 2, claimNumber: "CLM-2025-002", policyId: 2, amount: "120000", status: "Approved", incidentDate: "2025-11-20", description: "Vehicle repair", createdAt: "2025-11-22" },
];
const DEMO_PAYMENTS = [
  { id: 1, policyId: 1, amount: "12500", status: "Pending", dueDate: "2026-02-15", paidDate: null, paymentMethod: null },
  { id: 2, policyId: 2, amount: "7083", status: "Completed", dueDate: "2026-01-01", paidDate: "2025-12-28", paymentMethod: "Card" },
  { id: 3, policyId: 1, amount: "12500", status: "Completed", dueDate: "2026-01-15", paidDate: "2026-01-14", paymentMethod: "Bank Transfer" },
];

export default function Dashboard() {
  const { user: authUser, loading: authLoading, isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [demoMode] = useState(DEMO_MODE);
  
  // Use demo data or real data based on mode
  const user = demoMode ? DEMO_USER : authUser;
  
  const { data: realPolicies, isLoading: policiesLoading } = trpc.policies.list.useQuery(undefined, {
    enabled: isAuthenticated && !demoMode,
  });
  
  const { data: realClaims, isLoading: claimsLoading } = trpc.claims.list.useQuery(undefined, {
    enabled: isAuthenticated && !demoMode,
  });
  
  const { data: realPayments, isLoading: paymentsLoading } = trpc.payments.list.useQuery(undefined, {
    enabled: isAuthenticated && !demoMode,
  });

  const policies = demoMode ? DEMO_POLICIES : realPolicies;
  const claims = demoMode ? DEMO_CLAIMS : realClaims;
  const payments = demoMode ? DEMO_PAYMENTS : realPayments;

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = getLoginUrl();
    },
  });

  // Enable real-time notifications
  const { connected: notificationsConnected } = useNotifications(isAuthenticated || demoMode);

  useEffect(() => {
    if (!demoMode && !authLoading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [authLoading, isAuthenticated, demoMode]);

  if (!demoMode && (authLoading || !isAuthenticated)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const activePolicies = policies?.filter(p => p.status === "Active") || [];
  const pendingClaims = claims?.filter(c => c.status === "Submitted" || c.status === "Under Review") || [];
  const pendingPayments = payments?.filter(p => p.status === "Pending") || [];
  const totalDue = pendingPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

  const recentActivity = [
    ...(payments?.slice(0, 2).map(p => ({
      type: "payment",
      title: p.status === "Completed" ? "Premium Paid" : "Payment Due",
      date: p.paidDate || p.dueDate,
      amount: `₦${parseFloat(p.amount).toLocaleString()}`,
      status: p.status,
    })) || []),
    ...(claims?.slice(0, 2).map(c => ({
      type: "claim",
      title: "Claim Submitted",
      date: c.createdAt,
      amount: c.status,
      status: c.status,
    })) || []),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
      <nav className="bg-white border-b">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold">InsurePortal</span>
          </div>
          <div className="flex gap-4">
            <Link href="/profile"><Button variant="ghost">Profile</Button></Link>
            <Button variant="outline" onClick={() => logoutMutation.mutate()}>
              {logoutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Logout"}
            </Button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-2">Welcome back, {user?.name || "User"}</h1>
        <p className="text-muted-foreground mb-12">Manage your insurance policies and claims</p>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-600">
                <Shield className="h-5 w-5" />
                My Policies
              </CardTitle>
            </CardHeader>
            <CardContent>
              {policiesLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <p className="text-3xl font-bold mb-2">{activePolicies.length}</p>
                  <p className="text-sm text-muted-foreground">Active policies</p>
                  <Link href="/policies"><Button className="mt-4 w-full">View All</Button></Link>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <FileText className="h-5 w-5" />
                Claims
              </CardTitle>
            </CardHeader>
            <CardContent>
              {claimsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <p className="text-3xl font-bold mb-2">{pendingClaims.length}</p>
                  <p className="text-sm text-muted-foreground">Pending claims</p>
                  <Link href="/claims"><Button className="mt-4 w-full" variant="outline">Manage</Button></Link>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-600">
                <CreditCard className="h-5 w-5" />
                Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {paymentsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <p className="text-3xl font-bold mb-2">₦{totalDue.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Due this month</p>
                  <Link href="/payments"><Button className="mt-4 w-full" variant="outline">Pay Now</Button></Link>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600">
                <User className="h-5 w-5" />
                Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-4">Update your information</p>
              <Link href="/profile"><Button className="mt-4 w-full" variant="outline">Edit Profile</Button></Link>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No recent activity</p>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((activity, idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium">{activity.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(activity.date).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                    <span className={`font-semibold ${
                      activity.status === "Completed" ? "text-green-600" : 
                      activity.status === "Pending" ? "text-orange-600" : 
                      "text-blue-600"
                    }`}>
                      {activity.amount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
