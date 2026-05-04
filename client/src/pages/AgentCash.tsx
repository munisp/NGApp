import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, QrCode, Search, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function AgentCash() {
  const [lat, setLat] = useState("6.5244");
  const [lng, setLng] = useState("3.3792");
  const [provider, setProvider] = useState<string>("all");

  const agentsQuery = trpc.agentCash.findAgents.useQuery({
    latitude: parseFloat(lat),
    longitude: parseFloat(lng),
    provider: provider as any,
    limit: 20,
  });

  const statsQuery = trpc.agentCash.networkStats.useQuery();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agent Cash Pickup</h1>
          <p className="text-muted-foreground">Find nearby agents for cash collection</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Network Agents</p>
          <p className="text-2xl font-bold">{(statsQuery.data as any)?.totalAgents || 0}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Find Agents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input placeholder="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} />
            <Input placeholder="Longitude" value={lng} onChange={(e) => setLng(e.target.value)} />
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger>
                <SelectValue placeholder="All providers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                <SelectItem value="paga">Paga</SelectItem>
                <SelectItem value="opay">OPay</SelectItem>
                <SelectItem value="kudi">Kudi</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => {
                navigator.geolocation?.getCurrentPosition((pos) => {
                  setLat(String(pos.coords.latitude));
                  setLng(String(pos.coords.longitude));
                });
              }}
            >
              <MapPin className="h-4 w-4 mr-2" />
              Use My Location
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(agentsQuery.data || []).map((agent: any) => (
          <Card key={agent.agentId}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{agent.agentName}</h3>
                <Badge variant="outline">{agent.distance?.toFixed(1)} km</Badge>
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {agent.address}, {agent.city}
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {agent.operatingHours}
              </p>
              <div className="flex flex-wrap gap-1">
                {(agent.services || []).map((s: string) => (
                  <Badge key={s} variant="secondary" className="text-xs">{s.replace('_', ' ')}</Badge>
                ))}
              </div>
              <Button variant="outline" size="sm" className="w-full mt-2">
                <QrCode className="h-4 w-4 mr-2" />
                Generate Collection Code
              </Button>
            </CardContent>
          </Card>
        ))}
        {agentsQuery.data?.length === 0 && (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            No agents found nearby. Try adjusting your location or provider filter.
          </div>
        )}
      </div>
    </div>
  );
}
