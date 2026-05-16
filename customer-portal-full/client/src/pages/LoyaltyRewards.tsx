import React, { useState } from 'react';
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";

interface Reward {
  id: string;
  name: string;
  pointsRequired: number;
  description: string;
}

const DEMO_MODE = false;

const demoRewards: Reward[] = [
  { id: '1', name: 'N500 Airtime', pointsRequired: 500, description: 'Redeem 500 loyalty points for N500 airtime.' },
  { id: '2', name: 'N1000 Data Bundle', pointsRequired: 1000, description: 'Redeem 1000 loyalty points for a N1000 data bundle.' },
  { id: '3', name: 'Discount Voucher', pointsRequired: 2000, description: 'Redeem 2000 loyalty points for a 10% discount voucher on your next premium.' },
  { id: '4', name: 'Movie Ticket', pointsRequired: 1500, description: 'Redeem 1500 loyalty points for a movie ticket.' },
];

const LoyaltyRewards: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const utils = trpc.useUtils();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRewardId, setSelectedRewardId] = useState<string | null>(null);
  const [isRedeemDialogOpen, setIsRedeemDialogOpen] = useState(false);

  const { data: loyaltyPointsData, isLoading: pointsLoading, error: pointsError } = trpc.loyalty.points.useQuery(undefined, {
    enabled: isAuthenticated && !DEMO_MODE,
  });

  const redeemMutation = trpc.loyalty.redeem.useMutation({
    onSuccess: () => {
      toast.success('Reward redeemed successfully!');
      utils.loyalty.points.invalidate();
      setIsRedeemDialogOpen(false);
      setSelectedRewardId(null);
    },
    onError: (err) => {
      toast.error(`Failed to redeem reward: ${err.message}`);
    },
  });

  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex justify-center items-center h-screen text-lg font-semibold">
        Please log in to view your loyalty rewards.
      </div>
    );
  }

  const currentLoyaltyPoints = DEMO_MODE ? 2500 : (loyaltyPointsData?.points || 0);
  const availableRewards = DEMO_MODE ? demoRewards : demoRewards; // In a real app, this would come from a tRPC query

  const filteredRewards = availableRewards.filter(reward =>
    reward.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    reward.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRedeemClick = (rewardId: string) => {
    setSelectedRewardId(rewardId);
    setIsRedeemDialogOpen(true);
  };

  const handleConfirmRedeem = () => {
    if (selectedRewardId) {
      redeemMutation.mutate({ rewardId: selectedRewardId });
    }
  };

  if (pointsLoading && !DEMO_MODE) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (pointsError && !DEMO_MODE) {
    toast.error(`Error loading loyalty points: ${pointsError.message}`);
    return (
      <div className="flex justify-center items-center h-screen text-red-500">
        Failed to load loyalty points. Please try again later.
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            Your Loyalty Points
            <Badge className="text-lg p-2">{currentLoyaltyPoints} Points</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>Earn points by engaging with our platform and redeem them for exciting rewards!</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available Rewards</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <Input
              placeholder="Search rewards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
            {/* Example of a dropdown/select, though not strictly needed for this page based on current tRPC.loyalty procedures */}
            <Select onValueChange={(value) => console.log(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Rewards</SelectItem>
                <SelectItem value="redeemable">Redeemable</SelectItem>
                <SelectItem value="high_value">High Value</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reward</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Points Required</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRewards.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">No rewards found.</TableCell>
                </TableRow>
              ) : (
                filteredRewards.map((reward) => (
                  <TableRow key={reward.id}>
                    <TableCell className="font-medium">{reward.name}</TableCell>
                    <TableCell>{reward.description}</TableCell>
                    <TableCell className="text-right">{reward.pointsRequired}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        onClick={() => handleRedeemClick(reward.id)}
                        disabled={currentLoyaltyPoints < reward.pointsRequired || redeemMutation.isLoading}
                      >
                        {redeemMutation.isLoading && selectedRewardId === reward.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Redeem
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isRedeemDialogOpen} onOpenChange={setIsRedeemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Reward Redemption</DialogTitle>
            <DialogDescription>
              Are you sure you want to redeem this reward?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRedeemDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleConfirmRedeem}
              disabled={redeemMutation.isLoading}
            >
              {redeemMutation.isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoyaltyRewards;