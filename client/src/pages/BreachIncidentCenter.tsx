import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AlertTriangle, Clock, CheckCircle, XCircle, Plus, RefreshCw, Shield } from "lucide-react";

const STATUS_COLORS: Record<string,string> = { detected:"bg-red-100 text-red-800", assessing:"bg-orange-100 text-orange-800", ndpc_notified:"bg-blue-100 text-blue-800", individuals_notified:"bg-purple-100 text-purple-800", contained:"bg-yellow-100 text-yellow-800", resolved:"bg-green-100 text-green-800", closed:"bg-muted text-foreground" };
const SEV_COLORS: Record<string,string> = { low:"bg-green-100 text-green-800", medium:"bg-yellow-100 text-yellow-800", high:"bg-orange-100 text-orange-800", critical:"bg-red-100 text-red-800" };

export default function BreachIncidentCenter() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sevFilter, setSevFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ organizationId:"", title:"", description:"", severity:"medium", affectedIndividualsCount:"0", breachCause:"" });
  const { data: stats } = trpc.breachIncidents.stats.useQuery();
  const { data: list, refetch } = trpc.breachIncidents.list.useQuery({ page, limit:20, status: statusFilter!=="all"?statusFilter:undefined, severity: sevFilter!=="all"?sevFilter:undefined });
  const orgs = trpc.organizations.list.useQuery({ limit:200 }).data ?? [];
  const createM = trpc.breachIncidents.create.useMutation({ onSuccess:()=>{ toast.success("Breach reported — 72h timer started"); setOpen(false); refetch(); }, onError:(e)=>toast.error((e instanceof Error ? e.message : String(e))) });
  const updateM = trpc.breachIncidents.updateStatus.useMutation({ onSuccess:()=>{ toast.success("Status updated"); refetch(); }, onError:(e)=>toast.error((e instanceof Error ? e.message : String(e))) });
  const fmtH = (h:number) => h<0?`${Math.abs(Math.round(h))}h overdue`:h<1?`${Math.round(h*60)}m left`:`${Math.round(h)}h left`;
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Breach Incident Center</h1><p className="text-muted-foreground text-sm">NDPA 2023 Art. 40 — 72-hour NDPC notification tracker</p></div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={()=>refetch()}><RefreshCw className="h-4 w-4 mr-1"/>Refresh</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1"/>Report Breach</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Report New Breach Incident</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Organization</Label><Select onValueChange={v=>setForm(f=>({...f,organizationId:v}))}><SelectTrigger><SelectValue placeholder="Select org"/></SelectTrigger><SelectContent>{orgs.map((o:any)=><SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Title</Label><Input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g., Unauthorized DB access"/></div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Severity</Label><Select value={form.severity} onValueChange={v=>setForm(f=>({...f,severity:v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["low","medium","high","critical"].map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label>Affected Individuals</Label><Input type="number" value={form.affectedIndividualsCount} onChange={e=>setForm(f=>({...f,affectedIndividualsCount:e.target.value}))}/></div>
                </div>
                <div><Label>Breach Cause</Label><Input value={form.breachCause} onChange={e=>setForm(f=>({...f,breachCause:e.target.value}))} placeholder="e.g., Phishing attack"/></div>
                <Button className="w-full" disabled={!form.organizationId||!form.title||createM.isPending} onClick={()=>createM.mutate({ organizationId:parseInt(form.organizationId), title:form.title, description:form.description, severity:form.severity as any, affectedIndividualsCount:parseInt(form.affectedIndividualsCount)||0, breachCause:form.breachCause })}>{createM.isPending?"Creating...":"Create & Start 72h Timer"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[{l:"Total",v:stats?.total??0,I:Shield,c:"text-blue-600"},{l:"Active",v:stats?.active??0,I:AlertTriangle,c:"text-orange-600"},{l:"Critical",v:stats?.critical??0,I:XCircle,c:"text-red-600"},{l:"Overdue",v:stats?.overdue_notifications??0,I:Clock,c:"text-red-600"},{l:"Notified",v:stats?.notified??0,I:CheckCircle,c:"text-green-600"}].map(({l,v,I,c})=>(
          <Card key={l}><CardContent className="pt-4"><div className="flex items-center gap-2"><I className={`h-5 w-5 ${c}`}/><div><p className="text-xs text-muted-foreground">{l}</p><p className="text-xl font-bold">{v}</p></div></div></CardContent></Card>
        ))}
      </div>
      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-44"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem>{["detected","assessing","ndpc_notified","individuals_notified","contained","resolved","closed"].map(s=><SelectItem key={s} value={s}>{s.replace(/_/g," ")}</SelectItem>)}</SelectContent></Select>
        <Select value={sevFilter} onValueChange={setSevFilter}><SelectTrigger className="w-36"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Severities</SelectItem>{["critical","high","medium","low"].map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
      </div>
      <Card><CardHeader><CardTitle>Incidents ({list?.total??0})</CardTitle></CardHeader><CardContent>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="border-b text-muted-foreground text-left"><th className="pb-2 pr-3">Title</th><th className="pb-2 pr-3">Org</th><th className="pb-2 pr-3">Severity</th><th className="pb-2 pr-3">Status</th><th className="pb-2 pr-3">Affected</th><th className="pb-2 pr-3">Timer</th><th className="pb-2">Action</th></tr></thead>
          <tbody>{(list?.data??[]).map((b:any)=>{
            const hrs=parseFloat(b.hours_remaining??'0');
            const tc=hrs<0?"text-red-600 font-bold":hrs<12?"text-orange-600":"text-green-600";
            return(<tr key={b.id} className="border-b hover:bg-muted/30">
              <td className="py-2 pr-3 font-medium max-w-40 truncate">{b.title}</td>
              <td className="py-2 pr-3 text-xs text-muted-foreground">{b.org_name??'—'}</td>
              <td className="py-2 pr-3"><Badge className={SEV_COLORS[b.breach_incident_severity]??''}>{b.breach_incident_severity}</Badge></td>
              <td className="py-2 pr-3"><Badge className={STATUS_COLORS[b.breach_incident_status]??''}>{b.breach_incident_status?.replace(/_/g,' ')}</Badge></td>
              <td className="py-2 pr-3">{(b.affected_individuals_count??0).toLocaleString()}</td>
              <td className={`py-2 pr-3 text-xs ${tc}`}>{b.ndpc_notified_at?"✓ Notified":fmtH(hrs)}</td>
              <td className="py-2"><Select onValueChange={v=>updateM.mutate({id:b.id,status:v as any})}><SelectTrigger className="h-7 w-32 text-xs"><SelectValue placeholder="Update..."/></SelectTrigger><SelectContent>{["assessing","ndpc_notified","individuals_notified","contained","resolved","closed"].map(s=><SelectItem key={s} value={s}>{s.replace(/_/g,' ')}</SelectItem>)}</SelectContent></Select></td>
            </tr>);
          })}</tbody>
        </table></div>
        <div className="flex justify-between mt-4"><p className="text-sm text-muted-foreground">Page {page}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page===1} onClick={()=>setPage(p=>p-1)}>Prev</Button><Button variant="outline" size="sm" disabled={(list?.data?.length??0)<20} onClick={()=>setPage(p=>p+1)}>Next</Button></div></div>
      </CardContent></Card>
    </div>
  );
}
