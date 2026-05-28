/**
 * AICopilot.tsx
 * Streaming LLM chat with O&G domain context, tool-calling for well data queries
 * Uses the AIChatBox component for the chat interface
 */
import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Bot, Send, User, Trash2, Plus, Zap, RefreshCw, MessageSquare } from "lucide-react";
import { Streamdown } from "streamdown";

const WELL_OPTIONS = [
  { id: "", name: "No specific well (general Q&A)" },
  { id: "W-001", name: "Al-Burgan-01" },
  { id: "W-002", name: "Al-Burgan-02" },
  { id: "W-003", name: "Raudhatain-01" },
  { id: "W-004", name: "Sabriyah-01" },
  { id: "W-005", name: "Minagish-01" },
];

const QUICK_PROMPTS = [
  "What is the Turner critical velocity for a gas well producing 5 MMscf/d through 2-7/8\" tubing at 1200 psia THP?",
  "Explain the Havlena-Odeh material balance method and when to use it vs. volumetric methods.",
  "What are the key indicators of sand production onset in a weakly consolidated sandstone reservoir?",
  "Compare SAGD vs. CSS thermal recovery methods for heavy oil reservoirs with 12° API gravity.",
  "How do I interpret a pressure buildup test showing a dual-porosity response?",
  "What is the recommended mud weight window for a well with 0.45 psi/ft pore pressure and 0.85 psi/ft fracture gradient?",
  "Explain the Beggs-Brill correlation for multiphase flow in inclined tubing.",
  "What are the EPA Form 7C reporting requirements for offshore produced water discharge?",
];

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function AICopilot() {
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const [contextWellId, setContextWellId] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm your **Oil & Gas Production Engineering AI Co-Pilot**.\n\nI have deep expertise in:\n- **Well performance**: IPR/VLP nodal analysis, ESP optimization, artificial lift\n- **Reservoir engineering**: Decline curve analysis, material balance, pressure transient analysis\n- **Flow assurance**: Liquid loading, sand production, wax/hydrate management\n- **Geomechanics**: Wellbore stability, mud weight window, sand onset prediction\n- **Thermal recovery**: SAGD, CSS, steam flooding for heavy oil\n- **Regulatory compliance**: EPA, BSEE, OSPAR produced water reporting\n\nSelect a well for context-aware analysis, or ask any O&G engineering question.",
      timestamp: new Date(),
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.aiCopilot.chat.useMutation({
    onSuccess: (data) => {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      }]);
    },
    onError: (err) => {
      toast.error(`AI error: ${err.message}`);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `I encountered an error: ${err.message}. Please try again.`,
        timestamp: new Date(),
      }]);
    },
  });

  const deleteSessionMutation = trpc.aiCopilot.deleteSession.useMutation({
    onSuccess: () => {
      setMessages([{
        role: "assistant",
        content: "Session cleared. How can I help you?",
        timestamp: new Date(),
      }]);
      toast.success("Session cleared");
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (text?: string) => {
    const msg = text ?? input.trim();
    if (!msg) return;

    setMessages(prev => [...prev, { role: "user", content: msg, timestamp: new Date() }]);
    setInput("");

    chatMutation.mutate({
      message: msg,
      sessionId,
      contextWellId: contextWellId || undefined,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-4 md:p-6 bg-slate-950 min-h-screen text-white flex flex-col" style={{ height: "calc(100vh - 64px)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bot className="w-6 h-6 text-violet-400" />
            AI Co-Pilot
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Expert O&G production engineering assistant · GPT-4o · Domain-grounded
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={contextWellId} onValueChange={setContextWellId}>
            <SelectTrigger className="bg-slate-800 border-slate-600 text-white w-56">
              <SelectValue placeholder="Select well context..." />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600">
              {WELL_OPTIONS.map(w => (
                <SelectItem key={w.id} value={w.id} className="text-white">{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => deleteSessionMutation.mutate({ sessionId })}
            className="border-slate-600 text-slate-400 hover:bg-slate-800"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        {/* Quick Prompts Sidebar */}
        <div className="w-64 shrink-0 hidden xl:flex flex-col gap-2">
          <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Quick Prompts</div>
          <ScrollArea className="flex-1">
            <div className="space-y-2 pr-2">
              {QUICK_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(prompt)}
                  className="w-full text-left text-xs text-slate-400 hover:text-white p-2 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-violet-500/40 hover:bg-slate-800/60 transition-colors"
                >
                  <Zap className="w-3 h-3 inline mr-1 text-violet-400" />
                  {prompt.slice(0, 80)}...
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-h-0">
          <Card className="flex-1 bg-slate-900/60 border-slate-700 flex flex-col min-h-0">
            <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === "assistant" ? "bg-violet-600" : "bg-slate-700"}`}>
                      {msg.role === "assistant" ? <Bot className="w-4 h-4 text-white" /> : <User className="w-4 h-4 text-white" />}
                    </div>
                    <div className={`max-w-[80%] rounded-xl px-4 py-3 ${msg.role === "assistant" ? "bg-slate-800/80 border border-slate-700 text-slate-200" : "bg-violet-600/20 border border-violet-500/30 text-white"}`}>
                      {msg.role === "assistant" ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                          <Streamdown>{msg.content}</Streamdown>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      )}
                      <div className="text-xs text-slate-500 mt-2">
                        {msg.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
                {chatMutation.isPending && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-2 text-slate-400 text-sm">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Analyzing...
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t border-slate-700 shrink-0">
              {contextWellId && (
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-xs border-violet-500/40 text-violet-400">
                    Context: {WELL_OPTIONS.find(w => w.id === contextWellId)?.name}
                  </Badge>
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask any O&G engineering question... (Enter to send)"
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                  disabled={chatMutation.isPending}
                />
                <Button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || chatMutation.isPending}
                  className="bg-violet-600 hover:bg-violet-700 text-white shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <div className="text-xs text-slate-500 mt-2">
                Powered by GPT-4o · Grounded in SPE, API, ISO standards · Not a substitute for qualified engineering judgment
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
