import React, { useState } from 'react';
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Button
} from "@/components/ui/button";
import {
  Input
} from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

interface LoyaltyPoint {
  id: string;
  customerName: string;
  points: number;
  lastActivity: string;
}

interface Reward {
  id: string;
  name: string;
  pointsCost: number;
  description: string;
}

const DEMO_MODE = false;

const demoLoyaltyPoints: LoyaltyPoint[] = [
  { id: 'lp001', customerName: 'Aisha Bello', points: 1500, lastActivity: '2024-02-28' },
  { id: 'lp002', customerName: 'Chinedu Okoro', points: 2300, lastActivity: '2024-03-01' },
  { id: 'lp003', customerName: 'Fatima Musa', points: 800, lastActivity: '2024-02-25' },
  { id: 'lp004', customerName: 'Obi Eze', points: 3000, lastActivity: '2024-03-02' },
  { id: 'lp005', customerName: 'Ngozi Adebayo', points: 1200, lastActivity: '2024-02-29' },
];

const demoRewards: Reward[] = [
  { id: 'rw001', name: '₦500 Airtime Voucher', pointsCost: 500, description: 'Redeem for ₦500 mobile airtime.' },
  { id: 'rw002', name: '₦1000 Shopping Voucher', pointsCost: 1000, description: 'Redeem for ₦1000 off at partner stores.' },
  { id: 'rw003', name: 'Premium Service Upgrade', pointsCost: 2000, description: 'Upgrade to premium customer service for a month.' },
  { id: 'rw004', name: 'Discount on Policy Renewal', pointsCost: 1500, description: 'Get 10% off your next policy renewal.' },
];

export default function LoyaltyProgram() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [isRedeemDialogOpen, setIsRedeemDialogOpen] = useState(false);

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
        Please log in to view your loyalty program details.
      </div>
    );
  }

  // DEMO_MODE fallback
  if (DEMO_MODE) {
    const filteredDemoPoints = demoLoyaltyPoints.filter(point =>
      point.customerName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleDemoRedeem = (reward: Reward) => {
      toast.success(`Successfully redeemed ${reward.name} for ${reward.pointsCost} points in DEMO MODE.`);
      setIsRedeemDialogOpen(false);
      setSelectedReward(null);
    };

    return (
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6">Loyalty Program (DEMO MODE)</h1>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Your Loyalty Points</CardTitle>
            <CardDescription>View your current loyalty points and activity.</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Search customer by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm mb-4"
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead>Last Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDemoPoints.map((point) => (
                  <TableRow key={point.id}>
                    <TableCell className="font-medium">{point.customerName}</TableCell>
                    <TableCell>{point.points}</TableCell>
                    <TableCell>{point.lastActivity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Redeem Rewards</CardTitle>
            <CardDescription>Choose from available rewards to redeem with your points.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {demoRewards.map((reward) => (
                <Card key={reward.id}>
                  <CardHeader>
                    <CardTitle>{reward.name}</CardTitle>
                    <CardDescription>{reward.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex justify-between items-center">
                    <span className="text-lg font-semibold">{reward.pointsCost} Points</span>
                    <Button
                      onClick={() => {
                        setSelectedReward(reward);
                        setIsRedeemDialogOpen(true);
                      }}
                      disabled={false} // Always enabled in demo for demonstration
                    >
                      Redeem
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        <Dialog open={isRedeemDialogOpen} onOpenChange={setIsRedeemDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Redemption</DialogTitle>
              <DialogDescription>
                Are you sure you want to redeem {selectedReward?.name} for {selectedReward?.pointsCost} points?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRedeemDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => selectedReward && handleDemoRedeem(selectedReward)}>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const { data: loyaltyPointsData, isLoading: isLoadingPoints, error: errorPoints } = trpc.loyalty.points.useQuery();
  const redeemMutation = trpc.loyalty.redeem.useMutation({
    onSuccess: () => {
      toast.success("Reward redeemed successfully!");
      trpc.useUtils().loyalty.points.invalidate(); // Invalidate to refetch points
      setIsRedeemDialogOpen(false);
      setSelectedReward(null);
    },
    onError: (err) => {
      toast.error(`Failed to redeem reward: ${err.message}`);
    },
  });

  const handleRedeem = (rewardId: string) => {
    redeemMutation.mutate({ rewardId });
  };

  const filteredLoyaltyPoints = loyaltyPointsData?.filter(point =>
    point.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (isLoadingPoints || redeemMutation.isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (errorPoints) {
    toast.error(`Error loading loyalty points: ${errorPoints.message}`);
    return (
      <div className="container mx-auto p-4 text-red-500">
        <h1 className="text-3xl font-bold mb-6">Loyalty Program</h1>
        <p>Error: {errorPoints.message}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Loyalty Program</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Your Loyalty Points</CardTitle>
          <CardDescription>View your current loyalty points and activity.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Search customer by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm mb-4"
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer Name</TableHead>
                <TableHead>Points</TableHead>
                <TableHead>Last Activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLoyaltyPoints.map((point) => (
                <TableRow key={point.id}>
                  <TableCell className="font-medium">{point.customerName}</TableCell>
                  <TableCell>{point.points}</TableCell>
                  <TableCell>{point.lastActivity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Redeem Rewards</CardTitle>
          <CardDescription>Choose from available rewards to redeem with your points.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {demoRewards.map((reward) => (
              <Card key={reward.id}>
                <CardHeader>
                  <CardTitle>{reward.name}</CardTitle>
                  <CardDescription>{reward.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-between items-center">
                  <span className="text-lg font-semibold">{reward.pointsCost} Points</span>
                  <Button
                    onClick={() => {
                      setSelectedReward(reward);
                      setIsRedeemDialogOpen(true);
                    }}
                    disabled={redeemMutation.isLoading || (loyaltyPointsData && loyaltyPointsData.length > 0 && loyaltyPointsData[0].points < reward.pointsCost) } // Disable if not enough points or mutation is loading
                  >
                    {redeemMutation.isLoading && selectedReward?.id === reward.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Redeem"
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isRedeemDialogOpen} onOpenChange={setIsRedeemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Redemption</DialogTitle>
            <DialogDescription>
              Are you sure you want to redeem {selectedReward?.name} for {selectedReward?.pointsCost} points?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRedeemDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => selectedReward && handleRedeem(selectedReward.id)} disabled={redeemMutation.isLoading || (loyaltyPointsData && loyaltyPointsData.length > 0 && selectedReward && loyaltyPointsData[0].points < selectedReward.pointsCost)}>
              {redeemMutation.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Confirm"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}