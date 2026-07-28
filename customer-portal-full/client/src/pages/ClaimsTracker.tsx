import React, { useState, useEffect } from 'react';
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle
} from "@/components/ui/card";
import {
  Button
} from "@/components/ui/button";
import {
  Input
} from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Claim {
  id: string;
  policyId: string;
  claimantName: string;
  claimDate: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Processing';
  amount: number;
  description: string;
}

const DEMO_MODE = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

const demoClaims: Claim[] = [
  {
    id: 'CLM001',
    policyId: 'POL001',
    claimantName: 'Aisha Bello',
    claimDate: '2023-01-15',
    status: 'Approved',
    amount: 150000,
    description: 'Car accident claim for a damaged bumper.'
  },
  {
    id: 'CLM002',
    policyId: 'POL002',
    claimantName: 'Chidi Okoro',
    claimDate: '2023-02-20',
    status: 'Pending',
    amount: 50000,
    description: 'Medical claim for a minor surgery.'
  },
  {
    id: 'CLM003',
    policyId: 'POL003',
    claimantName: 'Fatima Musa',
    claimDate: '2023-03-10',
    status: 'Rejected',
    amount: 25000,
    description: 'Travel insurance claim for lost luggage.'
  },
  {
    id: 'CLM004',
    policyId: 'POL004',
    claimantName: 'Kunle Adebayo',
    claimDate: '2023-04-05',
    status: 'Processing',
    amount: 300000,
    description: 'Fire damage claim for a residential property.'
  },
  {
    id: 'CLM005',
    policyId: 'POL005',
    claimantName: 'Ngozi Eze',
    claimDate: '2023-05-12',
    status: 'Approved',
    amount: 75000,
    description: 'Theft claim for a stolen phone.'
  },
];

