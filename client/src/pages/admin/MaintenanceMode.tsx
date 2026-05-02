import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wrench, Plus, Power, Trash2 } from "lucide-react";

const mockWindows = [
  { id: 1, title: "Database Migration", mode: "scheduled", scheduledStart: "2026-05-10 02:00", scheduledEnd: "2026-05-10 04:00", affectedServices: "All services", adminBypass: true },
  { id: 2, title: "Security Patch Deployment", mode: "off", scheduledStart: "2026-04-28 01:00", scheduledEnd: "2026-04-28 02:00", affectedServices: "API Gateway", adminBypass: true },
];

export default function MaintenanceMode() {
  const [isActive, setIsActive] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><Wrench className="h-8 w-8" /> Maintenance Mode</h1>
            <p className="text-muted-foreground mt-1">Schedule and manage platform maintenance windows</p>
          </div>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Schedule Maintenance</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Schedule Maintenance Window</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Title" />
                <Textarea placeholder="Description of maintenance work" />
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-sm">Start Time</label><Input type="datetime-local" /></div>
                  <div><label className="text-sm">End Time</label><Input type="datetime-local" /></div>
                </div>
                <Input placeholder="Affected services (comma-separated)" />
                <Textarea placeholder="Custom maintenance message for users" />
                <div className="flex items-center gap-2"><Switch defaultChecked /><span className="text-sm">Allow admin bypass</span></div>
                <Button className="w-full" onClick={() => setShowCreate(false)}>Schedule</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card className={isActive ? "border-red-500 bg-red-50" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{isActive ? "Maintenance Mode is ACTIVE" : "Maintenance Mode is OFF"}</h3>
                <p className="text-sm text-muted-foreground">{isActive ? "The platform is currently in maintenance mode. Users will see the maintenance page." : "The platform is operating normally."}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={isActive ? "destructive" : "secondary"}>{isActive ? "ACTIVE" : "OFF"}</Badge>
                <Button variant={isActive ? "destructive" : "default"} onClick={() => setIsActive(!isActive)}>
                  <Power className="mr-2 h-4 w-4" />{isActive ? "Deactivate" : "Activate Now"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Scheduled Windows</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Title</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead><TableHead>Services</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {mockWindows.map(w => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{w.title}</TableCell>
                    <TableCell>{w.scheduledStart}</TableCell>
                    <TableCell>{w.scheduledEnd}</TableCell>
                    <TableCell>{w.affectedServices}</TableCell>
                    <TableCell><Badge variant={w.mode === "scheduled" ? "secondary" : "outline"}>{w.mode}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm"><Power className="h-3 w-3" /></Button>
                        <Button variant="outline" size="sm" className="text-red-600"><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </TableCell>
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
