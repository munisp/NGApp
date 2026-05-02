import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ShieldCheck, ShieldAlert, Ban, Key, Plus, Trash2, Lock, AlertTriangle } from "lucide-react";

const mockSecurityScore = { score: 87, grade: "B", criticalEvents: 0, highEvents: 2, blockedIps: 15, activePolicies: 12 };
const mockEvents = [
  { id: 1, eventType: "brute_force", severity: "high", sourceIp: "45.33.32.156", description: "Multiple failed login attempts detected", isBlocked: true, detectedAt: "2026-05-02 13:45" },
  { id: 2, eventType: "sql_injection", severity: "critical", sourceIp: "185.220.101.45", description: "SQL injection attempt on /api/search", isBlocked: true, detectedAt: "2026-05-02 12:30" },
  { id: 3, eventType: "rate_limit_exceeded", severity: "medium", sourceIp: "41.58.120.33", description: "API rate limit exceeded by 300%", isBlocked: false, detectedAt: "2026-05-02 11:15" },
];
const mockBlockedIps = [
  { id: 1, ipAddress: "45.33.32.156", reason: "Brute force attack", blockedBy: "system", hitCount: 1520, createdAt: "2026-05-02" },
  { id: 2, ipAddress: "185.220.101.45", reason: "SQL injection attempts", blockedBy: "system", hitCount: 340, createdAt: "2026-05-02" },
  { id: 3, ipAddress: "91.108.4.0/24", reason: "Known botnet range", blockedBy: "admin", hitCount: 8900, createdAt: "2026-04-28" },
];
const mockPolicies = [
  { id: 1, name: "Admin Full Access", resource: "*", action: "execute", effect: "allow", priority: 100, isActive: true },
  { id: 2, name: "User Read Transactions", resource: "transactions", action: "read", effect: "allow", priority: 50, isActive: true },
  { id: 3, name: "Merchant Manage Products", resource: "products", action: "update", effect: "allow", priority: 50, isActive: true },
  { id: 4, name: "Block Compliance Export", resource: "compliance_reports", action: "delete", effect: "deny", priority: 90, isActive: true },
];

const severityColors: Record<string, string> = { critical: "bg-red-100 text-red-800", high: "bg-orange-100 text-orange-800", medium: "bg-yellow-100 text-yellow-800", low: "bg-blue-100 text-blue-800" };

