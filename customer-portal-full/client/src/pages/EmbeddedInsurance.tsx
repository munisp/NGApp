import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface EmbeddedPartner {
  id: string;
  name: string;
  industry: string;
  status: 'active' | 'inactive' | 'pending';
  integrationDate: string;
  contactEmail: string;
  productsOffered: string[];
}

const DEMO_MODE = false;

const DEMO_PARTNERS: EmbeddedPartner[] = [
  {
    id: 'ep001',
    name: 'Jumia Nigeria',
    industry: 'E-commerce',
    status: 'active',
    integrationDate: '2023-01-15',
    contactEmail: 'partners@jumia.com.ng',
    productsOffered: ['Device Protection', 'Shipping Insurance'],
  },
  {
    id: 'ep002',
    name: 'GIG Logistics',
    industry: 'Logistics',
    status: 'pending',
    integrationDate: '2023-03-01',
    contactEmail: 'partners@giglogistics.ng',
    productsOffered: ['Transit Insurance'],
  },
  {
    id: 'ep003',
    name: 'Paystack',
    industry: 'Fintech',
    status: 'inactive',
    integrationDate: '2022-11-20',
    contactEmail: 'partners@paystack.com',
    productsOffered: ['Payment Protection'],
  },
  {
    id: 'ep004',
    name: 'Konga Nigeria',
    industry: 'E-commerce',
    status: 'active',
    integrationDate: '2023-02-10',
    contactEmail: 'partners@konga.com',
    productsOffered: ['Device Protection', 'Extended Warranty'],
  },
  {
    id: 'ep005',
    name: 'Bolt Nigeria',
    industry: 'Ride-hailing',
    status: 'pending',
    integrationDate: '2023-04-05',
    contactEmail: 'partners@bolt.eu',
    productsOffered: ['Passenger Accident Cover'],
  },
];

const EmbeddedInsurance: React.FC = () => {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'pending'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [partnersPerPage] = useState(5);

  const { data: partnersData, isLoading, isError, error, refetch } = trpc.embedded.partners.useQuery(undefined, {
    enabled: isAuthenticated && !DEMO_MODE,
  });

  const activateMutation = trpc.embedded.activate.useMutation({
    onSuccess: () => {
      toast.success('Partner activated successfully!');
      trpc.useUtils().embedded.partners.invalidate();
      refetch();
    },
    onError: (err) => {
      toast.error(`Failed to activate partner: ${err.message}`);
    },
  });

  useEffect(() => {
    if (isError && !DEMO_MODE) {
      toast.error(`Error fetching partners: ${error?.message || 'Unknown error'}`);
    }
  }, [isError, error, DEMO_MODE]);

  const partners = DEMO_MODE ? DEMO_PARTNERS : (partnersData || []);

  const filteredPartners = useMemo(() => {
    let filtered = partners;

    if (filterStatus !== 'all') {
      filtered = filtered.filter(partner => partner.status === filterStatus);
    }

    if (searchTerm) {
      filtered = filtered.filter(
        partner =>
          partner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          partner.industry.toLowerCase().includes(searchTerm.toLowerCase()) ||
          partner.productsOffered.some(product => product.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    return filtered;
  }, [partners, filterStatus, searchTerm]);

  const totalPages = Math.ceil(filteredPartners.length / partnersPerPage);
  const currentPartners = useMemo(() => {
    const indexOfLastPartner = currentPage * partnersPerPage;
    const indexOfFirstPartner = indexOfLastPartner - partnersPerPage;
    return filteredPartners.slice(indexOfFirstPartner, indexOfLastPartner);
  }, [filteredPartners, currentPage, partnersPerPage]);

  const handleActivatePartner = useCallback((partnerId: string) => {
    if (!isAuthenticated && !DEMO_MODE) {
      toast.error('You must be logged in to perform this action.');
      return;
    }
    activateMutation.mutate({ partnerId });
  }, [activateMutation, isAuthenticated, DEMO_MODE]);

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  if (isAuthLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading authentication...</p>
      </div>
    );
  }

  if (!isAuthenticated && !DEMO_MODE) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Card className="w-[350px]">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Please log in to view this page.</p>
            {/* Optionally add a login button here */}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            Embedded Insurance Partners
            <Dialog>
              <DialogTrigger asChild>
                <Button>Add New Partner</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Embedded Partner</DialogTitle>
                  <DialogDescription>
                    Fill in the details to add a new embedded insurance partner.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="name" className="text-right">Name</label>
                    <Input id="name" defaultValue="New Partner Co." className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="industry" className="text-right">Industry</label>
                    <Input id="industry" defaultValue="Fintech" className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="email" className="text-right">Contact Email</label>
                    <Input id="email" defaultValue="contact@newpartner.com" className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="products" className="text-right">Products</label>
                    <Input id="products" defaultValue="Health, Life" className="col-span-3" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" onClick={() => toast.info('Add Partner functionality not yet implemented.')}>Save Partner</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <Input
              placeholder="Search partners..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Select value={filterStatus} onValueChange={(value: 'all' | 'active' | 'inactive' | 'pending') => setFilterStatus(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading && !DEMO_MODE ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="ml-2">Loading partners...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner Name</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Integration Date</TableHead>
                  <TableHead>Products Offered</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentPartners.length > 0 ? (
                  currentPartners.map((partner) => (
                    <TableRow key={partner.id}>
                      <TableCell className="font-medium">{partner.name}</TableCell>
                      <TableCell>{partner.industry}</TableCell>
                      <TableCell>
                        <Badge variant={partner.status === 'active' ? 'default' : partner.status === 'pending' ? 'secondary' : 'destructive'}>
                          {partner.status.charAt(0).toUpperCase() + partner.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>{partner.integrationDate}</TableCell>
                      <TableCell>{partner.productsOffered.join(', ')}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleActivatePartner(partner.id)}
                          disabled={partner.status === 'active' || activateMutation.isLoading}
                        >
                          {activateMutation.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Activate'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      No embedded partners found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          <div className="flex justify-end space-x-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            {Array.from({ length: totalPages }, (_, i) => (
              <Button
                key={i + 1}
                variant={currentPage === i + 1 ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePageChange(i + 1)}
              >
                {i + 1}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmbeddedInsurance;