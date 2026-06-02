import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Policy {
  id: string;
  policyNumber: string;
  customerName: string;
  type: string;
  premium: number;
  renewalDate: string;
  status: 'Active' | 'Expired' | 'Pending Renewal';
}

const DEMO_POLICIES: Policy[] = [
  {
    id: 'pol-001',
    policyNumber: 'NIG/AUTO/2024/001',
    customerName: 'Aisha Bello',
    type: 'Auto Insurance',
    premium: 75000,
    renewalDate: '2026-03-15',
    status: 'Pending Renewal',
  },
  {
    id: 'pol-002',
    policyNumber: 'NIG/LIFE/2024/002',
    customerName: 'Chike Okoro',
    type: 'Life Insurance',
    premium: 120000,
    renewalDate: '2026-03-20',
    status: 'Pending Renewal',
  },
  {
    id: 'pol-003',
    policyNumber: 'NIG/HEALTH/2024/003',
    customerName: 'Fatima Musa',
    type: 'Health Insurance',
    premium: 90000,
    renewalDate: '2026-04-01',
    status: 'Pending Renewal',
  },
  {
    id: 'pol-004',
    policyNumber: 'NIG/HOME/2024/004',
    customerName: 'Kunle Adebayo',
    type: 'Home Insurance',
    premium: 150000,
    renewalDate: '2026-04-10',
    status: 'Pending Renewal',
  },
];

const PolicyRenewalAutomation: React.FC = () => {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const DEMO_MODE = process.env.DEMO_MODE === 'true';
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: upcomingPolicies, isLoading, isError, error, refetch } = trpc.policyRenewal.upcoming.useQuery(undefined, {
    enabled: isAuthenticated && !DEMO_MODE,
  });

  const renewPolicyMutation = trpc.policyRenewal.renew.useMutation({
    onSuccess: () => {
      toast.success('Policy renewed successfully!');
      trpc.useUtils().policyRenewal.upcoming.invalidate();
      setIsDialogOpen(false);
      setSelectedPolicyId(null);
    },
    onError: (err) => {
      toast.error(`Failed to renew policy: ${err.message}`);
    },
  });

  useEffect(() => {
    if (isError && !DEMO_MODE) {
      toast.error(`Error fetching upcoming policies: ${error?.message}`);
    }
  }, [isError, error, DEMO_MODE]);

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading authentication...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-500">
        Please log in to access the Policy Renewal Automation page.
      </div>
    );
  }

  const policiesToDisplay = DEMO_MODE ? DEMO_POLICIES : (upcomingPolicies || []);

  const handleRenewClick = (policyId: string) => {
    setSelectedPolicyId(policyId);
    setIsDialogOpen(true);
  };

  const confirmRenewal = () => {
    if (selectedPolicyId) {
      if (DEMO_MODE) {
        toast.success(`[DEMO] Policy ${selectedPolicyId} renewed successfully!`);
        setIsDialogOpen(false);
        setSelectedPolicyId(null);
      } else {
        renewPolicyMutation.mutate({ policyId: selectedPolicyId });
      }
    }
  };

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-2xl font-bold">Policy Renewal Automation</CardTitle>
          <Button onClick={() => setDEMO_MODE(!DEMO_MODE)} variant="outline">
            {DEMO_MODE ? 'Exit Demo Mode' : 'Enter Demo Mode'}
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Manage and automate the renewal process for upcoming insurance policies.
          </p>

          {isLoading && !DEMO_MODE ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading upcoming policies...</span>
            </div>
          ) : policiesToDisplay.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No upcoming policies found for renewal.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Policy Number</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Premium (₦)</TableHead>
                  <TableHead>Renewal Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policiesToDisplay.map((policy) => (
                  <TableRow key={policy.id}>
                    <TableCell className="font-medium">{policy.policyNumber}</TableCell>
                    <TableCell>{policy.customerName}</TableCell>
                    <TableCell>{policy.type}</TableCell>
                    <TableCell>{policy.premium.toLocaleString('en-NG')}</TableCell>
                    <TableCell>{new Date(policy.renewalDate).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}</TableCell>
                    <TableCell>
                      <Badge variant={policy.status === 'Pending Renewal' ? 'default' : 'secondary'}>
                        {policy.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRenewClick(policy.id)}
                        disabled={renewPolicyMutation.isLoading}
                      >
                        {renewPolicyMutation.isLoading && selectedPolicyId === policy.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Renew
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Policy Renewal</DialogTitle>
            <DialogDescription>
              Are you sure you want to renew policy <span className="font-bold">{selectedPolicyId}</span>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={renewPolicyMutation.isLoading}>
              Cancel
            </Button>
            <Button onClick={confirmRenewal} disabled={renewPolicyMutation.isLoading}>
              {renewPolicyMutation.isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Confirm Renewal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PolicyRenewalAutomation;