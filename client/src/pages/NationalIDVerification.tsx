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
import { CreditCard, Search, CheckCircle, XCircle, Clock, Shield } from "lucide-react";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  verified: "bg-green-500/20 text-green-400",
  failed: "bg-red-500/20 text-red-400",
  pending: "bg-yellow-500/20 text-yellow-400",
  expired: "bg-slate-500/20 text-slate-400",
};

const EMPTY_FORM = {
  idType: "nin",
  idNumber: "",
  purpose: "kyc",
  fullName: "",
  dateOfBirth: "",
};

export default function NationalIDVerification() {
  const [showVerify, setShowVerify] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: verifications, refetch } = trpc.phase12.nationalId.list.useQuery();
  const { data: stats } = trpc.phase12.nationalId.getStats.useQuery();

  const verify = trpc.phase12.nationalId.verify.useMutation({
    onSuccess: (data: any) => {
      refetch();
      setShowVerify(false);
      setForm(EMPTY_FORM);
      if (data.status === "verified") {
        toast.success(`ID verified successfully — Ref: ${data.verificationRef}`);
      } else {
        toast.error(`Verification failed: ${data.failureReason}`);
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-cyan-400" /> National ID Verification
          </h1>
          <p className="text-slate-400 text-sm mt-1">NIMC NIN · BVN · CAC · Passport — Real-time identity verification via NIMC API</p>
        </div>
        <Button onClick={() => setShowVerify(true)} className="bg-cyan-600 hover:bg-cyan-700">
          <Shield className="w-4 h-4 mr-2" /> Verify Identity
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <p className="text-slate-400 text-xs">Total Verifications</p>
            <p className="text-2xl font-bold text-white">{stats?.total ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-900/20 border-green-700/40">
          <CardContent className="p-4">
            <p className="text-green-400 text-xs">Verified</p>
            <p className="text-2xl font-bold text-green-300">{stats?.verified ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-red-900/20 border-red-700/40">
          <CardContent className="p-4">
            <p className="text-red-400 text-xs">Failed</p>
            <p className="text-2xl font-bold text-red-300">{stats?.failed ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-cyan-900/20 border-cyan-700/40">
          <CardContent className="p-4">
            <p className="text-cyan-400 text-xs">Success Rate</p>
            <p className="text-2xl font-bold text-cyan-300">{stats?.successRate ?? 0}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input className="pl-9 bg-slate-800 border-slate-600 text-white"
            placeholder="Search by name or ID number..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {/* Verifications Table */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader><CardTitle className="text-white text-base">Verification Log</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700">
                <TableHead className="text-slate-400">Reference</TableHead>
                <TableHead className="text-slate-400">ID Type</TableHead>
                <TableHead className="text-slate-400">Full Name</TableHead>
                <TableHead className="text-slate-400">Purpose</TableHead>
                <TableHead className="text-slate-400">Requested By</TableHead>
                <TableHead className="text-slate-400">Date</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-slate-400">Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {verifications?.map((v: any) => (
                <TableRow key={v.id} className="border-slate-700">
                  <TableCell className="text-white font-mono text-xs">{v.verification_ref}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-slate-600 text-slate-400 uppercase">{v.id_type}</Badge>
                  </TableCell>
                  <TableCell className="text-slate-300 text-sm">{v.full_name ?? "—"}</TableCell>
                  <TableCell className="text-slate-400 text-xs capitalize">{String(v.purpose ?? "").replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-slate-400 text-xs">{v.requested_by_org ?? "—"}</TableCell>
                  <TableCell className="text-slate-400 text-xs">
                    {v.created_at ? new Date(v.created_at).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[v.status ?? "pending"] ?? ""}>
                      {v.status === "verified" ? <CheckCircle className="w-3 h-3 mr-1 inline" /> : null}
                      {v.status === "failed" ? <XCircle className="w-3 h-3 mr-1 inline" /> : null}
                      {v.status === "pending" ? <Clock className="w-3 h-3 mr-1 inline" /> : null}
                      {v.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {v.confidence_score != null ? (
                      <div className="flex items-center gap-2">
                        <div className="w-12 bg-slate-700 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-cyan-500"
                            style={{ width: `${v.confidence_score}%` }} />
                        </div>
                        <span className="text-white text-xs">{v.confidence_score}%</span>
                      </div>
                    ) : <span className="text-slate-500 text-xs">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Verify Dialog */}
      <Dialog open={showVerify} onOpenChange={setShowVerify}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader><DialogTitle>Verify National Identity</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300 text-sm">ID Type</Label>
                <Select value={form.idType} onValueChange={v => setForm(f => ({ ...f, idType: v }))}>
                  <SelectTrigger className="mt-1 bg-slate-700 border-slate-600 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="nin">NIN (NIMC)</SelectItem>
                    <SelectItem value="bvn">BVN (CBN)</SelectItem>
                    <SelectItem value="passport">International Passport</SelectItem>
                    <SelectItem value="drivers_license">Driver's Licence</SelectItem>
                    <SelectItem value="voters_card">Voter's Card (INEC)</SelectItem>
                    <SelectItem value="cac">CAC Registration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300 text-sm">Purpose</Label>
                <Select value={form.purpose} onValueChange={v => setForm(f => ({ ...f, purpose: v }))}>
                  <SelectTrigger className="mt-1 bg-slate-700 border-slate-600 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="kyc">KYC/AML</SelectItem>
                    <SelectItem value="employment">Employment Verification</SelectItem>
                    <SelectItem value="financial_services">Financial Services</SelectItem>
                    <SelectItem value="government_services">Government Services</SelectItem>
                    <SelectItem value="healthcare">Healthcare</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-slate-300 text-sm">ID Number</Label>
              <Input className="mt-1 bg-slate-700 border-slate-600 text-white font-mono"
                placeholder="Enter ID number..."
                value={form.idNumber}
                onChange={e => setForm(f => ({ ...f, idNumber: e.target.value }))} />
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Full Name (for cross-check)</Label>
              <Input className="mt-1 bg-slate-700 border-slate-600 text-white" value={form.fullName}
                onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Date of Birth</Label>
              <Input type="date" className="mt-1 bg-slate-700 border-slate-600 text-white" value={form.dateOfBirth}
                onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-slate-600 text-slate-300" onClick={() => setShowVerify(false)}>Cancel</Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700"
              disabled={!form.idNumber || verify.isPending}
              onClick={() => verify.mutate({ orgId: 1, idType: form.idType as "bvn" | "nin" | "passport" | "drivers_license" | "voter_card", idValue: form.idNumber, purpose: form.purpose })}>
              {verify.isPending ? "Verifying..." : "Verify Identity"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