export default function SecurityDashboard() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><ShieldCheck className="h-8 w-8" /> Security Dashboard</h1>
          <p className="text-muted-foreground mt-1">Monitor threats, manage access policies, and protect the platform</p>
        </div>

        <div className="grid grid-cols-5 gap-4">
          <Card className="col-span-2">
            <CardContent className="pt-6 text-center">
              <div className={`text-6xl font-bold ${mockSecurityScore.score >= 80 ? "text-green-600" : mockSecurityScore.score >= 60 ? "text-yellow-600" : "text-red-600"}`}>{mockSecurityScore.grade}</div>
              <Progress value={mockSecurityScore.score} className="h-3 mt-4" />
              <p className="text-lg font-medium mt-2">Security Score: {mockSecurityScore.score}/100</p>
            </CardContent>
          </Card>
          <Card><CardContent className="pt-6"><ShieldAlert className="h-6 w-6 text-red-600 mb-2" /><div className="text-2xl font-bold">{mockSecurityScore.criticalEvents}</div><p className="text-sm text-muted-foreground">Critical Events</p></CardContent></Card>
          <Card><CardContent className="pt-6"><Ban className="h-6 w-6 text-orange-600 mb-2" /><div className="text-2xl font-bold">{mockSecurityScore.blockedIps}</div><p className="text-sm text-muted-foreground">Blocked IPs</p></CardContent></Card>
          <Card><CardContent className="pt-6"><Key className="h-6 w-6 text-blue-600 mb-2" /><div className="text-2xl font-bold">{mockSecurityScore.activePolicies}</div><p className="text-sm text-muted-foreground">Active Policies</p></CardContent></Card>
        </div>

        <Tabs defaultValue="events">
          <TabsList><TabsTrigger value="events">Security Events</TabsTrigger><TabsTrigger value="blocklist">IP Blocklist</TabsTrigger><TabsTrigger value="pbac">PBAC Policies</TabsTrigger><TabsTrigger value="ratelimits">Rate Limits</TabsTrigger></TabsList>

          <TabsContent value="events">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Recent Security Events</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Type</TableHead><TableHead>Severity</TableHead><TableHead>Source IP</TableHead><TableHead>Description</TableHead><TableHead>Blocked</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {mockEvents.map(e => (
                      <TableRow key={e.id}>
                        <TableCell className="text-sm">{e.detectedAt}</TableCell>
                        <TableCell><Badge variant="outline">{e.eventType.replace(/_/g, " ")}</Badge></TableCell>
                        <TableCell><Badge className={severityColors[e.severity]}>{e.severity}</Badge></TableCell>
                        <TableCell className="font-mono text-sm">{e.sourceIp}</TableCell>
                        <TableCell>{e.description}</TableCell>
                        <TableCell>{e.isBlocked ? <Badge variant="destructive">Blocked</Badge> : <Badge variant="secondary">Monitored</Badge>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="blocklist">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2"><Ban className="h-5 w-5" /> IP Blocklist</CardTitle>
                  <Dialog><DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-3 w-3" /> Block IP</Button></DialogTrigger>
                    <DialogContent><DialogHeader><DialogTitle>Block IP Address</DialogTitle></DialogHeader>
                      <div className="space-y-4"><Input placeholder="IP address or CIDR range" /><Input placeholder="Reason" /><Input type="datetime-local" /><Button className="w-full">Block</Button></div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>IP Address</TableHead><TableHead>Reason</TableHead><TableHead>Blocked By</TableHead><TableHead>Hit Count</TableHead><TableHead>Date</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {mockBlockedIps.map(ip => (
                      <TableRow key={ip.id}>
                        <TableCell className="font-mono">{ip.ipAddress}</TableCell>
                        <TableCell>{ip.reason}</TableCell>
                        <TableCell><Badge variant="outline">{ip.blockedBy}</Badge></TableCell>
                        <TableCell>{ip.hitCount.toLocaleString()}</TableCell>
                        <TableCell>{ip.createdAt}</TableCell>
                        <TableCell><Button variant="outline" size="sm" className="text-red-600"><Trash2 className="h-3 w-3" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pbac">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" /> Policy-Based Access Control</CardTitle>
                  <Button size="sm"><Plus className="mr-1 h-3 w-3" /> Add Policy</Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Resource</TableHead><TableHead>Action</TableHead><TableHead>Effect</TableHead><TableHead>Priority</TableHead><TableHead>Active</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {mockPolicies.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="font-mono text-sm">{p.resource}</TableCell>
                        <TableCell><Badge variant="outline">{p.action}</Badge></TableCell>
                        <TableCell><Badge variant={p.effect === "allow" ? "default" : "destructive"}>{p.effect}</Badge></TableCell>
                        <TableCell>{p.priority}</TableCell>
                        <TableCell><Badge variant={p.isActive ? "default" : "secondary"}>{p.isActive ? "Active" : "Disabled"}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ratelimits">
            <Card>
              <CardHeader><CardTitle>API Rate Limit Configuration</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { tier: "Standard", rpm: 60, rph: 1000, rpd: 10000 },
                    { tier: "Premium", rpm: 200, rph: 5000, rpd: 50000 },
                    { tier: "Enterprise", rpm: 1000, rph: 20000, rpd: 200000 },
                  ].map(t => (
                    <Card key={t.tier}>
                      <CardHeader><CardTitle className="text-lg">{t.tier}</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between"><span className="text-sm">Per Minute</span><span className="font-medium">{t.rpm}</span></div>
                        <div className="flex justify-between"><span className="text-sm">Per Hour</span><span className="font-medium">{t.rph.toLocaleString()}</span></div>
                        <div className="flex justify-between"><span className="text-sm">Per Day</span><span className="font-medium">{t.rpd.toLocaleString()}</span></div>
                        <Button variant="outline" size="sm" className="w-full mt-2">Edit</Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
