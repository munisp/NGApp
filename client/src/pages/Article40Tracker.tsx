import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Clock, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

const timerColor: Record<string,string> = { completed:"bg-green-100 text-green-800", on_track:"bg-blue-100 text-blue-800", warning:"bg-yellow-100 text-yellow-800", critical:"bg-orange-100 text-orange-800", overdue:"bg-red-100 text-red-800" };

export default function Article40Tracker() {
  const { data: timers, refetch } = trpc.article40Tracker.activeTimers.useQuery();
  const { data: sla } = trpc.article40Tracker.slaMetrics.useQuery();
  const notifyM = trpc.article40Tracker.notifyNdpc.useMutation({ onSuccess:(r)=>{ toast.success(`NDPC notified — Ref: ${r.referenceNumber}`); refetch(); }, onError:(e)=>toast.error((e instanceof Error ? e.message : String(e))) });
  const fmtH = (h:number) => h<0?`${Math.abs(Math.round(h))}h overdue`:h<1?`${Math.round(h*60)}m left`:`${Math.round(h)}h left`;
  const slaRate = sla ? Math.round((parseInt(sla.on_time??'0')/Math.max(1,parseInt(sla.notified??'0')))*100) : 0;
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3"><Clock className="h-7 w-7 text-primary"/><div><h1 className="text-2xl font-bold">NDPA Article 40 Tracker</h1><p className="text-muted-foreground text-sm">72-hour breach notification SLA monitoring — real-time countdown</p></div></div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[{l:"Total Breaches",v:sla?.total_breaches??0,I:AlertTriangle,c:"text-blue-600"},{l:"Notified",v:sla?.notified??0,I:CheckCircle,c:"text-green-600"},{l:"Overdue",v:sla?.overdue??0,I:XCircle,c:"text-red-600"},{l:"On-Time Rate",v:`${slaRate}%`,I:Clock,c:"text-green-600"},{l:"Avg Notify Time",v:`${Math.round(parseFloat(sla?.avg_notification_hours??'0'))}h`,I:Clock,c:"text-blue-600"}].map(({l,v,I,c})=>(
          <Card key={l}><CardContent className="pt-4"><div className="flex items-center gap-2"><I className={`h-4 w-4 ${c}`}/><div><p className="text-xs text-muted-foreground">{l}</p><p className="text-lg font-bold">{v}</p></div></div></CardContent></Card>
        ))}
      </div>
      <Card><CardHeader><CardTitle>Active 72-Hour Timers ({(timers??[]).length})</CardTitle></CardHeader><CardContent>
        <div className="space-y-3">
          {(timers??[]).map((b:any)=>{
            const hrs = parseFloat(b.hours_remaining??'0');
            return (
              <div key={b.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30">
                <div className="flex-1">
                  <div className="flex items-center gap-2"><p className="font-medium text-sm">{b.title}</p><Badge className={timerColor[b.timer_status]??''}>{b.timer_status?.replace(/_/g,' ')}</Badge></div>
                  <p className="text-xs text-muted-foreground">{b.org_name} · {b.sector} · Detected: {b.detected_at?new Date(b.detected_at).toLocaleString():''}</p>
                </div>
                <div className="text-right mr-4">
                  {b.ndpc_notified_at?<p className="text-green-600 text-sm font-semibold">✓ Notified</p>:<>
                    <p className={`text-sm font-bold ${hrs<0?"text-red-600":hrs<12?"text-orange-600":"text-blue-600"}`}>{fmtH(hrs)}</p>
                    <p className="text-xs text-muted-foreground">Deadline: {b.ndpc_notification_deadline?new Date(b.ndpc_notification_deadline).toLocaleString():''}</p>
                  </>}
                </div>
                {!b.ndpc_notified_at&&<Button size="sm" className="h-8" onClick={()=>notifyM.mutate({breachId:b.id})} disabled={notifyM.isPending}>Notify NDPC</Button>}
              </div>
            );
          })}
          {(timers??[]).length===0&&<p className="text-center text-muted-foreground py-8">No active breach timers</p>}
        </div>
      </CardContent></Card>
    </div>
  );
}
