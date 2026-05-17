import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

const classes = [
  { id: 'NIIRA-MTP', name: 'Motor Third-Party', icon: '🚗', section: 'Section 68', scope: 'All vehicles', premium: 15000, unit: '/year', isNew: false },
  { id: 'NIIRA-EL', name: "Employer's Liability", icon: '👷', section: 'Section 65', scope: '5+ employees', premium: 25000, unit: '/year', isNew: false },
  { id: 'NIIRA-BI', name: 'Building Insurance', icon: '🏢', section: 'Section 64', scope: 'All buildings', premium: 50000, unit: '/year', isNew: false },
  { id: 'NIIRA-PI', name: 'Professional Indemnity', icon: '⚕️', section: 'Section 66', scope: 'Professionals', premium: 35000, unit: '/year', isNew: false },
  { id: 'NIIRA-PL', name: 'Product Liability', icon: '📦', section: 'Section 67', scope: 'Manufacturers', premium: 40000, unit: '/year', isNew: true },
  { id: 'NIIRA-HPI', name: 'Healthcare Professional Indemnity', icon: '🏥', section: 'Section 69', scope: 'Healthcare', premium: 45000, unit: '/year', isNew: true },
  { id: 'NIIRA-MC', name: 'Marine Cargo', icon: '🚢', section: 'Section 70', scope: 'Importers', premium: 30000, unit: '/shipment', isNew: false },
  { id: 'NIIRA-PUB', name: 'Public Liability', icon: '🏪', section: 'Section 71', scope: 'Public venues', premium: 20000, unit: '/year', isNew: false },
  { id: 'NIIRA-GL', name: 'Group Life', icon: '👥', section: 'Section 72', scope: '3+ staff', premium: 10000, unit: '/employee/year', isNew: false },
  { id: 'NIIRA-OL', name: "Occupier's Liability", icon: '🏠', section: 'Section 73', scope: 'Occupiers', premium: 15000, unit: '/year', isNew: true },
  { id: 'NIIRA-CAR', name: 'Contractors All Risk', icon: '🏗️', section: 'Section 74', scope: 'Contractors', premium: 60000, unit: '/project', isNew: true },
];

const complianceChecks = [
  { type: 'Hospital', employees: 20, required: ['Motor TP', 'Employer Liability', 'Building', 'Healthcare PI', 'Public Liability', "Occupier's Liability", 'Group Life'], compliant: 1, total: 7, premium: 155000 },
  { type: 'Law Firm', employees: 8, required: ['Motor TP', 'Employer Liability', 'Professional PI', 'Group Life'], compliant: 2, total: 4, premium: 85000 },
  { type: 'Manufacturer', employees: 50, required: ['Motor TP', 'Employer Liability', 'Building', 'Product Liability', 'Public Liability', 'Group Life'], compliant: 3, total: 6, premium: 160000 },
];

export default function NIIRACompulsoryInsurance() {
  const [selectedCheck, setSelectedCheck] = useState(0);

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">⚖️ NIIRA 2025 Compulsory Insurance</h1>
          <p className="text-muted-foreground mt-1">Nigerian Insurance Industry Reform Act 2025 — expanded to 11 compulsory classes</p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-1">Port 8144</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6 text-center"><div className="text-3xl font-bold text-red-500">11</div><div className="text-sm text-muted-foreground">Classes</div></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><div className="text-3xl font-bold text-amber-500">4</div><div className="text-sm text-muted-foreground">New Classes</div></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><div className="text-3xl font-bold text-emerald-500">Jul 2026</div><div className="text-sm text-muted-foreground">Deadline</div></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><div className="text-3xl font-bold text-violet-500">NAICOM</div><div className="text-sm text-muted-foreground">Regulator</div></CardContent></Card>
      </div>

      <Tabs defaultValue="classes">
        <TabsList>
          <TabsTrigger value="classes">Classes (11)</TabsTrigger>
          <TabsTrigger value="compliance">Compliance Check</TabsTrigger>
        </TabsList>

        <TabsContent value="classes" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map((c) => (
              <Card key={c.id} className="hover:shadow-lg transition-all">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className="text-2xl">{c.icon}</span>
                    {c.name}
                    {c.isNew && <Badge variant="destructive" className="text-xs">NEW</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Section</span><Badge variant="outline">{c.section}</Badge></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Scope</span><span className="font-medium">{c.scope}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Premium</span><span className="font-semibold text-amber-600">₦{c.premium.toLocaleString()}{c.unit}</span></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="compliance" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {complianceChecks.map((check, i) => (
              <Card key={i} className={`cursor-pointer transition-all ${selectedCheck === i ? 'ring-2 ring-primary' : ''}`} onClick={() => setSelectedCheck(i)}>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-lg font-bold">{check.type}</div>
                    <div className="text-sm text-muted-foreground">{check.employees} employees</div>
                    <div className="mt-2">
                      <Badge variant={check.compliant === check.total ? 'default' : 'destructive'}>
                        {check.compliant}/{check.total} classes covered
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Compliance Report — {complianceChecks[selectedCheck].type}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                  <div className="font-bold text-red-800">NOT COMPLIANT — {complianceChecks[selectedCheck].total - complianceChecks[selectedCheck].compliant} classes missing</div>
                  <div className="text-sm text-red-600 mt-1">Deadline: July 30, 2026</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {complianceChecks[selectedCheck].required.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded border text-sm">
                      <span className={`w-3 h-3 rounded-full ${i < complianceChecks[selectedCheck].compliant ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      {r}
                      <Badge variant={i < complianceChecks[selectedCheck].compliant ? 'secondary' : 'destructive'} className="ml-auto text-xs">
                        {i < complianceChecks[selectedCheck].compliant ? 'Covered' : 'Missing'}
                      </Badge>
                    </div>
                  ))}
                </div>
                <div className="p-4 rounded-lg border mt-4">
                  <div className="text-sm text-muted-foreground">Estimated Total Premium</div>
                  <div className="text-2xl font-bold text-amber-600">₦{complianceChecks[selectedCheck].premium.toLocaleString()}/year</div>
                  <Button className="mt-3">Get Compliant Now</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
