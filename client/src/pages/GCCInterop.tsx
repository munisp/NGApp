import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataClassificationBadge } from "@/components/DataClassificationBadge";
import { getCurrentHijriDate, formatDualDate, getNextIslamicHoliday } from "@/lib/hijri-calendar";
import {
  Globe, Link, Shield, CheckCircle, Clock, AlertTriangle,
  Building2, Key, Server, Database, RefreshCw, Calendar,
  Wifi, Lock, Users, FileText
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface IntegrationEndpoint {
  id: string;
  name: string;
  nameAr: string;
  system: string;
  country: "KW" | "AE";
  protocol: string;
  status: "connected" | "pending" | "error" | "stub";
  lastSync: string;
  description: string;
  descriptionAr: string;
}

const INTEGRATIONS: IntegrationEndpoint[] = [
  {
    id: "kpc-iams",
    name: "KPC Identity & Access Management",
    nameAr: "نظام إدارة الهوية والوصول - مؤسسة البترول الكويتية",
    system: "KPC IAMS v3.2",
    country: "KW",
    protocol: "SAML 2.0 / OAuth 2.0",
    status: "stub",
    lastSync: "Not yet configured",
    description: "Single Sign-On federation with Kuwait Petroleum Corporation enterprise identity provider. Enables KPC employees to authenticate using their corporate credentials.",
    descriptionAr: "تكامل الدخول الموحد مع مزود الهوية المؤسسي لمؤسسة البترول الكويتية. يتيح لموظفي المؤسسة المصادقة باستخدام بيانات اعتماد الشركة.",
  },
  {
    id: "koc-scada",
    name: "KOC SCADA Data Exchange",
    nameAr: "تبادل بيانات SCADA - شركة نفط الكويت",
    system: "KOC E-SCADA (KOC-E-027)",
    country: "KW",
    protocol: "OPC-UA / DNP3 / Modbus TCP",
    status: "pending",
    lastSync: "2026-03-10T08:00:00Z",
    description: "Real-time process data exchange with KOC wellsite SCADA systems using KOC-E-027 standard Modbus register maps and DNP3 object definitions.",
    descriptionAr: "تبادل بيانات العمليات في الوقت الفعلي مع أنظمة SCADA في مواقع آبار شركة نفط الكويت باستخدام معيار KOC-E-027.",
  },
  {
    id: "adnoc-vendor-portal",
    name: "ADNOC Vendor Portal Integration",
    nameAr: "تكامل بوابة الموردين - أبوظبي الوطنية للنفط",
    system: "ADNOC Vendor Portal v2.1",
    country: "AE",
    protocol: "REST API / OAuth 2.0",
    status: "stub",
    lastSync: "Not yet configured",
    description: "Integration with ADNOC's vendor management portal for procurement, work order submission, invoice processing, and vendor qualification status updates.",
    descriptionAr: "التكامل مع بوابة إدارة الموردين في أدنوك لإدارة المشتريات وتقديم أوامر العمل ومعالجة الفواتير وتحديثات حالة تأهيل الموردين.",
  },
  {
    id: "adnoc-scada",
    name: "ADNOC SCADA/DCS Integration",
    nameAr: "تكامل SCADA/DCS - أبوظبي الوطنية للنفط",
    system: "ADNOC Process Control (ADNOC-PROC-CTRL-001)",
    country: "AE",
    protocol: "OPC-UA / PI Web API",
    status: "pending",
    lastSync: "2026-03-11T06:00:00Z",
    description: "Process data integration with ADNOC field SCADA and DCS systems via OPC-UA and the PI Web API compatibility layer.",
    descriptionAr: "تكامل بيانات العمليات مع أنظمة SCADA وDCS الميدانية لأدنوك عبر OPC-UA وطبقة توافق PI Web API.",
  },
  {
    id: "nesa-reporting",
    name: "NESA Cybersecurity Reporting",
    nameAr: "تقارير الأمن السيبراني - الهيئة الوطنية للأمن الإلكتروني",
    system: "UAE NESA Reporting Portal",
    country: "AE",
    protocol: "HTTPS REST / SFTP",
    status: "stub",
    lastSync: "Not yet configured",
    description: "Automated submission of cybersecurity incident reports and annual IAS-188 compliance reports to the UAE National Electronic Security Authority.",
    descriptionAr: "التقديم الآلي لتقارير حوادث الأمن السيبراني وتقارير الامتثال السنوية لـ IAS-188 إلى الهيئة الوطنية للأمن الإلكتروني.",
  },
  {
    id: "ncsc-kuwait",
    name: "Kuwait NCSC Security Feed",
    nameAr: "تغذية الأمن - المركز الوطني للأمن السيبراني الكويتي",
    system: "Kuwait NCSC Threat Intelligence",
    country: "KW",
    protocol: "TAXII 2.1 / STIX 2.1",
    status: "stub",
    lastSync: "Not yet configured",
    description: "Threat intelligence feed from Kuwait National Cybersecurity Center for OT/ICS-specific threat indicators relevant to oil and gas infrastructure.",
    descriptionAr: "تغذية استخباراتية للتهديدات من المركز الوطني للأمن السيبراني الكويتي لمؤشرات التهديد الخاصة بأنظمة OT/ICS.",
  },
];

// ─── Hijri Calendar Widget ────────────────────────────────────────────────────
function HijriCalendarWidget({ isArabic }: { isArabic: boolean }) {
  const today = new Date();
  const hijri = getCurrentHijriDate();
  const dualDate = formatDualDate(today, isArabic ? "ar" : "en");
  const nextHoliday = getNextIslamicHoliday(today);

  return (
    <Card className="bg-gray-900/60 border-gray-700/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-400" />
          <CardTitle className={`text-white text-sm ${isArabic ? "font-arabic" : ""}`}>
            {isArabic ? "التقويم الهجري / الميلادي" : "Hijri / Gregorian Calendar"}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="bg-gray-800/60 rounded-lg p-3 text-center">
          <div className={`text-2xl font-bold text-amber-400 ${isArabic ? "font-arabic" : "font-mono"}`}>
            {isArabic ? hijri.formattedAr : hijri.formatted}
          </div>
          <div className={`text-xs text-gray-400 mt-1 ${isArabic ? "font-arabic" : ""}`}>
            {dualDate}
          </div>
        </div>
        {nextHoliday && (
          <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-3">
            <div className={`text-xs text-amber-400 font-medium mb-1 ${isArabic ? "font-arabic" : ""}`}>
              {isArabic ? "العطلة الإسلامية القادمة" : "Next Islamic Holiday"}
            </div>
            <div className={`text-sm text-white ${isArabic ? "font-arabic" : ""}`}>
              {isArabic ? nextHoliday.nameAr : nextHoliday.name}
            </div>
            <div className="text-xs text-gray-400 mt-0.5 font-mono">
              {isArabic ? nextHoliday.hijriDate.replace("AH", "هـ") : nextHoliday.hijriDate}
            </div>
          </div>
        )}
        <div className="text-xs text-gray-500 text-center">
          {isArabic ? "تقويم أم القرى — الكويت والإمارات" : "Umm al-Qura Calendar — Kuwait & UAE"}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Integration Card ─────────────────────────────────────────────────────────
function IntegrationCard({ endpoint, isArabic }: { endpoint: IntegrationEndpoint; isArabic: boolean }) {
  const [connecting, setConnecting] = useState(false);

  const statusConfig = {
    connected: { color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20", icon: CheckCircle, label: isArabic ? "متصل" : "Connected" },
    pending: { color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20", icon: Clock, label: isArabic ? "معلق" : "Pending" },
    error: { color: "text-red-400", bg: "bg-red-400/10 border-red-400/20", icon: AlertTriangle, label: isArabic ? "خطأ" : "Error" },
    stub: { color: "text-gray-400", bg: "bg-gray-400/10 border-gray-400/20", icon: Link, label: isArabic ? "غير مُهيأ" : "Not Configured" },
  };
  const s = statusConfig[endpoint.status];
  const StatusIcon = s.icon;

  const handleConnect = () => {
    setConnecting(true);
    setTimeout(() => setConnecting(false), 2000);
  };

  return (
    <Card className="bg-gray-900/60 border-gray-700/50 hover:border-amber-500/30 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span>{endpoint.country === "KW" ? "🇰🇼" : "🇦🇪"}</span>
              <Badge variant="outline" className="text-xs text-gray-400 border-gray-600 font-mono">
                {endpoint.protocol}
              </Badge>
            </div>
            <CardTitle className={`text-sm text-white leading-snug ${isArabic ? "font-arabic" : ""}`}>
              {isArabic ? endpoint.nameAr : endpoint.name}
            </CardTitle>
            <p className="text-xs text-amber-400/80 mt-0.5 font-mono">{endpoint.system}</p>
          </div>
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium shrink-0 ${s.bg} ${s.color}`}>
            <StatusIcon className="w-3 h-3" />
            {s.label}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className={`text-xs text-gray-400 mb-3 leading-relaxed ${isArabic ? "font-arabic" : ""}`}>
          {isArabic ? endpoint.descriptionAr : endpoint.description}
        </p>
        {endpoint.lastSync !== "Not yet configured" && (
          <div className="text-xs text-gray-500 mb-3">
            {isArabic ? "آخر مزامنة: " : "Last sync: "}
            <span className="font-mono text-gray-400">{endpoint.lastSync}</span>
          </div>
        )}
        <Button
          size="sm"
          className={`w-full text-xs h-7 ${
            endpoint.status === "connected"
              ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
              : "bg-amber-600 hover:bg-amber-700 text-white"
          }`}
          onClick={handleConnect}
          disabled={connecting}
        >
          {connecting ? (
            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <Link className="w-3 h-3 mr-1" />
          )}
          {connecting
            ? (isArabic ? "جارٍ الاتصال..." : "Connecting...")
            : endpoint.status === "connected"
            ? (isArabic ? "إعادة المزامنة" : "Re-sync")
            : (isArabic ? "تهيئة الاتصال" : "Configure")}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function GCCInteropPage() {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === "ar";
  const connected = INTEGRATIONS.filter((i) => i.status === "connected").length;
  const pending = INTEGRATIONS.filter((i) => i.status === "pending").length;
  const stubs = INTEGRATIONS.filter((i) => i.status === "stub").length;

  // Live data from FledgePower protocol bridge
  const { data: fledgeHealth } = trpc.fledge.health.useQuery();
  const { data: fledgeStats } = trpc.fledge.stats.useQuery();
  const { data: fledgeProtocols } = trpc.fledge.protocols.useQuery();
  // Live PI Connector status
  const { data: piHealth } = trpc.piConnector.health.useQuery();
  const { data: piStatus } = trpc.piConnector.connectionStatus.useQuery();;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Globe className="w-6 h-6 text-amber-400" />
            <h1 className={`text-2xl font-bold text-white ${isArabic ? "font-arabic" : "font-display"}`}>
              {isArabic ? "التكامل الخليجي — الكويت والإمارات" : "GCC Interoperability — Kuwait & UAE"}
            </h1>
            <DataClassificationBadge classification="confidential" size="sm" />
          </div>
          <p className={`text-gray-400 text-sm ${isArabic ? "font-arabic" : ""}`}>
            {isArabic
              ? "تكامل KPC/KOC وADNOC والجهات التنظيمية مع التقويم الهجري"
              : "KPC/KOC and ADNOC system federation, regulatory portals, and Hijri calendar support"}
          </p>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { icon: CheckCircle, label: isArabic ? "متصل" : "Connected", value: connected, color: "text-emerald-400" },
          { icon: Clock, label: isArabic ? "معلق" : "Pending", value: pending, color: "text-amber-400" },
          { icon: Link, label: isArabic ? "غير مُهيأ" : "Not Configured", value: stubs, color: "text-gray-400" },
          { icon: Globe, label: isArabic ? "إجمالي التكاملات" : "Total Integrations", value: INTEGRATIONS.length, color: "text-blue-400" },
        ].map(({ icon: Icon, label, value, color }) => (
          <Card key={label} className="bg-gray-900/60 border-gray-700/50">
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`w-8 h-8 ${color}`} />
              <div>
                <div className={`text-2xl font-bold text-white font-mono`}>{value}</div>
                <div className={`text-xs text-gray-400 ${isArabic ? "font-arabic" : ""}`}>{label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Integration Cards */}
        <div className="xl:col-span-3">
          <Tabs defaultValue="all">
            <TabsList className="bg-gray-800/50 border border-gray-700 mb-4">
              {[
                { value: "all", label: isArabic ? "الكل" : "All" },
                { value: "kw", label: isArabic ? "🇰🇼 الكويت" : "🇰🇼 Kuwait" },
                { value: "ae", label: isArabic ? "🇦🇪 الإمارات" : "🇦🇪 UAE" },
              ].map(({ value, label }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className={`data-[state=active]:bg-amber-600 data-[state=active]:text-white text-gray-400 ${isArabic ? "font-arabic" : ""}`}
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            {["all", "kw", "ae"].map((tab) => (
              <TabsContent key={tab} value={tab}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {INTEGRATIONS
                    .filter((e) => tab === "all" || e.country === tab.toUpperCase())
                    .map((endpoint) => (
                      <IntegrationCard key={endpoint.id} endpoint={endpoint} isArabic={isArabic} />
                    ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* Right Column: Hijri Calendar + IAMS Status */}
        <div className="space-y-4">
          <HijriCalendarWidget isArabic={isArabic} />

          {/* IAMS Federation Status */}
          <Card className="bg-gray-900/60 border-gray-700/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                <CardTitle className={`text-white text-sm ${isArabic ? "font-arabic" : ""}`}>
                  {isArabic ? "حالة الاتحاد الهوياتي" : "Identity Federation Status"}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { name: "KPC IAMS", nameAr: "مؤسسة البترول الكويتية", protocol: "SAML 2.0", status: "stub", country: "🇰🇼" },
                { name: "KOC LDAP", nameAr: "شركة نفط الكويت", protocol: "LDAP/AD", status: "stub", country: "🇰🇼" },
                { name: "ADNOC SSO", nameAr: "أبوظبي الوطنية للنفط", protocol: "OAuth 2.0", status: "stub", country: "🇦🇪" },
                { name: "Keycloak (Local)", nameAr: "كيكلوك (محلي)", protocol: "OIDC", status: "connected", country: "🔐" },
              ].map(({ name, nameAr, protocol, status, country }) => (
                <div key={name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{country}</span>
                    <div>
                      <div className={`text-xs text-gray-300 ${isArabic ? "font-arabic" : ""}`}>
                        {isArabic ? nameAr : name}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">{protocol}</div>
                    </div>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${status === "connected" ? "bg-emerald-400" : "bg-gray-600"}`} />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Data Sovereignty */}
          <Card className="bg-gray-900/60 border-gray-700/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <CardTitle className={`text-white text-sm ${isArabic ? "font-arabic" : ""}`}>
                  {isArabic ? "سيادة البيانات" : "Data Sovereignty"}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: isArabic ? "الكويت (KW-CLOUD-01)" : "Kuwait (KW-CLOUD-01)", value: 100, color: "bg-emerald-500" },
                { label: isArabic ? "الإمارات (G42 Cloud)" : "UAE (G42 Cloud)", value: 100, color: "bg-emerald-500" },
                { label: isArabic ? "تشفير البيانات" : "Data Encryption", value: 100, color: "bg-emerald-500" },
                { label: isArabic ? "تدقيق الوصول" : "Access Audit", value: 95, color: "bg-amber-500" },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={`text-gray-400 ${isArabic ? "font-arabic" : ""}`}>{label}</span>
                    <span className="text-gray-300 font-mono">{value}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full">
                    <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${value}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          {/* FledgePower Protocol Bridge Status (Live) */}
          <Card className="bg-gray-900/60 border-gray-700/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-amber-400" />
                <CardTitle className={`text-white text-sm ${isArabic ? "font-arabic" : ""}`}>
                  {isArabic ? "جسر البروتوكول" : "Protocol Bridge (Live)"}
                </CardTitle>
                {fledgeHealth && (
                  <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    fledgeHealth.online ? "bg-emerald-900/30 text-emerald-400" : "bg-gray-800 text-gray-500"
                  }`}>
                    {fledgeHealth.mode}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {fledgeStats ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "IEC 60870-5-104", value: fledgeStats.iec104_readings },
                      { label: "DNP3 (IEEE 1815)", value: fledgeStats.dnp3_readings },
                      { label: "Modbus TCP", value: fledgeStats.modbus_readings },
                      { label: "RTDIP Forwards", value: fledgeStats.rtdip_forwards },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-gray-800/50 rounded p-2">
                        <div className="text-[10px] text-gray-500">{label}</div>
                        <div className="text-sm font-mono text-amber-400">{value.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] text-gray-500 pt-1">
                    Tags: {fledgeStats.tag_count} · Errors: {fledgeStats.rtdip_errors}
                  </div>
                </>
              ) : (
                <div className="text-xs text-gray-500">Loading protocol bridge data...</div>
              )}
              {/* PI Connector */}
              <div className="pt-2 border-t border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">PI Web API</span>
                  <span className={`text-xs font-mono ${
                    piHealth?.connected ? "text-emerald-400" : "text-gray-500"
                  }`}>
                    {piHealth ? (piHealth.connected ? "Connected" : piHealth.mode) : "—"}
                  </span>
                </div>
                {piStatus && (
                  <div className="text-[10px] text-gray-500 mt-1">
                    {piStatus.url ?? "OSIsoft PI"} · {piStatus.simulated ? "simulation" : "live"}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
