import React, { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface Emergency {
  id: string;
  type: string;
  location: string;
  status: 'pending' | 'resolved' | 'in-progress';
  reportedAt: string;
  contact: string;
}

const DEMO_EMERGENCIES: Emergency[] = [
  {
    id: '1',
    type: 'Road Accident',
    location: 'Lagos-Ibadan Expressway',
    status: 'pending',
    reportedAt: '2024-03-01T10:00:00Z',
    contact: '08012345678',
  },
  {
    id: '2',
    type: 'Medical Emergency',
    location: 'Victoria Island, Lagos',
    status: 'in-progress',
    reportedAt: '2024-03-01T11:30:00Z',
    contact: '07098765432',
  },
  {
    id: '3',
    type: 'Fire Outbreak',
    location: 'Apapa, Lagos',
    status: 'resolved',
    reportedAt: '2024-02-28T14:00:00Z',
    contact: '09011223344',
  },
  {
    id: '4',
    type: 'Theft',
    location: 'Abuja City Center',
    status: 'pending',
    reportedAt: '2024-03-02T09:15:00Z',
    contact: '08155667788',
  },
];

const EmergencySOS: React.FC = () => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [newEmergencyDetails, setNewEmergencyDetails] = useState({
    type: '',
    location: '',
    contact: '',
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const trpcUtils = trpc.useUtils();

  const { data: emergencies, isLoading, isError, error } = trpc.emergency.list.useQuery(undefined, {
    enabled: !isDemoMode && !!user,
  });

  const createEmergencyMutation = trpc.emergency.create.useMutation({
    onSuccess: () => {
      toast.success('Emergency reported successfully!');
      trpcUtils.emergency.list.invalidate();
      setNewEmergencyDetails({ type: '', location: '', contact: '' });
      setIsDialogOpen(false);
    },
    onError: (err) => {
      toast.error(`Failed to report emergency: ${err.message}`);
    },
  });

  if (isAuthLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex justify-center items-center h-screen text-lg font-semibold text-red-500">
        Please log in to access the Emergency SOS page.
      </div>
    );
  }

  if (isError && !isDemoMode) {
    toast.error(`Error fetching emergencies: ${error?.message}`);
    // Optionally, switch to demo mode if real data fails
    // setIsDemoMode(true);
  }

  const filteredEmergencies = useMemo(() => {
    const sourceData = isDemoMode ? DEMO_EMERGENCIES : (emergencies || []);
    if (!searchQuery) {
      return sourceData;
    }
    return sourceData.filter(
      (emergency) =>
        emergency.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emergency.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emergency.status.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, emergencies, isDemoMode]);

  const handleCreateEmergency = () => {
    if (!newEmergencyDetails.type || !newEmergencyDetails.location || !newEmergencyDetails.contact) {
      toast.error('Please fill in all emergency details.');
      return;
    }

    if (isDemoMode) {
      // Simulate creation in demo mode
      const newId = (DEMO_EMERGENCIES.length + 1).toString();
      const newDemoEmergency: Emergency = {
        id: newId,
        ...newEmergencyDetails,
        status: 'pending',
        reportedAt: new Date().toISOString(),
      };
      DEMO_EMERGENCIES.push(newDemoEmergency);
      toast.success('Emergency reported successfully in DEMO MODE!');
      setNewEmergencyDetails({ type: '', location: '', contact: '' });
      setIsDialogOpen(false);
    } else {
      createEmergencyMutation.mutate({
        type: newEmergencyDetails.type,
        location: newEmergencyDetails.location,
        contact: newEmergencyDetails.contact,
      });
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-2xl font-bold">Emergency SOS</CardTitle>
          <div className="flex items-center space-x-2">
            <Badge variant={isDemoMode ? 'destructive' : 'default'}>
              {isDemoMode ? 'DEMO MODE' : 'LIVE DATA'}
            </Badge>
            <Button onClick={() => setIsDemoMode(!isDemoMode)} variant="outline" size="sm">
              Switch to {isDemoMode ? 'Live' : 'Demo'} Mode
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>Report New Emergency</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Report New Emergency</DialogTitle>
                  <DialogDescription>
                    Fill in the details for the emergency. Click save when you're done.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="type" className="text-right">
                      Type
                    </Label>
                    <Input
                      id="type"
                      value={newEmergencyDetails.type}
                      onChange={(e) => setNewEmergencyDetails({ ...newEmergencyDetails, type: e.target.value })}
                      className="col-span-3"
                      placeholder="e.g., Road Accident, Medical Emergency"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="location" className="text-right">
                      Location
                    </Label>
                    <Input
                      id="location"
                      value={newEmergencyDetails.location}
                      onChange={(e) => setNewEmergencyDetails({ ...newEmergencyDetails, location: e.target.value })}
                      className="col-span-3"
                      placeholder="e.g., Lagos-Ibadan Expressway"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="contact" className="text-right">
                      Contact
                    </Label>
                    <Input
                      id="contact"
                      value={newEmergencyDetails.contact}
                      onChange={(e) => setNewEmergencyDetails({ ...newEmergencyDetails, contact: e.target.value })}
                      className="col-span-3"
                      placeholder="e.g., 08012345678"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleCreateEmergency}
                    disabled={createEmergencyMutation.isLoading || !newEmergencyDetails.type || !newEmergencyDetails.location || !newEmergencyDetails.contact}
                  >
                    {createEmergencyMutation.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Report Emergency
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Search emergencies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
          </div>
          {isLoading && !isDemoMode ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reported At</TableHead>
                  <TableHead>Contact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmergencies.length > 0 ? (
                  filteredEmergencies.map((emergency) => (
                    <TableRow key={emergency.id}>
                      <TableCell className="font-medium">{emergency.id}</TableCell>
                      <TableCell>{emergency.type}</TableCell>
                      <TableCell>{emergency.location}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            emergency.status === 'pending'
                              ? 'secondary'
                              : emergency.status === 'in-progress'
                              ? 'default'
                              : 'outline'
                          }
                        >
                          {emergency.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(emergency.reportedAt).toLocaleString()}</TableCell>
                      <TableCell>{emergency.contact}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4">
                      No emergencies found.
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

export default EmergencySOS;