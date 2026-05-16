import React, { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface NAICOMFiling {
  id: string;
  type: string;
  period: string;
  status: 'Submitted' | 'Pending' | 'Approved' | 'Rejected';
  submissionDate: string;
  dueDate: string;
}

const DEMO_MODE = false;

const demoFilings: NAICOMFiling[] = [
  {
    id: 'NAICOM-2024-Q1-001',
    type: 'Quarterly Financial Report',
    period: 'Q1 2024',
    status: 'Approved',
    submissionDate: '2024-04-15',
    dueDate: '2024-04-30',
  },
  {
    id: 'NAICOM-2024-Q1-002',
    type: 'Solvency Margin Statement',
    period: 'Q1 2024',
    status: 'Submitted',
    submissionDate: '2024-04-20',
    dueDate: '2024-04-30',
  },
  {
    id: 'NAICOM-2024-Q2-001',
    type: 'Quarterly Financial Report',
    period: 'Q2 2024',
    status: 'Pending',
    submissionDate: '2024-07-10',
    dueDate: '2024-07-31',
  },
  {
    id: 'NAICOM-2023-AR-001',
    type: 'Annual Returns',
    period: '2023',
    status: 'Approved',
    submissionDate: '2024-01-25',
    dueDate: '2024-01-31',
  },
  {
    id: 'NAICOM-2024-Q3-001',
    type: 'Quarterly Financial Report',
    period: 'Q3 2024',
    status: 'Rejected',
    submissionDate: '2024-10-10',
    dueDate: '2024-10-31',
  },
];

const NAICOMCompliance: React.FC = () => {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [newFilingType, setNewFilingType] = useState('');
  const [newFilingPeriod, setNewFilingPeriod] = useState('');

  const utils = trpc.useUtils();

  const { data: filingsData, isLoading, isError, error } = trpc.naicom.filings.useQuery(
    {
      page,
      limit: pageSize,
      searchTerm,
    },
    {
      enabled: isAuthenticated && !DEMO_MODE,
    }
  );

  const submitFilingMutation = trpc.naicom.submit.useMutation({
    onSuccess: () => {
      toast.success('NAICOM filing submitted successfully!');
      utils.naicom.filings.invalidate();
      setIsSubmitDialogOpen(false);
      setNewFilingType('');
      setNewFilingPeriod('');
    },
    onError: (err) => {
      toast.error(`Failed to submit filing: ${err.message}`);
    },
  });

  useEffect(() => {
    if (isError && !DEMO_MODE) {
      toast.error(`Error fetching NAICOM filings: ${error?.message}`);
    }
  }, [isError, error, DEMO_MODE]);

  if (isAuthLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex justify-center items-center h-screen text-lg font-semibold">
        Please log in to view NAICOM Compliance.
      </div>
    );
  }

  const displayFilings = DEMO_MODE
    ? demoFilings.filter(
        (filing) =>
          filing.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
          filing.period.toLowerCase().includes(searchTerm.toLowerCase()) ||
          filing.status.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : filingsData?.filings || [];

  const totalPages = DEMO_MODE ? Math.ceil(displayFilings.length / pageSize) : filingsData?.totalPages || 1;

  const handlePreviousPage = () => {
    setPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setPage((prev) => Math.min(prev + 1, totalPages));
  };

  const handleSubmitFiling = () => {
    if (!newFilingType || !newFilingPeriod) {
      toast.error('Please select a filing type and period.');
      return;
    }
    if (DEMO_MODE) {
      toast.info('Demo Mode: Filing submission simulated.');
      setIsSubmitDialogOpen(false);
      setNewFilingType('');
      setNewFilingPeriod('');
      return;
    }
    submitFilingMutation.mutate({
      type: newFilingType,
      period: newFilingPeriod,
    });
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-2xl font-bold">NAICOM Compliance Filings</CardTitle>
          <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
            <DialogTrigger asChild>
              <Button>Submit New Filing</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Submit New NAICOM Filing</DialogTitle>
                <DialogDescription>
                  Fill in the details for the new NAICOM compliance filing.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="filingType" className="text-right">
                    Filing Type
                  </Label>
                  <Select value={newFilingType} onValueChange={setNewFilingType}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select a filing type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Quarterly Financial Report">Quarterly Financial Report</SelectItem>
                      <SelectItem value="Annual Returns">Annual Returns</SelectItem>
                      <SelectItem value="Solvency Margin Statement">Solvency Margin Statement</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="filingPeriod" className="text-right">
                    Period
                  </Label>
                  <Input
                    id="filingPeriod"
                    value={newFilingPeriod}
                    onChange={(e) => setNewFilingPeriod(e.target.value)}
                    className="col-span-3"
                    placeholder="e.g., Q1 2024, 2023"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleSubmitFiling}
                  disabled={submitFilingMutation.isLoading || !newFilingType || !newFilingPeriod}
                >
                  {submitFilingMutation.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Filing
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Search filings by type, period, or status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {(isLoading && !DEMO_MODE) ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Filing ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Submission Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayFilings.length > 0 ? (
                    displayFilings.map((filing) => (
                      <TableRow key={filing.id}>
                        <TableCell className="font-medium">{filing.id}</TableCell>
                        <TableCell>{filing.type}</TableCell>
                        <TableCell>{filing.period}</TableCell>
                        <TableCell>{filing.dueDate}</TableCell>
                        <TableCell>{filing.submissionDate}</TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${filing.status === 'Approved' ? 'bg-green-100 text-green-800' : filing.status === 'Submitted' ? 'bg-blue-100 text-blue-800' : filing.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}
                          >
                            {filing.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        No NAICOM filings found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="flex justify-end space-x-2 mt-4">
                <Button onClick={handlePreviousPage} disabled={page === 1}>
                  Previous
                </Button>
                <Button onClick={handleNextPage} disabled={page === totalPages}>
                  Next
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NAICOMCompliance;