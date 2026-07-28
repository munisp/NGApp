import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

const products = [
  { id: 'PPD-001', name: 'Pay-Per-Day Motor', icon: '🚘', type: 'on-demand', coverage: 2000000, premium: 350, unit: '/day', desc: 'Activate/deactivate daily motor insurance via app. Only pay for days you drive.' },
  { id: 'GIG-001', name: 'Gig Worker On-Demand', icon: '🏍️', type: 'on-demand', coverage: 500000, premium: 150, unit: '/trip', desc: 'Per-trip accident cover for delivery riders — auto-activates when online.' },
  { id: 'CYB-001', name: 'SME Cyber Shield', icon: '🔒', type: 'cyber', coverage: 0, premium: 25000, unit: '/year', desc: 'AI-powered cyber risk assessment for SMEs — scores vulnerability, recommends protection.' },
  { id: 'PET-001', name: 'Pet Insurance', icon: '🐾', type: 'pet', coverage: 500000, premium: 2000, unit: '/month', desc: 'Comprehensive veterinary coverage for dogs and cats — accidents, illness, surgery.' },
  { id: 'NOM-001', name: 'Digital Nomad Travel', icon: '✈️', type: 'travel', coverage: 5000000, premium: 8500, unit: '/month', desc: 'Multi-country travel insurance for remote workers — medical, equipment, liability.' },
  { id: 'SUB-001', name: 'Subscription Motor', icon: '📅', type: 'subscription', coverage: 3000000, premium: 4500, unit: '/month', desc: 'Monthly subscription motor insurance — cancel anytime, usage-based pricing.' },
  { id: 'HOS-001', name: 'Hospi-Cash', icon: '🏥', type: 'health', coverage: 5000, premium: 1500, unit: '/month', desc: 'Daily cash benefit during hospitalization — ₦5,000/day paid directly. No receipts needed.' },
  { id: 'FUN-001', name: 'Funeral Insurance', icon: '⚰️', type: 'life', coverage: 500000, premium: 1000, unit: '/month', desc: 'Dignified funeral coverage with immediate payout on death notification.' },
];

const cyberAssessment = {
  business: 'FinStart Ltd',
  industry: 'Fintech',
  employees: 5,
  riskScore: 85,
  vulnerabilities: ['No dedicated IT staff', 'High-value financial data', 'Phishing risk', 'Ransomware exposure'],
  recommendation: 'Comprehensive Plan',
  premium: 75000,
};

export default function DigitalConsumerProducts() {
  const [activeProduct, setActiveProduct] = useState<string | null>(null);

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">📲 Digital Consumer Products</h1>
          <p className="text-muted-foreground mt-1">On-demand, flexible insurance for the digital economy — 8 products</p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-1">Port 8142</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6 text-center"><div className="text-3xl font-bold text-violet-500">8</div><div className="text-sm text-muted-foreground">Products</div></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><div className="text-3xl font-bold text-emerald-500">₦150</div><div className="text-sm text-muted-foreground">Min Premium</div></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><div className="text-3xl font-bold text-cyan-500">₦5M</div><div className="text-sm text-muted-foreground">Max Coverage</div></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><div className="text-3xl font-bold text-amber-500">4</div><div className="text-sm text-muted-foreground">Product Types</div></CardContent></Card>
      </div>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Products (8)</TabsTrigger>
          <TabsTrigger value="cyber">Cyber Risk Demo</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {products.map((p) => (
              <Card key={p.id} className="hover:shadow-lg transition-all cursor-pointer" onClick={() => setActiveProduct(p.id)}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <span className="text-2xl">{p.icon}</span>
                    {p.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-3">{p.desc}</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Type</span>
                      <Badge variant="outline" className="text-xs">{p.type}</Badge>
                    </div>
                    {p.coverage > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Coverage</span>
                        <span className="font-semibold text-emerald-600">₦{p.coverage.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Premium</span>
                      <span className="font-semibold text-amber-600">₦{p.premium.toLocaleString()}{p.unit}</span>
                    </div>
                  </div>
                  <Button size="sm" className="w-full mt-3" variant="outline">Activate</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="cyber" className="mt-4">
          <Card>
            <CardHeader><CardTitle>SME Cyber Risk Assessment Demo</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="p-4 rounded-lg border">
                    <div className="text-sm text-muted-foreground">Business</div>
                    <div className="font-bold text-lg">{cyberAssessment.business}</div>
                    <div className="text-sm">{cyberAssessment.industry} | {cyberAssessment.employees} employees</div>
                  </div>
                  <div className="p-4 rounded-lg border">
                    <div className="text-sm text-muted-foreground">Vulnerabilities Detected</div>
                    <ul className="mt-2 space-y-1">
                      {cyberAssessment.vulnerabilities.map((v, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <span className="w-2 h-2 rounded-full bg-red-500"></span>
                          {v}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="p-4 rounded-lg border text-center">
                    <div className="text-sm text-muted-foreground">Risk Score</div>
                    <div className="text-5xl font-bold text-red-500 my-2">{cyberAssessment.riskScore}/100</div>
                    <Badge variant="destructive">HIGH RISK</Badge>
                  </div>
                  <div className="p-4 rounded-lg border">
                    <div className="text-sm text-muted-foreground">Recommended Plan</div>
                    <div className="font-bold text-lg">{cyberAssessment.recommendation}</div>
                    <div className="text-2xl font-bold text-amber-600 mt-1">₦{cyberAssessment.premium.toLocaleString()}/year</div>
                    <Button className="w-full mt-3">Get Protected Now</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