export default function ClaimsTracker() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | Claim['status']>('All');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [newClaim, setNewClaim] = useState<Omit<Claim, 'id' | 'status'>>({
    policyId: '',
    claimantName: '',
    claimDate: '',
    amount: 0,
    description: '',
  });

  const [editingClaim, setEditingClaim] = useState<Claim | null>(null);

  const utils = trpc.useUtils();

  // Fetch claims
  const { data: claimsData, isLoading: isClaimsLoading, isError: isClaimsError } = trpc.claims.list.useQuery(
    { page, limit: pageSize, searchTerm, status: filterStatus === 'All' ? undefined : filterStatus },
    { enabled: isAuthenticated && !DEMO_MODE }
  );

  // Fetch single claim for editing/viewing
  const { data: singleClaimData, isLoading: isSingleClaimLoading, isError: isSingleClaimError } = trpc.claims.getById.useQuery(
    { id: selectedClaimId! },
    { enabled: isAuthenticated && !DEMO_MODE && !!selectedClaimId }
  );

  useEffect(() => {
    if (singleClaimData) {
      setEditingClaim(singleClaimData);
    }
  }, [singleClaimData]);

  // Mutations
  const createClaimMutation = trpc.claims.create.useMutation({
    onSuccess: () => {
      toast.success('Claim created successfully!');
      utils.claims.list.invalidate();
      setIsCreateDialogOpen(false);
      setNewClaim({
        policyId: '',
        claimantName: '',
        claimDate: '',
        amount: 0,
        description: '',
      });
    },
    onError: (error) => {
      toast.error(`Failed to create claim: ${error.message}`);
    },
  });

  const updateClaimMutation = trpc.claims.update.useMutation({
    onSuccess: () => {
      toast.success('Claim updated successfully!');
      utils.claims.list.invalidate();
      utils.claims.getById.invalidate({ id: selectedClaimId! });
      setIsEditDialogOpen(false);
      setSelectedClaimId(null);
    },
    onError: (error) => {
      toast.error(`Failed to update claim: ${error.message}`);
    },
  });

  const deleteClaimMutation = trpc.claims.delete.useMutation({
    onSuccess: () => {
      toast.success('Claim deleted successfully!');
      utils.claims.list.invalidate();
      setIsDeleteDialogOpen(false);
      setSelectedClaimId(null);
    },
    onError: (error) => {
      toast.error(`Failed to delete claim: ${error.message}`);
    },
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setPage(1); // Reset to first page on search
  };

  const handleFilterChange = (value: 'All' | Claim['status']) => {
    setFilterStatus(value);
    setPage(1); // Reset to first page on filter change
  };

  const handleEditClick = (claimId: string) => {
    setSelectedClaimId(claimId);
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (claimId: string) => {
    setSelectedClaimId(claimId);
    setIsDeleteDialogOpen(true);
  };

  const handleCreateClaim = () => {
    createClaimMutation.mutate(newClaim);
  };

  const handleUpdateClaim = () => {
    if (editingClaim) {
      updateClaimMutation.mutate(editingClaim);
    }
  };

  const handleDeleteConfirm = () => {
    if (selectedClaimId) {
      deleteClaimMutation.mutate({ id: selectedClaimId });
    }
  };

  const displayClaims = DEMO_MODE
    ? demoClaims.filter(claim =>
        claim.claimantName.toLowerCase().includes(searchTerm.toLowerCase()) &&
        (filterStatus === 'All' || claim.status === filterStatus)
      )
    : claimsData?.items || [];

  const totalClaims = DEMO_MODE ? displayClaims.length : claimsData?.totalCount || 0;
  const totalPages = Math.ceil(totalClaims / pageSize);

  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading authentication...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Card className="w-[350px]">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Please log in to view claims.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => toast.info('Login functionality not implemented in demo.')}>Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Claims Tracker</CardTitle>
          <CardDescription>Manage and track all insurance claims.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <div className="flex space-x-2">
              <Input
                placeholder="Search by claimant name..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="max-w-sm"
              />
              <Select value={filterStatus} onValueChange={handleFilterChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Statuses</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                  <SelectItem value="Processing">Processing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setIsCreateDialogOpen(true)}>Create New Claim</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Claim</DialogTitle>
                  <DialogDescription>Fill in the details for the new claim.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <Input
                    placeholder="Policy ID"
                    value={newClaim.policyId}
                    onChange={(e) => setNewClaim({ ...newClaim, policyId: e.target.value })}
                  />
                  <Input
                    placeholder="Claimant Name"
                    value={newClaim.claimantName}
                    onChange={(e) => setNewClaim({ ...newClaim, claimantName: e.target.value })}
                  />
                  <Input
                    type="date"
                    placeholder="Claim Date"
                    value={newClaim.claimDate}
                    onChange={(e) => setNewClaim({ ...newClaim, claimDate: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={newClaim.amount}
                    onChange={(e) => setNewClaim({ ...newClaim, amount: parseFloat(e.target.value) || 0 })}
                  />
                  <Input
                    placeholder="Description"
                    value={newClaim.description}
                    onChange={(e) => setNewClaim({ ...newClaim, description: e.target.value })}
                  />
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleCreateClaim}
                    disabled={createClaimMutation.isLoading}
                  >
                    {createClaimMutation.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Claim
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {(isClaimsLoading && !DEMO_MODE) ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="ml-2">Loading claims...</p>
            </div>
          ) : isClaimsError && !DEMO_MODE ? (
            <div className="text-center text-red-500">Failed to load claims.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claim ID</TableHead>
                  <TableHead>Policy ID</TableHead>
                  <TableHead>Claimant Name</TableHead>
                  <TableHead>Claim Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayClaims.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">No claims found.</TableCell>
                  </TableRow>
                ) : (
                  displayClaims.map((claim) => (
                    <TableRow key={claim.id}>
                      <TableCell>{claim.id}</TableCell>
                      <TableCell>{claim.policyId}</TableCell>
                      <TableCell>{claim.claimantName}</TableCell>
                      <TableCell>{claim.claimDate}</TableCell>
                      <TableCell>₦{claim.amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge
                          variant={claim.status === 'Approved' ? 'default' : claim.status === 'Pending' ? 'secondary' : 'destructive'}
                        >
                          {claim.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleEditClick(claim.id)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(claim.id)} className="text-red-500">
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          <div className="flex justify-between items-center mt-4">
            <Button
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={page === 1 || isClaimsLoading}
            >
              Previous
            </Button>
            <span>Page {page} of {totalPages}</span>
            <Button
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages || isClaimsLoading}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Edit Claim Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Claim</DialogTitle>
            <DialogDescription>Edit the details of the selected claim.</DialogDescription>
          </DialogHeader>
          {(isSingleClaimLoading && !DEMO_MODE) ? (
            <div className="flex justify-center items-center h-20">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="ml-2">Loading claim details...</p>
            </div>
          ) : isSingleClaimError && !DEMO_MODE ? (
            <div className="text-center text-red-500">Failed to load claim details.</div>
          ) : editingClaim ? (
            <div className="grid gap-4 py-4">
              <Input
                placeholder="Policy ID"
                value={editingClaim.policyId}
                onChange={(e) => setEditingClaim({ ...editingClaim, policyId: e.target.value })}
              />
              <Input
                placeholder="Claimant Name"
                value={editingClaim.claimantName}
                onChange={(e) => setEditingClaim({ ...editingClaim, claimantName: e.target.value })}
              />
              <Input
                type="date"
                placeholder="Claim Date"
                value={editingClaim.claimDate}
                onChange={(e) => setEditingClaim({ ...editingClaim, claimDate: e.target.value })}
              />
              <Input
                type="number"
                placeholder="Amount"
                value={editingClaim.amount}
                onChange={(e) => setEditingClaim({ ...editingClaim, amount: parseFloat(e.target.value) || 0 })}
              />
              <Input
                placeholder="Description"
                value={editingClaim.description}
                onChange={(e) => setEditingClaim({ ...editingClaim, description: e.target.value })}
              />
              <Select
                value={editingClaim.status}
                onValueChange={(value) => setEditingClaim({ ...editingClaim, status: value as Claim['status'] })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Claim Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                  <SelectItem value="Processing">Processing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="text-center">No claim selected for editing.</div>
          )}
          <DialogFooter>
            <Button
              onClick={handleUpdateClaim}
              disabled={updateClaimMutation.isLoading || !editingClaim}
            >
              {updateClaimMutation.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Claim Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>Are you sure you want to delete this claim? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteClaimMutation.isLoading}
            >
              {deleteClaimMutation.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}