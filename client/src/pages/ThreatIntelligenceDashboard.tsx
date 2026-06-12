import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Shield, AlertTriangle, Globe, Search, Activity, Radio,
  MapPin, Loader2, ExternalLink, Ban, Eye, Crosshair, Monitor,
} from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EmptyState } from "@/components/EmptyState";

export default function ThreatIntelligenceDashboard() {
  const [sanctionsQuery, setSanctionsQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [osintDomain, setOsintDomain] = useState("");
  const [osintIp, setOsintIp] = useState("");
  const [activeDomain, setActiveDomain] = useState("");
  const [activeIp, setActiveIp] = useState("");

  const { data: conflictData } = trpc.osirisIntel.conflictZones.useQuery();
  const { data: cyberData, isLoading: cyberLoading } = trpc.osirisIntel.cyberThreats.useQuery({ limit: 15 });
  const { data: sanctionsData, isLoading: sanctionsLoading } = trpc.osirisIntel.sanctionsSearch.useQuery(
    { query: searchTerm, limit: 25 },
    { enabled: searchTerm.length >= 4 }
  );
  const { data: whoisData, isLoading: whoisLoading } = trpc.osirisIntel.whois.useQuery(
    { domain: activeDomain },
    { enabled: activeDomain.length >= 3 }
  );
  const { data: ipData, isLoading: ipLoading } = trpc.osirisIntel.ipIntel.useQuery(
    { ip: activeIp },
    { enabled: activeIp.length >= 7 }
  );

  const severityColor = (sev: string) => {
    const s = sev.toLowerCase();
    if (s === "critical") return "bg-red-500/15 text-red-600 dark:text-red-400";
    if (s === "high") return "bg-orange-500/15 text-orange-600 dark:text-orange-400";
    if (s === "medium") return "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400";
    return "bg-muted text-muted-foreground";
  };

  const conflictColor = (sev: string) => {
    if (sev === "active_war") return "bg-red-500/15 text-red-600 dark:text-red-400";
    if (sev === "high_tension") return "bg-orange-500/15 text-orange-600 dark:text-orange-400";
    return "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400";
  };

  return (
    <div className="p-6 space-y-6">
      <Breadcrumbs items={[{ label: "NOC", href: "/noc-dashboard" }, { label: "Threat Intelligence" }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Threat Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Powered by Osiris OSINT — real-time sanctions, cyber threats, and conflict zone monitoring
          </p>
        </div>
        <Badge className="bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
          <Radio className="w-3 h-3 mr-1" /> Live Feed
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10"><AlertTriangle className="w-5 h-5 text-red-500" /></div>
              <div>
                <p className="text-2xl font-bold">{conflictData?.activeWars ?? 0}</p>
                <p className="text-xs text-muted-foreground">Active Conflicts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10"><Globe className="w-5 h-5 text-orange-500" /></div>
              <div>
                <p className="text-2xl font-bold">{conflictData?.highTension ?? 0}</p>
                <p className="text-xs text-muted-foreground">High Tension Zones</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10"><Shield className="w-5 h-5 text-purple-500" /></div>
              <div>
                <p className="text-2xl font-bold">{cyberData?.total ?? 0}</p>
                <p className="text-xs text-muted-foreground">Cyber Threats (30d)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10"><Activity className="w-5 h-5 text-cyan-500" /></div>
              <div>
                <p className="text-2xl font-bold">{conflictData?.total ?? 0}</p>
                <p className="text-xs text-muted-foreground">Monitored Zones</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="osiris-live" className="space-y-4">
        <TabsList>
          <TabsTrigger value="osiris-live"><Monitor className="w-3.5 h-3.5 mr-1" /> Osiris Live</TabsTrigger>
          <TabsTrigger value="conflicts"><MapPin className="w-3.5 h-3.5 mr-1" /> Conflict Zones</TabsTrigger>
          <TabsTrigger value="cyber"><Shield className="w-3.5 h-3.5 mr-1" /> Cyber Threats</TabsTrigger>
          <TabsTrigger value="sanctions"><Ban className="w-3.5 h-3.5 mr-1" /> Sanctions</TabsTrigger>
          <TabsTrigger value="osint"><Eye className="w-3.5 h-3.5 mr-1" /> OSINT Tools</TabsTrigger>
        </TabsList>

        {/* Osiris Live Embedded Map */}
        <TabsContent value="osiris-live" className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Monitor className="w-5 h-5 text-amber-500" />
                    Osiris Global Intelligence Command
                  </CardTitle>
                  <CardDescription>Live OSINT dashboard — maritime tracking, conflict zones, cyber threats, sanctions, CCTV, aviation</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <Radio className="w-3 h-3 mr-1" /> Connected
                  </Badge>
                  <a href={import.meta.env.VITE_OSIRIS_URL || "https://osirislive.app"} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">
                      <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open Full Screen
                    </Button>
                  </a>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <iframe
                src={import.meta.env.VITE_OSIRIS_URL || "https://osirislive.app"}
                title="Osiris Global Intelligence Platform"
                className="w-full border-0 rounded-b-lg"
                style={{ height: "75vh" }}
                allow="fullscreen; geolocation"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Conflict Zones Tab */}
        <TabsContent value="conflicts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Active Conflict & Tension Zones</CardTitle>
              <CardDescription>Real-time geopolitical risk data — used for cross-border data transfer assessments (NDPA Art. 40)</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zone</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Countries</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conflictData?.zones?.map((zone) => (
                    <TableRow key={zone.name}>
                      <TableCell className="font-medium">{zone.name}</TableCell>
                      <TableCell className="text-muted-foreground">{zone.region}</TableCell>
                      <TableCell>
                        <Badge className={conflictColor(zone.severity)}>
                          {zone.severity.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{zone.countries.join(", ")}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">{zone.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cyber Threats Tab */}
        <TabsContent value="cyber" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">CISA Known Exploited Vulnerabilities</CardTitle>
              <CardDescription>Active cyber threats from US CISA — relevant to regulated entities&apos; infrastructure security</CardDescription>
            </CardHeader>
            <CardContent>
              {cyberLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : cyberData?.threats?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CVE ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cyberData.threats.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-xs">{t.id}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{t.name}</TableCell>
                        <TableCell><Badge className={severityColor(t.severity)}>{t.severity}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{t.vendor ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{t.date}</TableCell>
                        <TableCell><Badge className="bg-muted text-muted-foreground">{t.source}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState title="No cyber threats" description="CISA KEV feed is empty or unreachable" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sanctions Tab */}
        <TabsContent value="sanctions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">OFAC SDN Sanctions Search</CardTitle>
              <CardDescription>Search persons, organizations, vessels, and aircraft against the US OFAC Specially Designated Nationals list</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search name, alias, or identifier (min 4 chars)..."
                  value={sanctionsQuery}
                  onChange={(e) => setSanctionsQuery(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={() => setSearchTerm(sanctionsQuery)}
                  disabled={sanctionsQuery.length < 4}
                >
                  <Search className="w-4 h-4 mr-1" /> Search
                </Button>
              </div>

              {sanctionsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : sanctionsData?.results?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entity</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Countries</TableHead>
                      <TableHead>Program</TableHead>
                      <TableHead>Aliases</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sanctionsData.results.map((entity) => (
                      <TableRow key={entity.id}>
                        <TableCell className="font-medium">{entity.caption}</TableCell>
                        <TableCell><Badge className="bg-muted text-muted-foreground">{entity.schema}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{entity.countries?.join(", ") ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{entity.sanctions_program}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{entity.aliases?.slice(0, 3).join("; ") ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : searchTerm.length >= 4 ? (
                <EmptyState title="No matches" description={`No OFAC SDN entries match "${searchTerm}"`} />
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* OSINT Tools Tab */}
        <TabsContent value="osint" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* WHOIS */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Crosshair className="w-4 h-4" /> WHOIS Lookup</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="example.com"
                    value={osintDomain}
                    onChange={(e) => setOsintDomain(e.target.value)}
                  />
                  <Button size="sm" onClick={() => setActiveDomain(osintDomain)} disabled={osintDomain.length < 3}>
                    <Search className="w-3.5 h-3.5" />
                  </Button>
                </div>
                {whoisLoading && <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>}
                {whoisData && (
                  <div className="space-y-1 text-sm">
                    <p><span className="text-muted-foreground">Registrar:</span> {whoisData.registrar ?? "—"}</p>
                    <p><span className="text-muted-foreground">Org:</span> {whoisData.registrant_org ?? "—"}</p>
                    <p><span className="text-muted-foreground">Country:</span> {whoisData.registrant_country ?? "—"}</p>
                    <p><span className="text-muted-foreground">Created:</span> {whoisData.creation_date ?? "—"}</p>
                    <p><span className="text-muted-foreground">Expires:</span> {whoisData.expiry_date ?? "—"}</p>
                    {whoisData.sanctions_alert && (
                      <Badge className="bg-red-500/15 text-red-600 dark:text-red-400 mt-2">
                        <AlertTriangle className="w-3 h-3 mr-1" /> SANCTIONS ALERT
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* IP Intelligence */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Globe className="w-4 h-4" /> IP Intelligence</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="8.8.8.8"
                    value={osintIp}
                    onChange={(e) => setOsintIp(e.target.value)}
                  />
                  <Button size="sm" onClick={() => setActiveIp(osintIp)} disabled={osintIp.length < 7}>
                    <Search className="w-3.5 h-3.5" />
                  </Button>
                </div>
                {ipLoading && <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>}
                {ipData && (
                  <div className="space-y-1 text-sm">
                    <p><span className="text-muted-foreground">Location:</span> {ipData.city ?? "—"}, {ipData.country ?? "—"}</p>
                    <p><span className="text-muted-foreground">ASN:</span> {ipData.asn ?? "—"}</p>
                    <p><span className="text-muted-foreground">Org:</span> {ipData.org ?? "—"}</p>
                    <p><span className="text-muted-foreground">Threat Score:</span> {ipData.threat_score ?? "N/A"}/100</p>
                    <div className="flex gap-1 mt-1">
                      {ipData.is_vpn && <Badge className="bg-yellow-500/15 text-yellow-600 dark:text-yellow-400">VPN</Badge>}
                      {ipData.is_proxy && <Badge className="bg-orange-500/15 text-orange-600 dark:text-orange-400">Proxy</Badge>}
                      {ipData.is_tor && <Badge className="bg-red-500/15 text-red-600 dark:text-red-400">Tor</Badge>}
                    </div>
                    {ipData.sanctions_alert && (
                      <Badge className="bg-red-500/15 text-red-600 dark:text-red-400 mt-2">
                        <AlertTriangle className="w-3 h-3 mr-1" /> SANCTIONS ALERT
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">
                <ExternalLink className="w-3.5 h-3.5 inline mr-1" />
                Full OSINT toolkit (port scanning, DNS, SSL/TLS, CVE lookup, crypto wallet tracing) available at{" "}
                <a href="https://osirislive.app" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  osirislive.app
                </a>
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
