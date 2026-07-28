import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const pools = [
  { id: 'POOL-CROP', name: 'Crop Takaful', icon: '🌾', members: 12857, contributions: 45000000, surplus: 33002625, premium: 3500, unit: '/season', shariaScore: 6 },
  { id: 'POOL-LIVESTOCK', name: 'Livestock IBLT', icon: '🐄', members: 5600, contributions: 28000000, surplus: 19500000, premium: 5000, unit: '/season', shariaScore: 6 },
  { id: 'POOL-MOTOR', name: 'Motor TP Takaful', icon: '🚗', members: 8125, contributions: 65000000, surplus: 30000000, premium: 8000, unit: '/year', shariaScore: 6 },
  { id: 'POOL-HEALTH', name: 'Hospi-Cash Takaful', icon: '🏥', members: 12000, contributions: 18000000, surplus: 12800000, premium: 1500, unit: '/month', shariaScore: 6 },
  { id: 'POOL-EDUCATION', name: 'Education Savings', icon: '📚', members: 7000, contributions: 35000000, surplus: 33000000, premium: 5000, unit: '/month', shariaScore: 6 },
  { id: 'POOL-HAJJ', name: 'Hajj/Umrah Travel', icon: '🕋', members: 1467, contributions: 22000000, surplus: 15200000, premium: 15000, unit: '/trip', shariaScore: 6 },
];

const shariaPrinciples = [
  'Tabarru (Donation) — voluntary contribution to mutual pool',
  'Wakala (Agency) — transparent management fee structure',
  'No Gharar — clear terms, no excessive uncertainty',
  'No Maysir — no gambling or speculative elements',
  'No Riba — interest-free investment of pool funds',
  'Surplus Distribution — equitable return to participants',
];

export default function TakafulProductsSuite() {
  const totalMembers = pools.reduce((s, p) => s + p.members, 0);
  const totalContributions = pools.reduce((s, p) => s + p.contributions, 0);
  const totalSurplus = pools.reduce((s, p) => s + p.surplus, 0);

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">🕌 Takaful Products Suite</h1>
          <p className="text-muted-foreground mt-1">Sharia-compliant mutual insurance with Tabarru, Wakala, and surplus distribution</p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-1">Port 8143</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6 text-center"><div className="text-3xl font-bold text-amber-500">6</div><div className="text-sm text-muted-foreground">Pools</div></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><div className="text-3xl font-bold text-emerald-500">{totalMembers.toLocaleString()}</div><div className="text-sm text-muted-foreground">Members</div></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><div className="text-3xl font-bold text-cyan-500">₦{(totalContributions / 1000000).toFixed(0)}M</div><div className="text-sm text-muted-foreground">Contributions</div></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><div className="text-3xl font-bold text-violet-500">₦{(totalSurplus / 1000000).toFixed(0)}M</div><div className="text-sm text-muted-foreground">Surplus</div></CardContent></Card>
      </div>

      <Tabs defaultValue="pools">
        <TabsList>
          <TabsTrigger value="pools">Pools (6)</TabsTrigger>
          <TabsTrigger value="surplus">Surplus Distribution</TabsTrigger>
          <TabsTrigger value="sharia">Sharia Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="pools" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pools.map((p) => (
              <Card key={p.id} className="hover:shadow-lg transition-all">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className="text-2xl">{p.icon}</span>
                    {p.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Pool ID</span><Badge variant="outline">{p.id}</Badge></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Members</span><span className="font-semibold">{p.members.toLocaleString()}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Contributions</span><span className="font-semibold text-emerald-600">₦{(p.contributions / 1000000).toFixed(0)}M</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Surplus</span><span className="font-semibold text-amber-600">₦{(p.surplus / 1000000).toFixed(1)}M</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Premium</span><span className="font-semibold">₦{p.premium.toLocaleString()}{p.unit}</span></div>
                    <div className="flex items-center gap-1 mt-2">
                      <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">Sharia: {p.shariaScore}/6</Badge>
                      <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">Board Approved</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="surplus" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Surplus Distribution by Pool</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pools.map((p) => {
                  const perMember = p.surplus / p.members;
                  const surplusRatio = (p.surplus / p.contributions) * 100;
                  return (
                    <div key={p.id} className="p-4 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">{p.icon} {p.name}</span>
                        <Badge variant="outline">{p.members.toLocaleString()} members</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div><span className="text-muted-foreground">Total Surplus</span><div className="font-bold text-amber-600">₦{(p.surplus / 1000000).toFixed(1)}M</div></div>
                        <div><span className="text-muted-foreground">Per Member</span><div className="font-bold text-emerald-600">₦{perMember.toFixed(2)}</div></div>
                        <div><span className="text-muted-foreground">Surplus Ratio</span><div className="font-bold text-violet-600">{surplusRatio.toFixed(1)}%</div></div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div className="h-2 rounded-full bg-amber-500" style={{ width: `${surplusRatio}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sharia" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Sharia Compliance Principles</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {shariaPrinciples.map((principle, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm">{i + 1}</div>
                    <span className="text-sm">{principle}</span>
                    <Badge variant="secondary" className="ml-auto bg-green-100 text-green-800">Compliant</Badge>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-4 rounded-lg bg-amber-50 border border-amber-200">
                <div className="font-semibold text-amber-800">All pools: 6/6 principles met — Board Approved</div>
                <div className="text-sm text-amber-600 mt-1">Reviewed by Sharia Advisory Board, certified by AAOIFI standards</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
