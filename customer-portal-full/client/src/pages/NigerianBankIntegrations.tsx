import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';

interface Bank {
  id: string;
  name: string;
  code: string;
  status: 'active' | 'inactive';
}

const DEMO_MODE = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

const demoBanks: Bank[] = [
  { id: '1', name: 'Access Bank Plc', code: '044', status: 'active' },
  { id: '2', name: 'Guaranty Trust Bank Plc', code: '058', status: 'active' },
  { id: '3', name: 'Zenith Bank Plc', code: '057', status: 'active' },
  { id: '4', name: 'United Bank for Africa Plc', code: '033', status: 'active' },
  { id: '5', name: 'First Bank of Nigeria Ltd', code: '011', status: 'active' },
  { id: '6', name: 'Ecobank Nigeria Plc', code: '050', status: 'active' },
  { id: '7', name: 'Fidelity Bank Plc', code: '070', status: 'active' },
  { id: '8', name: 'Union Bank of Nigeria Plc', code: '032', status: 'active' },
  { id: '9', name: 'Sterling Bank Plc', code: '232', status: 'active' },
  { id: '10', name: 'Wema Bank Plc', code: '035', status: 'active' },
];

const NigerianBankIntegrations: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isVerifyDialogOpen, setIsVerifyDialogOpen] = useState(false);
  const [accountNumber, setAccountNumber] = useState('');
  const [selectedBankCode, setSelectedBankCode] = useState('');

  const utils = trpc.useUtils();

  const { data: banks, isLoading: isLoadingBanks, error: banksError } = trpc.bankIntegrations.banks.useQuery(undefined, {
    enabled: isAuthenticated && !DEMO_MODE,
  });

  const verifyAccountMutation = trpc.bankIntegrations.verifyAccount.useMutation({
    onSuccess: (data) => {
      toast.success(`Account verification successful for ${data.accountName || 'account'}.`);
      setIsVerifyDialogOpen(false);
      setAccountNumber('');
      setSelectedBankCode('');
      utils.bankIntegrations.banks.invalidate(); // Invalidate to potentially refresh bank statuses
    },
    onError: (error) => {
      toast.error(`Account verification failed: ${error.message}`);
    },
  });

  useEffect(() => {
    if (banksError) {
      toast.error(`Failed to load banks: ${banksError.message}`);
    }
  }, [banksError]);

  const handleVerifyAccount = () => {
    if (!accountNumber || !selectedBankCode) {
      toast.error('Please enter account number and select a bank.');
      return;
    }
    verifyAccountMutation.mutate({ accountNumber, bankCode: selectedBankCode });
  };

  const filteredBanks = (DEMO_MODE ? demoBanks : (banks || [])).filter(bank =>
    bank.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen text-lg font-semibold">
        Please log in to view bank integrations.
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            Nigerian Bank Integrations
            <Dialog open={isVerifyDialogOpen} onOpenChange={setIsVerifyDialogOpen}>
              <DialogTrigger asChild>
                <Button>Verify New Account</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Verify Bank Account</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="bankCode" className="text-right">
                      Bank
                    </Label>
                    <select
                      id="bankCode"
                      value={selectedBankCode}
                      onChange={(e) => setSelectedBankCode(e.target.value)}
                      className="col-span-3 p-2 border rounded-md"
                    >
                      <option value="">Select a bank</option>
                      {(DEMO_MODE ? demoBanks : (banks || [])).map((bank) => (
                        <option key={bank.id} value={bank.code}>
                          {bank.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="accountNumber" className="text-right">
                      Account Number
                    </Label>
                    <Input
                      id="accountNumber"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="col-span-3"
                      placeholder="Enter account number"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleVerifyAccount}
                    disabled={verifyAccountMutation.isLoading || !accountNumber || !selectedBankCode}
                  >
                    {verifyAccountMutation.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Verify Account
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Search banks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
          {(isLoadingBanks && !DEMO_MODE) ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bank Name</TableHead>
                  <TableHead>Bank Code</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBanks.length > 0 ? (
                  filteredBanks.map((bank) => (
                    <TableRow key={bank.id}>
                      <TableCell className="font-medium">{bank.name}</TableCell>
                      <TableCell>{bank.code}</TableCell>
                      <TableCell>{bank.status === 'active' ? 'Active' : 'Inactive'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center">
                      No banks found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NigerianBankIntegrations;