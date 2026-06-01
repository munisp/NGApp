import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataClassificationBadge } from "@/components/DataClassificationBadge";
import {
  FileText, Download, Globe, CheckCircle, Clock, AlertTriangle,
  Building2, Shield, BarChart3, Droplets, Flame, Leaf
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
interface RegulatoryReport {
  id: string;
  titleEn: string;
  titleAr: string;
  authority: string;
  authorityAr: string;
  country: "KW" | "AE" | "BOTH";
  frequency: string;
  frequencyAr: string;
  lastGenerated: string;
  status: "current" | "due" | "overdue";
  standard: string;
  classification: "public" | "internal" | "confidential" | "restricted";
}

const REGULATORY_REPORTS: RegulatoryReport[] = [
  {
    id: "kpc-monthly-production",
    titleEn: "KPC Monthly Production Report",
    titleAr: "تقرير الإنتاج الشهري - مؤسسة البترول الكويتية",
    authority: "Kuwait Petroleum Corporation",
    authorityAr: "مؤسسة البترول الكويتية",
    country: "KW",
    frequency: "Monthly",
    frequencyAr: "شهري",
    lastGenerated: "2026-02-28",
    status: "due",
    standard: "KPC-OPS-RPT-001",
    classification: "confidential",
  },
  {
    id: "koc-well-performance",
    titleEn: "KOC Well Performance Report",
    titleAr: "تقرير أداء الآبار - شركة نفط الكويت",
    authority: "Kuwait Oil Company",
    authorityAr: "شركة نفط الكويت",
    country: "KW",
    frequency: "Monthly",
    frequencyAr: "شهري",
    lastGenerated: "2026-02-28",
    status: "due",
    standard: "KOC-E-027",
    classification: "confidential",
  },
  {
    id: "mew-kuwait-production",
    titleEn: "MEW Oil & Gas Production Statistics",
    titleAr: "إحصاءات إنتاج النفط والغاز - وزارة الكهرباء والماء",
    authority: "Ministry of Electricity & Water (Kuwait)",
    authorityAr: "وزارة الكهرباء والماء والطاقة المتجددة",
    country: "KW",
    frequency: "Quarterly",
    frequencyAr: "ربع سنوي",
    lastGenerated: "2025-12-31",
    status: "current",
    standard: "MEW-STAT-001",
    classification: "internal",
  },
  {
    id: "adnoc-monthly-production",
    titleEn: "ADNOC Monthly Production Report",
    titleAr: "تقرير الإنتاج الشهري - أبوظبي الوطنية للنفط",
    authority: "Abu Dhabi National Oil Company",
    authorityAr: "شركة أبوظبي الوطنية للنفط",
    country: "AE",
    frequency: "Monthly",
    frequencyAr: "شهري",
    lastGenerated: "2026-02-28",
    status: "due",
    standard: "ADNOC-PROC-CTRL-001",
    classification: "confidential",
  },
  {
    id: "moccae-emissions",
    titleEn: "MOCCAE GHG Emissions Report",
    titleAr: "تقرير انبعاثات الغازات الدفيئة - وزارة التغير المناخي",
    authority: "Ministry of Climate Change & Environment (UAE)",
    authorityAr: "وزارة التغير المناخي والبيئة",
    country: "AE",
    frequency: "Annual",
    frequencyAr: "سنوي",
    lastGenerated: "2025-12-31",
    status: "current",
    standard: "UAE-GHG-001",
    classification: "internal",
  },
  {
    id: "nesa-cybersecurity",
    titleEn: "NESA Cybersecurity Compliance Report",
    titleAr: "تقرير الامتثال للأمن السيبراني - الهيئة الوطنية للأمن الإلكتروني",
    authority: "UAE National Electronic Security Authority",
    authorityAr: "الهيئة الوطنية للأمن الإلكتروني",
    country: "AE",
    frequency: "Annual",
    frequencyAr: "سنوي",
    lastGenerated: "2025-12-31",
    status: "due",
    standard: "NESA IAS-188",
    classification: "confidential",
  },
  {
    id: "ncsc-kuwait-security",
    titleEn: "Kuwait NCSC Security Compliance Report",
    titleAr: "تقرير الامتثال الأمني - المركز الوطني للأمن السيبراني",
    authority: "Kuwait National Cybersecurity Center",
    authorityAr: "المركز الوطني للأمن السيبراني",
    country: "KW",
    frequency: "Annual",
    frequencyAr: "سنوي",
    lastGenerated: "2025-12-31",
    status: "due",
    standard: "NCSC Decision 1/2025",
    classification: "confidential",
  },
  {
    id: "gcc-hse-report",
    titleEn: "GCC HSE Performance Report",
    titleAr: "تقرير أداء الصحة والسلامة والبيئة - دول الخليج",
    authority: "GCC Secretariat General",
    authorityAr: "الأمانة العامة لمجلس التعاون الخليجي",
    country: "BOTH",
    frequency: "Annual",
    frequencyAr: "سنوي",
    lastGenerated: "2025-12-31",
    status: "current",
    standard: "GCC-HSE-001",
    classification: "internal",
  },
];

// ─── Report Card Component ────────────────────────────────────────────────────
function BilingualReportCard({
  report,
  language,
  onGenerate,
  onDownload,
}: {
  report: RegulatoryReport;
  language: string;
  onGenerate: (id: string) => void;
  onDownload: (id: string, lang: string) => void;
}) {
  const isArabic = language === "ar";
  const title = isArabic ? report.titleAr : report.titleEn;
  const authority = isArabic ? report.authorityAr : report.authority;
  const frequency = isArabic ? report.frequencyAr : report.frequency;

  const statusConfig = {
    current: { color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20", icon: CheckCircle, label: isArabic ? "محدّث" : "Current" },
    due: { color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20", icon: Clock, label: isArabic ? "مستحق" : "Due" },
    overdue: { color: "text-red-400", bg: "bg-red-400/10 border-red-400/20", icon: AlertTriangle, label: isArabic ? "متأخر" : "Overdue" },
  };
  const s = statusConfig[report.status];
  const StatusIcon = s.icon;

  const countryFlag = report.country === "KW" ? "🇰🇼" : report.country === "AE" ? "🇦🇪" : "🌍";

  return (
    <Card className="bg-gray-900/60 border-gray-700/50 hover:border-amber-500/30 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{countryFlag}</span>
              <Badge variant="outline" className="text-xs text-gray-400 border-gray-600">
                {report.standard}
              </Badge>
              <DataClassificationBadge classification={report.classification} size="sm" />
            </div>
            <CardTitle className={`text-sm font-semibold text-white leading-snug ${isArabic ? "font-arabic" : ""}`}>
              {title}
            </CardTitle>
            <p className={`text-xs text-gray-400 mt-1 ${isArabic ? "font-arabic" : ""}`}>{authority}</p>
          </div>
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium ${s.bg} ${s.color} shrink-0`}>
            <StatusIcon className="w-3 h-3" />
            {s.label}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
          <div>
            <span className="text-gray-500">{isArabic ? "التكرار" : "Frequency"}:</span>
            <span className={`text-gray-300 ml-1 ${isArabic ? "font-arabic" : ""}`}>{frequency}</span>
          </div>
          <div>
            <span className="text-gray-500">{isArabic ? "آخر إنشاء" : "Last Generated"}:</span>
            <span className="text-gray-300 ml-1">{report.lastGenerated}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-xs h-8"
            onClick={() => onGenerate(report.id)}
          >
            <FileText className="w-3 h-3 mr-1" />
            {isArabic ? "إنشاء" : "Generate"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-gray-600 text-gray-300 hover:bg-gray-800 text-xs h-8"
            onClick={() => onDownload(report.id, "en")}
          >
            EN
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-gray-600 text-gray-300 hover:bg-gray-800 text-xs h-8 font-arabic"
            onClick={() => onDownload(report.id, "ar")}
          >
            عر
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RegulatoryMEPage() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === "ar";
  const [countryFilter, setCountryFilter] = useState<"ALL" | "KW" | "AE">("ALL");
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const filtered = REGULATORY_REPORTS.filter(
    (r) => countryFilter === "ALL" || r.country === countryFilter || r.country === "BOTH"
  );

  // Live regulatory report history from DB
  const utils = trpc.useUtils();
  const { data: dbReports = [] } = trpc.regulatory.list.useQuery({ limit: 20 });
  const generateMutation = trpc.regulatory.generate.useMutation({
    onSuccess: (res) => {
      toast.success("Report generated", { description: `Report ${res.reportId} created in database` });
      utils.regulatory.list.invalidate();
    },
    onError: (err) => toast.error("Generate failed", { description: err.message }),
  });

  const handleGenerate = (id: string) => {
    setGeneratingId(id);
    // Map static report ID to regulatory report type
    const typeMap: Record<string, string> = {
      "kpc-monthly-production": "BSEE_OGOR",
      "koc-well-performance": "API_14C",
      "adnoc-hse-report": "ADNOC_HSE",
      "moccae-env-report": "MOCCAE",
      "koc-env-report": "KOC_ENV",
      "ncsc-cyber-incident": "NCSC_INCIDENT",
      "epa-ghg-report": "EPA_SUBPART_W",
    };
    const reportType = typeMap[id] ?? "API_14C";
    const period = new Date().toISOString().slice(0, 7); // YYYY-MM
    generateMutation.mutate(
      { reportType: reportType as any, period, language: isArabic ? "AR" : "EN" },
      { onSettled: () => setGeneratingId(null) }
    );
  };
  const handleDownload = (id: string, lang: string) => {
    const report = filtered.find((r: RegulatoryReport) => r.id === id);
    if (!report) return;
    const title = lang === "ar" ? report.titleAr : report.titleEn;
    const sep = '='.repeat(60);
    const now = new Date();
    const content = [
      'OG-RMM REGULATORY COMPLIANCE REPORT',
      sep,
      '',
      `Report Title: ${title}`,
      `Report ID:    ${id}`,
      `Authority:    ${lang === 'ar' ? report.authorityAr : report.authority}`,
      `Standard:     ${report.standard}`,
      `Country:      ${report.country === 'KW' ? 'Kuwait' : report.country === 'AE' ? 'United Arab Emirates' : 'GCC Region'}`,
      `Frequency:    ${report.frequency}`,
      `Status:       ${report.status.toUpperCase()}`,
      `Generated:    ${now.toISOString()}`,
      `Language:     ${lang === 'ar' ? 'Arabic' : 'English'}`,
      `Platform:     OG-RMM v54.0`,
      '',
      '-'.repeat(60),
      'COMPLIANCE SUMMARY',
      '-'.repeat(60),
      '',
      `This report has been generated by the OG-RMM Platform v54.0`,
      `Regulatory Compliance Module for the Middle East & North Africa region.`,
      '',
      `Reporting Period: ${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
      `Classification:   ${report.classification.toUpperCase()}`,
      '',
      '-'.repeat(60),
      'REQUIRED ACTIONS',
      '-'.repeat(60),
      '',
      ...(report.status === 'overdue' ? [
        '⚠ URGENT: This report is overdue. Immediate action required.',
        `  Submit completed documentation to ${report.authority} immediately.`,
        '',
      ] : []),
      ...(report.status === 'due' ? [
        `• Submit completed documentation to ${report.authority}`,
        '• Obtain regulatory approval before proceeding',
        '• Deadline: End of current reporting period',
        '',
      ] : []),
      ...(report.status === 'current' ? [
        `✓ This report is current and approved by ${report.authority}`,
        `  Next due date: ${new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10)}`,
        '',
      ] : []),
      '-'.repeat(60),
      'DISCLAIMER',
      '-'.repeat(60),
      '',
      'This document is generated for compliance tracking purposes.',
      'All regulatory submissions must be reviewed by a qualified',
      'compliance officer before submission to the relevant authority.',
      '',
      `OG-RMM Platform v54.0 | Oil & Gas Remote Monitoring & Management`,
      `Report generated: ${now.toUTCString()}`,
    ].join('\n');
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${id}-${lang}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(lang === "ar" ? "جاري تحميل التقرير بالعربية" : "Downloading report in English", { description: title });
  };

  const kuwaitCount = REGULATORY_REPORTS.filter((r) => r.country === "KW" || r.country === "BOTH").length;
  const uaeCount = REGULATORY_REPORTS.filter((r) => r.country === "AE" || r.country === "BOTH").length;
  const dueCount = REGULATORY_REPORTS.filter((r) => r.status === "due" || r.status === "overdue").length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className={`text-2xl font-bold text-white ${isArabic ? "font-arabic" : "font-display"}`}>
            {isArabic ? "التقارير التنظيمية — الشرق الأوسط" : "Regulatory Reports — Middle East"}
          </h1>
          <p className={`text-gray-400 mt-1 text-sm ${isArabic ? "font-arabic" : ""}`}>
            {isArabic
              ? "تقارير الامتثال الثنائية اللغة للكويت والإمارات"
              : "Bilingual compliance reports for Kuwait (KPC/KOC) and UAE (ADNOC/NESA)"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-amber-400" />
          <Select value={countryFilter} onValueChange={(v) => setCountryFilter(v as "ALL" | "KW" | "AE")}>
            <SelectTrigger className="w-36 bg-gray-800 border-gray-700 text-white text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              <SelectItem value="ALL">{isArabic ? "الكل" : "All Countries"}</SelectItem>
              <SelectItem value="KW">🇰🇼 {isArabic ? "الكويت" : "Kuwait"}</SelectItem>
              <SelectItem value="AE">🇦🇪 {isArabic ? "الإمارات" : "UAE"}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { icon: Building2, label: isArabic ? "تقارير الكويت" : "Kuwait Reports", value: kuwaitCount, color: "text-blue-400" },
          { icon: Shield, label: isArabic ? "تقارير الإمارات" : "UAE Reports", value: uaeCount, color: "text-green-400" },
          { icon: Clock, label: isArabic ? "مستحق / متأخر" : "Due / Overdue", value: dueCount, color: "text-amber-400" },
          { icon: CheckCircle, label: isArabic ? "محدّث" : "Current", value: REGULATORY_REPORTS.length - dueCount, color: "text-emerald-400" },
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

      {/* Bilingual Report Grid */}
      <Tabs defaultValue="reports">
        <TabsList className="bg-gray-800/50 border border-gray-700">
          <TabsTrigger value="reports" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white text-gray-400">
            {isArabic ? "التقارير" : "Reports"}
          </TabsTrigger>
          <TabsTrigger value="standards" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white text-gray-400">
            {isArabic ? "المعايير" : "Standards"}
          </TabsTrigger>
          <TabsTrigger value="calendar" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white text-gray-400">
            {isArabic ? "التقويم" : "Calendar"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((report) => (
              <BilingualReportCard
                key={report.id}
                report={report}
                language={i18n.language}
                onGenerate={handleGenerate}
                onDownload={handleDownload}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="standards" className="mt-4">
          <Card className="bg-gray-900/60 border-gray-700/50">
            <CardHeader>
              <CardTitle className={`text-white text-base ${isArabic ? "font-arabic" : ""}`}>
                {isArabic ? "المعايير التنظيمية المطبّقة" : "Applicable Regulatory Standards"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className={`text-left py-2 text-gray-400 font-medium ${isArabic ? "text-right font-arabic" : ""}`}>
                        {isArabic ? "المعيار" : "Standard"}
                      </th>
                      <th className={`text-left py-2 text-gray-400 font-medium ${isArabic ? "text-right font-arabic" : ""}`}>
                        {isArabic ? "الجهة" : "Authority"}
                      </th>
                      <th className={`text-left py-2 text-gray-400 font-medium ${isArabic ? "text-right font-arabic" : ""}`}>
                        {isArabic ? "الدولة" : "Country"}
                      </th>
                      <th className={`text-left py-2 text-gray-400 font-medium ${isArabic ? "text-right font-arabic" : ""}`}>
                        {isArabic ? "الحالة" : "Status"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { std: "KOC-E-027 Rev 2", auth: isArabic ? "شركة نفط الكويت" : "Kuwait Oil Company", country: "🇰🇼 KW", status: "compliant" },
                      { std: "KPC-OPS-RPT-001", auth: isArabic ? "مؤسسة البترول الكويتية" : "Kuwait Petroleum Corp.", country: "🇰🇼 KW", status: "compliant" },
                      { std: "NCSC Decision 1/2025", auth: isArabic ? "المركز الوطني للأمن السيبراني" : "Kuwait NCSC", country: "🇰🇼 KW", status: "compliant" },
                      { std: "ADNOC-PROC-CTRL-001 Rev 3", auth: isArabic ? "أبوظبي الوطنية للنفط" : "ADNOC", country: "🇦🇪 AE", status: "partial" },
                      { std: "NESA IAS-188", auth: isArabic ? "الهيئة الوطنية للأمن الإلكتروني" : "UAE NESA", country: "🇦🇪 AE", status: "compliant" },
                      { std: "UAE TRA Cloud Policy", auth: isArabic ? "هيئة تنظيم الاتصالات" : "UAE TRA", country: "🇦🇪 AE", status: "compliant" },
                      { std: "IEC 62443 SL-2", auth: "IEC", country: "🌍 Both", status: "compliant" },
                      { std: "IEC 61511 SIL-2/3", auth: "IEC", country: "🌍 Both", status: "compliant" },
                      { std: "ISA-18.2", auth: "ISA", country: "🌍 Both", status: "compliant" },
                      { std: "ISO 45001:2018", auth: "ISO", country: "🌍 Both", status: "compliant" },
                    ].map(({ std, auth, country, status }) => (
                      <tr key={std} className="border-b border-gray-800 hover:bg-gray-800/30">
                        <td className="py-2 text-amber-400 font-mono text-xs">{std}</td>
                        <td className={`py-2 text-gray-300 text-xs ${isArabic ? "font-arabic" : ""}`}>{auth}</td>
                        <td className="py-2 text-gray-400 text-xs">{country}</td>
                        <td className="py-2">
                          <Badge
                            variant="outline"
                            className={status === "compliant"
                              ? "text-emerald-400 border-emerald-400/30 text-xs"
                              : "text-amber-400 border-amber-400/30 text-xs"}
                          >
                            {status === "compliant"
                              ? (isArabic ? "ممتثل" : "Compliant")
                              : (isArabic ? "جزئي" : "Partial")}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <Card className="bg-gray-900/60 border-gray-700/50">
            <CardHeader>
              <CardTitle className={`text-white text-base ${isArabic ? "font-arabic" : ""}`}>
                {isArabic ? "تقويم التقارير 2026" : "Reporting Calendar 2026"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-12 gap-1 text-xs">
                {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((month, i) => {
                  const monthAr = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"][i];
                  const hasDue = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].includes(i);
                  const isCurrentMonth = i === 2; // March
                  return (
                    <div
                      key={month}
                      className={`p-2 rounded text-center border ${
                        isCurrentMonth
                          ? "bg-amber-600/20 border-amber-500/40 text-amber-300"
                          : hasDue
                          ? "bg-gray-800/60 border-gray-700/50 text-gray-300"
                          : "bg-gray-900/40 border-gray-800/50 text-gray-500"
                      }`}
                    >
                      <div className={`font-medium ${isArabic ? "font-arabic text-xs" : ""}`}>
                        {isArabic ? monthAr : month}
                      </div>
                      {hasDue && (
                        <div className="mt-1 w-2 h-2 rounded-full bg-amber-400 mx-auto" />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  {isArabic ? "تقرير مستحق" : "Report due"}
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-amber-600" />
                  {isArabic ? "الشهر الحالي" : "Current month"}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Live DB Report History */}
      {dbReports.length > 0 && (
        <Card className="bg-gray-900/60 border-gray-700/50">
          <CardHeader className="pb-3">
            <CardTitle className={`text-white text-sm flex items-center gap-2 ${isArabic ? "font-arabic" : ""}`}>
              <FileText className="w-4 h-4 text-amber-400" />
              {isArabic ? "سجل التقارير (قاعدالبيانات)" : "Report History (Database)"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dbReports.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-2 rounded bg-gray-800/50">
                  <div>
                    <span className="text-xs font-mono text-amber-400">{r.reportId}</span>
                    <span className="text-xs text-gray-400 ml-2">{r.reportType}</span>
                    <span className="text-xs text-gray-500 ml-2">{r.period}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{r.language}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                      r.status === "ACCEPTED" ? "bg-emerald-900/30 text-emerald-400"
                      : r.status === "SUBMITTED" ? "bg-blue-900/30 text-blue-400"
                      : r.status === "REJECTED" ? "bg-red-900/30 text-red-400"
                      : "bg-gray-700 text-gray-400"
                    }`}>{r.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
