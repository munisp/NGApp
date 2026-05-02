import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Headphones, Plus, MessageSquare, Send, Paperclip } from "lucide-react";

const priorityColors: Record<string, string> = { low: "bg-gray-100 text-gray-800", medium: "bg-blue-100 text-blue-800", high: "bg-orange-100 text-orange-800", urgent: "bg-red-100 text-red-800" };
const statusColors: Record<string, string> = { open: "bg-yellow-100 text-yellow-800", in_progress: "bg-blue-100 text-blue-800", resolved: "bg-green-100 text-green-800", closed: "bg-gray-100 text-gray-800" };

const mockTickets = [
  { id: 1, subject: "Transfer delayed 3 days", status: "open", priority: "high", category: "transfers", createdAt: "2026-05-01", messages: 2 },
  { id: 2, subject: "Cannot verify my identity", status: "in_progress", priority: "medium", category: "kyc", createdAt: "2026-04-29", messages: 5 },
  { id: 3, subject: "Fee calculation seems wrong", status: "resolved", priority: "low", category: "billing", createdAt: "2026-04-25", messages: 3 },
];

const mockMessages = [
  { id: 1, sender: "You", message: "My transfer has been pending for 3 days. Transaction ID: TXN-1001. Can you please check?", time: "May 1, 10:30 AM", isUser: true },
  { id: 2, sender: "Support Agent", message: "Thank you for reaching out. I'm looking into this now. Could you please confirm the recipient's bank account number?", time: "May 1, 11:15 AM", isUser: false },
];

export default function SupportCenter() {
  const [selectedTicket, setSelectedTicket] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newMessage, setNewMessage] = useState("");

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><Headphones className="h-8 w-8" /> Support Center</h1>
            <p className="text-muted-foreground mt-1">Get help with transactions, account issues, and more</p>
          </div>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New Ticket</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Support Ticket</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Subject" />
                <Select><SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transfers">Transfers</SelectItem>
                    <SelectItem value="kyc">KYC/Verification</SelectItem>
                    <SelectItem value="billing">Billing/Fees</SelectItem>
                    <SelectItem value="technical">Technical Issue</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
                <Select><SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea placeholder="Describe your issue in detail..." rows={4} />
                <Button className="w-full" onClick={() => setShowCreate(false)}>Submit Ticket</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{mockTickets.length}</div><p className="text-sm text-muted-foreground">Total Tickets</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-yellow-600">{mockTickets.filter(t => t.status === "open").length}</div><p className="text-sm text-muted-foreground">Open</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-blue-600">{mockTickets.filter(t => t.status === "in_progress").length}</div><p className="text-sm text-muted-foreground">In Progress</p></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-green-600">{mockTickets.filter(t => t.status === "resolved").length}</div><p className="text-sm text-muted-foreground">Resolved</p></CardContent></Card>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <Card className="col-span-1">
            <CardHeader><CardTitle className="text-lg">Tickets</CardTitle></CardHeader>
            <CardContent className="p-0">
              {mockTickets.map(t => (
                <div key={t.id} className={`p-4 border-b cursor-pointer hover:bg-muted/50 ${selectedTicket === t.id ? "bg-muted" : ""}`} onClick={() => setSelectedTicket(t.id)}>
                  <div className="flex justify-between items-start">
                    <p className="font-medium text-sm">{t.subject}</p>
                    <Badge className={priorityColors[t.priority]} variant="outline">{t.priority}</Badge>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <Badge className={statusColors[t.status]} variant="outline">{t.status.replace(/_/g, " ")}</Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><MessageSquare className="h-3 w-3" />{t.messages}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="col-span-2">
            <CardHeader><CardTitle className="text-lg">{selectedTicket ? `Ticket #${selectedTicket}` : "Select a ticket"}</CardTitle></CardHeader>
            <CardContent>
              {selectedTicket ? (
                <div className="space-y-4">
                  <ScrollArea className="h-[300px] pr-4">
                    {mockMessages.map(m => (
                      <div key={m.id} className={`mb-4 ${m.isUser ? "text-right" : ""}`}>
                        <div className={`inline-block p-3 rounded-lg max-w-[80%] ${m.isUser ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          <p className="text-sm">{m.message}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{m.sender} · {m.time}</p>
                      </div>
                    ))}
                  </ScrollArea>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon"><Paperclip className="h-4 w-4" /></Button>
                    <Input placeholder="Type your message..." value={newMessage} onChange={e => setNewMessage(e.target.value)} className="flex-1" />
                    <Button><Send className="h-4 w-4" /></Button>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-12">Select a ticket from the list to view the conversation</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
