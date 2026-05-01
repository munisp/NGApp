import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Building2, Shield, AlertTriangle, Plus, Star, TrendingDown } from "lucide-react";
import { toast } from "sonner";

const riskColors: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-green-500/20 text-green-400 border-green-500/30",
};


type VendorType = "saas" | "cloud" | "data_processor" | "sub_processor" | "consulting";
const EMPTY_FORM = { vendorName: "", vendorType: "saas" as VendorType, country: "Nigeria", dataAccess: "none", contractRef: "" };

export default function VendorRisk() {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [riskFilter, setRiskFilter] = useState("all");

  const { data: vendors, refetch } = trpc.phase12.vendorRisk.list.useQuery({
    riskLevel: riskFilter !== "all" ? riskFilter : undefined,
  });
  const { data: stats } = trpc.phase12.vendorRisk.getStats.useQuery();

  const addVendor = trpc.phase12.vendorRisk.create.useMutation({
    onSuccess: () => { refetch(); setShowAdd(false); setForm(EMPTY_FORM); toast.success("Vendor added"); },
    onError: (e: any) => toast.error(e.message),
  });
  const scoreVendor = trpc.phase12.vendorRisk.update.useMutation({
    onSuccess: () => { refetch(); toast.success("Vendor scored"); },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Vendor Risk Management</h1>
          <p className="text-slate-400 text-sm mt-1">NDPA Third-Party Processor Due Diligence — Article 44 compliance</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" /> Add Vendor
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-red-900/20 border-red-700/40">
          <CardContent className="p-4">
            <p className="text-red-400 text-xs">High/Critical Risk</p>
            <p className="text-2xl font-bold text-red-300">{stats?.highRisk ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <p className="text-slate-400 text-xs">Total Vendors</p>
            <p className="text-2xl font-bold text-white">{stats?.total ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-900/20 border-green-700/40">
          <CardContent className="p-4">
            <p className="text-green-400 text-xs">DPA Signed</p>
            <p className="text-2xl font-bold text-green-300">{stats?.dpaSigned ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-900/20 border-amber-700/40">
          <CardContent className="p-4">
            <p className="text-amber-400 text-xs">Avg Risk Score</p>
            <p className="text-2xl font-bold text-amber-300">{stats?.avgScore ?? 0}/100</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="bg-slate-800 border-slate-600 text-white w-44">
            <SelectValue placeholder="All Risk Levels" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all">All Risk Levels</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700">
                <TableHead className="text-slate-400">Vendor</TableHead>
                <TableHead className="text-slate-400">Type</TableHead>
                <TableHead className="text-slate-400">Country</TableHead>
                <TableHead className="text-slate-400">Data Access</TableHead>
                <TableHead className="text-slate-400">DPA</TableHead>
                <TableHead className="text-slate-400">Risk Score</TableHead>
                <TableHead className="text-slate-400">Risk Level</TableHead>
                <TableHead className="text-slate-400">Last Assessed</TableHead>
                <TableHead className="text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors?.map(v => (
                <TableRow key={v.id} className="border-slate-700">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-white text-sm font-medium">{v.vendor_name}</p>
                        <p className="text-slate-500 text-xs">{v.contract_ref}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="border-slate-600 text-slate-400 capitalize">{v.vendor_type}</Badge></TableCell>
                  <TableCell className="text-slate-400 text-sm">{v.country}</TableCell>
                  <TableCell>
                    <Badge className={v.data_access_level === "full" ? "bg-red-500/20 text-red-400" : v.data_access_level === "partial" ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-400"}>
                      {v.data_access_level}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {v.dpa_signed
                      ? <Badge className="bg-green-500/20 text-green-400">Signed</Badge>
                      : <Badge className="bg-red-500/20 text-red-400">Missing</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-700 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-gradient-to-r from-green-500 to-red-500"
                          style={{ width: `${v.risk_score ?? 0}%` }} />
                      </div>
                      <span className="text-white text-sm">{v.risk_score ?? 0}</span>
                    </div>
                  </TableCell>
                  <TableCell><Badge className={riskColors[v.risk_level ?? "medium"]}>{v.risk_level}</Badge></TableCell>
                  <TableCell className="text-slate-400 text-xs">
                    {v.last_assessed_at ? new Date(v.last_assessed_at).toLocaleDateString() : "Never"}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-blue-400"
                      onClick={() => scoreVendor.mutate({ id: v.id })}>
                      <Star className="w-3 h-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader><DialogTitle>Add Vendor</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-300 text-sm">Vendor Name</Label>
              <Input className="mt-1 bg-slate-700 border-slate-600 text-white" value={form.vendorName}
                onChange={e => setForm(f => ({ ...f, vendorName: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300 text-sm">Type</Label>
                <Select value={form.vendorType} onValueChange={v => setForm(f => ({ ...f, vendorType: v as VendorType }))}>
                  <SelectTrigger className="mt-1 bg-slate-700 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="saas">SaaS</SelectItem>
                    <SelectItem value="cloud">Cloud Provider</SelectItem>
                    <SelectItem value="consulting">Consulting</SelectItem>
                    <SelectItem value="fintech">Fintech</SelectItem>
                    <SelectItem value="telecom">Telecom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300 text-sm">Country</Label>
                <Input className="mt-1 bg-slate-700 border-slate-600 text-white" value={form.country}
                  onChange={e => setForm(f => ({ ...f, country: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Data Access Level</Label>
              <Select value={form.dataAccess} onValueChange={v => setForm(f => ({ ...f, dataAccess: v }))}>
                <SelectTrigger className="mt-1 bg-slate-700 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="metadata">Metadata Only</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="full">Full Access</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Contract Reference</Label>
              <Input className="mt-1 bg-slate-700 border-slate-600 text-white" value={form.contractRef}
                placeholder="e.g. CONTRACT-2024-001"
                onChange={e => setForm(f => ({ ...f, contractRef: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-slate-600 text-slate-300" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" disabled={!form.vendorName}
              onClick={() => addVendor.mutate(form)}>
              Add Vendor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
