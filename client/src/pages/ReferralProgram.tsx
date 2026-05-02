import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Gift, Copy, Share2, Users, DollarSign } from "lucide-react";

const mockReferrals = [
  { id: 1, referredEmail: "john@example.com", status: "completed", rewardAmount: "500.00", createdAt: "2026-04-15" },
  { id: 2, referredEmail: "jane@example.com", status: "completed", rewardAmount: "500.00", createdAt: "2026-04-20" },
  { id: 3, referredEmail: "alice@example.com", status: "pending", rewardAmount: "0", createdAt: "2026-05-01" },
];

export default function ReferralProgram() {
  const referralCode = "REF-A1B2C3D4";
  const referralLink = `https://payswitch.ng/signup?ref=${referralCode}`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Gift className="h-8 w-8" /> Referral Program</h1>
          <p className="text-muted-foreground mt-1">Invite friends and earn rewards for every successful referral</p>
        </div>

        <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <h2 className="text-2xl font-bold">Earn ₦500 for every referral!</h2>
              <p className="text-muted-foreground">Share your unique code and earn when your friends complete their first transaction</p>
              <div className="flex items-center justify-center gap-2 max-w-md mx-auto">
                <Input readOnly value={referralCode} className="text-center font-mono text-lg" />
                <Button variant="outline" onClick={() => copyToClipboard(referralCode)}><Copy className="h-4 w-4" /></Button>
              </div>
              <div className="flex items-center justify-center gap-2 max-w-lg mx-auto">
                <Input readOnly value={referralLink} className="text-sm" />
                <Button variant="outline" onClick={() => copyToClipboard(referralLink)}><Share2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <Users className="h-8 w-8 mx-auto mb-2 text-primary" />
              <div className="text-2xl font-bold">{mockReferrals.length}</div>
              <p className="text-sm text-muted-foreground">Total Referrals</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Gift className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <div className="text-2xl font-bold">{mockReferrals.filter(r => r.status === "completed").length}</div>
              <p className="text-sm text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <DollarSign className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
              <div className="text-2xl font-bold">₦{mockReferrals.reduce((s, r) => s + parseFloat(r.rewardAmount), 0).toLocaleString()}</div>
              <p className="text-sm text-muted-foreground">Total Earned</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Your Referrals</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Email</TableHead><TableHead>Status</TableHead><TableHead>Reward</TableHead><TableHead>Date</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {mockReferrals.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{r.referredEmail}</TableCell>
                    <TableCell><Badge variant={r.status === "completed" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                    <TableCell>{parseFloat(r.rewardAmount) > 0 ? `₦${r.rewardAmount}` : "—"}</TableCell>
                    <TableCell>{r.createdAt}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
