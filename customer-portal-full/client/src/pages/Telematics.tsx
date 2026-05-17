import React, { useState, useEffect } from 'react';
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TelematicsData {
  id: string;
  vehicleId: string;
  driverId: string;
  timestamp: string;
  speed: number;
  location: { lat: number; lng: number };
  fuelLevel: number;
  engineStatus: string;
}

const DEMO_TELEMATICS_DATA: TelematicsData[] = [
  {
    id: "tel001",
    vehicleId: "ABC-123-NG",
    driverId: "DRV-001",
    timestamp: "2024-01-15T10:30:00Z",
    speed: 85,
    location: { lat: 6.5244, lng: 3.3792 }, // Lagos, Nigeria
    fuelLevel: 0.75,
    engineStatus: "Running",
  },
  {
    id: "tel002",
    vehicleId: "XYZ-789-NG",
    driverId: "DRV-002",
    timestamp: "2024-01-15T11:00:00Z",
    speed: 60,
    location: { lat: 9.0765, lng: 7.3986 }, // Abuja, Nigeria
    fuelLevel: 0.50,
    engineStatus: "Idle",
  },
  {
    id: "tel003",
    vehicleId: "DEF-456-NG",
    driverId: "DRV-001",
    timestamp: "2024-01-15T11:15:00Z",
    speed: 100,
    location: { lat: 7.3775, lng: 3.9470 }, // Ibadan, Nigeria
    fuelLevel: 0.90,
    engineStatus: "Running",
  },
  {
    id: "tel004",
    vehicleId: "GHI-012-NG",
    driverId: "DRV-003",
    timestamp: "2024-01-15T12:00:00Z",
    speed: 70,
    location: { lat: 5.4833, lng: 7.0433 }, // Port Harcourt, Nigeria
    fuelLevel: 0.30,
    engineStatus: "Running",
  },
];

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

const Telematics: React.FC = () => {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterVehicleId, setFilterVehicleId] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [newTelematicsData, setNewTelematicsData] = useState<Partial<TelematicsData>>({
    vehicleId: '',
    driverId: '',
    speed: 0,
    fuelLevel: 0,
    engineStatus: 'Running',
  });

  const utils = trpc.useUtils();

  const { data, isLoading, isError, error } = trpc.telematics.data.useQuery(
    { page, pageSize, searchQuery, vehicleId: filterVehicleId },
    { enabled: isAuthenticated && !DEMO_MODE }
  );

  const submitMutation = trpc.telematics.submit.useMutation({
    onSuccess: () => {
      toast.success("Telematics data submitted successfully!");
      utils.telematics.data.invalidate();
      setIsDialogOpen(false);
      setNewTelematicsData({
        vehicleId: '',
        driverId: '',
        speed: 0,
        fuelLevel: 0,
        engineStatus: 'Running',
      });
    },
    onError: (err) => {
      toast.error(`Failed to submit telematics data: ${err.message}`);
    },
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1); // Reset to first page on search
  };

  const handleFilterVehicleChange = (value: string) => {
    setFilterVehicleId(value);
    setPage(1); // Reset to first page on filter change
  };

  const handleNewDataChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewTelematicsData(prev => ({
      ...prev,
      [name]: name === 'speed' || name === 'fuelLevel' ? parseFloat(value) : value,
    }));
  };

  const handleEngineStatusChange = (value: string) => {
    setNewTelematicsData(prev => ({ ...prev, engineStatus: value }));
  };

  const handleSubmitNewData = () => {
    if (newTelematicsData.vehicleId && newTelematicsData.driverId && newTelematicsData.speed !== undefined && newTelematicsData.fuelLevel !== undefined && newTelematicsData.engineStatus) {
      submitMutation.mutate({
        id: `temp-${Date.now()}`,
        timestamp: new Date().toISOString(),
        location: { lat: 0, lng: 0 }, // Placeholder, ideally from a map input
        ...newTelematicsData
      } as TelematicsData);
    } else {
      toast.error("Please fill all required fields.");
    }
  };

  useEffect(() => {
    if (isError) {
      toast.error(`Error fetching telematics data: ${error?.message}`);
    }
  }, [isError, error]);

  if (isAuthLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex justify-center items-center h-screen text-lg font-semibold text-red-500">
        Please log in to view telematics data.
      </div>
    );
  }

  const displayData = DEMO_MODE
    ? DEMO_TELEMATICS_DATA.filter(item =>
        item.vehicleId.toLowerCase().includes(searchQuery.toLowerCase()) &&
        (filterVehicleId === '' || item.vehicleId === filterVehicleId)
      )
    : data?.items || [];

  const totalPages = DEMO_MODE ? Math.ceil(displayData.length / pageSize) : data?.totalPages || 1;

  const paginatedData = DEMO_MODE
    ? displayData.slice((page - 1) * pageSize, page * pageSize)
    : displayData;

  const uniqueVehicleIds = Array.from(new Set(DEMO_TELEMATICS_DATA.map(d => d.vehicleId)));

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-2xl font-bold">Telematics Data</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>Add New Data</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Submit New Telematics Data</DialogTitle>
                <DialogDescription>
                  Enter the details for new telematics record.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="vehicleId" className="text-right">Vehicle ID</Label>
                  <Input
                    id="vehicleId"
                    name="vehicleId"
                    value={newTelematicsData.vehicleId}
                    onChange={handleNewDataChange}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="driverId" className="text-right">Driver ID</Label>
                  <Input
                    id="driverId"
                    name="driverId"
                    value={newTelematicsData.driverId}
                    onChange={handleNewDataChange}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="speed" className="text-right">Speed (km/h)</Label>
                  <Input
                    id="speed"
                    name="speed"
                    type="number"
                    value={newTelematicsData.speed}
                    onChange={handleNewDataChange}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="fuelLevel" className="text-right">Fuel Level (%)</Label>
                  <Input
                    id="fuelLevel"
                    name="fuelLevel"
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={newTelematicsData.fuelLevel}
                    onChange={handleNewDataChange}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="engineStatus" className="text-right">Engine Status</Label>
                  <Select onValueChange={handleEngineStatusChange} value={newTelematicsData.engineStatus}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Running">Running</SelectItem>
                      <SelectItem value="Idle">Idle</SelectItem>
                      <SelectItem value="Off">Off</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleSubmitNewData} disabled={submitMutation.isLoading}>
                {submitMutation.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Data
              </Button>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <Input
              placeholder="Search by Vehicle ID..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="max-w-sm"
            />
            <Select onValueChange={handleFilterVehicleChange} value={filterVehicleId}>
              <SelectTrigger className="max-w-[180px]">
                <SelectValue placeholder="Filter by Vehicle ID" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Vehicles</SelectItem>
                {uniqueVehicleIds.map(id => (
                  <SelectItem key={id} value={id}>{id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(isLoading && !DEMO_MODE) ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (paginatedData.length === 0 ? (
            <p className="text-center text-gray-500">No telematics data found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle ID</TableHead>
                  <TableHead>Driver ID</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Speed (km/h)</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Fuel Level</TableHead>
                  <TableHead>Engine Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.vehicleId}</TableCell>
                    <TableCell>{item.driverId}</TableCell>
                    <TableCell>{new Date(item.timestamp).toLocaleString()}</TableCell>
                    <TableCell>{item.speed}</TableCell>
                    <TableCell>{item.location.lat.toFixed(4)}, {item.location.lng.toFixed(4)}</TableCell>
                    <TableCell>{(item.fuelLevel * 100).toFixed(0)}%</TableCell>
                    <TableCell>{item.engineStatus}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ))}

          <div className="flex justify-between items-center mt-4">
            <Button
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={page === 1 || isLoading}
            >
              Previous
            </Button>
            <span>Page {page} of {totalPages}</span>
            <Button
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages || isLoading}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Telematics;