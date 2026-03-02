"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Database,
  RefreshCw,
  Wifi,
  WifiOff,
  ExternalLink,
  TrendingUp,
  Globe,
  Building2,
  Calendar,
  BarChart3,
  Activity,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api-client";

// ── Types ──────────────────────────────────────────────────────────────────

interface ProviderStatus {
  name: string;
  type: string;
  connected: boolean;
  fallbackMode: boolean;
  requestsOK: number;
  requestsFail: number;
  description: string;
  endpoint: string;
  docsURL: string;
}

interface CentralBankRate {
  bank: string;
  currency: string;
  rate: number;
  previousRate: number;
  lastChanged: string;
  nextMeeting: string;
  direction: string;
}

interface EconomicEvent {
  date: string;
  time: string;
  currency: string;
  event: string;
  impact: string;
  forecast: string;
  previous: string;
  actual: string;
}

interface ExchangeRate {
  pair: string;
  rate: number;
  source: string;
  lastUpdated: string;
}

// ── Mock Data (fallback) ──────────────────────────────────────────────────

const MOCK_PROVIDERS: Record<string, ProviderStatus> = {
  oanda: {
    name: "OANDA v20",
    type: "FX Price Feed",
    connected: false,
    fallbackMode: true,
    requestsOK: 0,
    requestsFail: 0,
    description: "Real-time forex bid/ask prices, historical candles, instrument metadata",
    endpoint: "https://api-fxtrade.oanda.com/v3",
    docsURL: "https://developer.oanda.com/rest-live-v20/pricing-ep/",
  },
  polygon: {
    name: "Polygon.io",
    type: "US Equities / NYSE",
    connected: false,
    fallbackMode: true,
    requestsOK: 0,
    requestsFail: 0,
    description: "Real-time US stock quotes, aggregates, ticker details, exchanges",
    endpoint: "https://api.polygon.io",
    docsURL: "https://polygon.io/docs/stocks",
  },
  iex: {
    name: "IEX Cloud",
    type: "Reference Data / Fundamentals",
    connected: false,
    fallbackMode: true,
    requestsOK: 0,
    requestsFail: 0,
    description: "Company info, earnings, dividends, key stats, CUSIP/ISIN lookups",
    endpoint: "https://cloud.iexapis.com/stable",
    docsURL: "https://iexcloud.io/docs/api/",
  },
  calendar: {
    name: "Economic Calendar",
    type: "Central Bank Rates & Events",
    connected: false,
    fallbackMode: true,
    requestsOK: 0,
    requestsFail: 0,
    description: "ECB/FRED/BoE rates, economic events, swap rates, reference FX rates",
    endpoint: "ECB SDW + FRED API + BoE API",
    docsURL: "https://data-api.ecb.europa.eu/",
  },
};

const MOCK_CB_RATES: CentralBankRate[] = [
  { bank: "Federal Reserve (Fed)", currency: "USD", rate: 5.50, previousRate: 5.25, lastChanged: "2024-07-26", nextMeeting: "2026-03-18", direction: "hold" },
  { bank: "European Central Bank (ECB)", currency: "EUR", rate: 4.50, previousRate: 4.25, lastChanged: "2024-09-12", nextMeeting: "2026-03-06", direction: "hold" },
  { bank: "Bank of England (BoE)", currency: "GBP", rate: 5.25, previousRate: 5.00, lastChanged: "2024-08-01", nextMeeting: "2026-03-20", direction: "hold" },
  { bank: "Bank of Japan (BoJ)", currency: "JPY", rate: 0.25, previousRate: 0.10, lastChanged: "2024-07-31", nextMeeting: "2026-03-14", direction: "hike" },
  { bank: "Central Bank of Nigeria (CBN)", currency: "NGN", rate: 27.50, previousRate: 27.25, lastChanged: "2024-11-26", nextMeeting: "2026-03-25", direction: "hold" },
  { bank: "Swiss National Bank (SNB)", currency: "CHF", rate: 1.75, previousRate: 1.50, lastChanged: "2024-06-22", nextMeeting: "2026-03-21", direction: "hold" },
  { bank: "Reserve Bank of Australia (RBA)", currency: "AUD", rate: 4.35, previousRate: 4.10, lastChanged: "2024-11-07", nextMeeting: "2026-03-18", direction: "hold" },
];

const MOCK_EVENTS: EconomicEvent[] = [
  { date: "2026-03-03", time: "10:00", currency: "USD", event: "ISM Manufacturing PMI", impact: "high", forecast: "49.5", previous: "49.2", actual: "" },
  { date: "2026-03-04", time: "10:00", currency: "USD", event: "Factory Orders m/m", impact: "medium", forecast: "0.3%", previous: "-0.4%", actual: "" },
  { date: "2026-03-05", time: "08:15", currency: "USD", event: "ADP Non-Farm Employment", impact: "high", forecast: "150K", previous: "143K", actual: "" },
  { date: "2026-03-06", time: "13:45", currency: "EUR", event: "ECB Interest Rate Decision", impact: "high", forecast: "4.50%", previous: "4.50%", actual: "" },
  { date: "2026-03-07", time: "08:30", currency: "USD", event: "Non-Farm Payrolls", impact: "high", forecast: "185K", previous: "175K", actual: "" },
  { date: "2026-03-07", time: "08:30", currency: "USD", event: "Unemployment Rate", impact: "high", forecast: "3.8%", previous: "3.7%", actual: "" },
  { date: "2026-03-10", time: "10:00", currency: "NGN", event: "CBN Monetary Policy Rate", impact: "high", forecast: "27.50%", previous: "27.50%", actual: "" },
];

const MOCK_FX_RATES: ExchangeRate[] = [
  { pair: "EUR/USD", rate: 1.0853, source: "ECB Reference", lastUpdated: "2026-03-02T16:00:00Z" },
  { pair: "GBP/USD", rate: 1.2641, source: "BoE Reference", lastUpdated: "2026-03-02T16:00:00Z" },
  { pair: "USD/JPY", rate: 149.85, source: "BoJ Reference", lastUpdated: "2026-03-02T16:00:00Z" },
  { pair: "USD/NGN", rate: 1580.50, source: "CBN Official", lastUpdated: "2026-03-02T16:00:00Z" },
  { pair: "USD/CHF", rate: 0.8812, source: "SNB Reference", lastUpdated: "2026-03-02T16:00:00Z" },
  { pair: "AUD/USD", rate: 0.6542, source: "RBA Reference", lastUpdated: "2026-03-02T16:00:00Z" },
];

// ── Helpers ─────────────────────────────────────────────────────────────

function impactColor(impact: string): string {
  switch (impact) {
    case "high": return "text-red-400";
    case "medium": return "text-yellow-400";
    case "low": return "text-green-400";
    default: return "text-gray-400";
  }
}

function directionLabel(dir: string): string {
  switch (dir) {
    case "hike": return "Hiking";
    case "cut": return "Cutting";
    case "hold": return "On Hold";
    default: return dir;
  }
}

function directionColor(dir: string): string {
  switch (dir) {
    case "hike": return "text-red-400";
    case "cut": return "text-green-400";
    case "hold": return "text-yellow-400";
    default: return "text-gray-400";
  }
}

// ── Main Page ───────────────────────────────────────────────────────────

type TabType = "sources" | "central-bank" | "calendar" | "fx-rates";

export default function MarketDataPage() {
  const [tab, setTab] = useState<TabType>("sources");
  const [providers, setProviders] = useState<Record<string, ProviderStatus>>(MOCK_PROVIDERS);
  const [cbRates, setCbRates] = useState<CentralBankRate[]>(MOCK_CB_RATES);
  const [events, setEvents] = useState<EconomicEvent[]>(MOCK_EVENTS);
  const [fxRates, setFxRates] = useState<ExchangeRate[]>(MOCK_FX_RATES);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, cbRes, eventsRes, ratesRes] = await Promise.allSettled([
        api.marketData.status(),
        api.marketData.centralBankRates(),
        api.marketData.economicEvents(),
        api.marketData.exchangeRates(),
      ]);

      type ExtractType<T> = T extends { data?: infer D } ? D : never;
      const extract = <T extends { data?: unknown }>(r: PromiseSettledResult<T>): ExtractType<T> | null =>
        r.status === "fulfilled" && r.value?.data ? (r.value.data as ExtractType<T>) : null;

      const statusData = extract(statusRes) as Record<string, ProviderStatus> | null;
      const cbData = extract(cbRes) as CentralBankRate[] | null;
      const eventsData = extract(eventsRes) as EconomicEvent[] | null;
      const ratesData = extract(ratesRes) as ExchangeRate[] | null;

      if (statusData) setProviders(statusData);
      if (cbData && Array.isArray(cbData)) setCbRates(cbData);
      if (eventsData && Array.isArray(eventsData)) setEvents(eventsData);
      if (ratesData && Array.isArray(ratesData)) setFxRates(ratesData);

      setLastRefresh(new Date());
    } catch {
      // Keep mock data on failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const providerList = Object.entries(providers);
  const connectedCount = providerList.filter(([, p]) => p.connected).length;
  const fallbackCount = providerList.filter(([, p]) => p.fallbackMode).length;
  const totalRequests = providerList.reduce((acc, [, p]) => acc + p.requestsOK + p.requestsFail, 0);
  const failedRequests = providerList.reduce((acc, [, p]) => acc + p.requestsFail, 0);

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: "sources", label: "Data Sources", icon: <Database className="h-4 w-4" /> },
    { id: "central-bank", label: "Central Bank Rates", icon: <Building2 className="h-4 w-4" /> },
    { id: "calendar", label: "Economic Calendar", icon: <Calendar className="h-4 w-4" /> },
    { id: "fx-rates", label: "Reference FX Rates", icon: <Globe className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)" }}>
            <Database className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Market Data Sources</h1>
            <p className="text-xs text-gray-400">
              External feeds powering forex, equities, and reference data
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            <Clock className="mr-1 inline h-3 w-3" />
            {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-white/5 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard
          label="Connected"
          value={`${connectedCount}/${providerList.length}`}
          icon={<Wifi className="h-4 w-4" />}
          color={connectedCount === providerList.length ? "emerald" : "yellow"}
        />
        <SummaryCard
          label="Fallback Mode"
          value={String(fallbackCount)}
          icon={<AlertTriangle className="h-4 w-4" />}
          color={fallbackCount === 0 ? "emerald" : "yellow"}
        />
        <SummaryCard
          label="Total Requests"
          value={totalRequests.toLocaleString()}
          icon={<Activity className="h-4 w-4" />}
          color="blue"
        />
        <SummaryCard
          label="Failed Requests"
          value={failedRequests.toLocaleString()}
          icon={<BarChart3 className="h-4 w-4" />}
          color={failedRequests === 0 ? "emerald" : "red"}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-white/[0.03] p-1 border border-white/[0.06]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              tab === t.id
                ? "bg-white/10 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
            }`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "sources" && <SourcesTab providers={providerList} />}
      {tab === "central-bank" && <CentralBankTab rates={cbRates} />}
      {tab === "calendar" && <CalendarTab events={events} />}
      {tab === "fx-rates" && <FXRatesTab rates={fxRates} />}
    </div>
  );
}

// ── Summary Card ────────────────────────────────────────────────────────

function SummaryCard({ label, value, icon, color }: {
  label: string; value: string; icon: React.ReactNode; color: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-400",
    yellow: "from-yellow-500/20 to-yellow-500/5 border-yellow-500/20 text-yellow-400",
    blue: "from-blue-500/20 to-blue-500/5 border-blue-500/20 text-blue-400",
    red: "from-red-500/20 to-red-500/5 border-red-500/20 text-red-400",
  };
  const cls = colorMap[color] || colorMap.blue;

  return (
    <div className={`rounded-xl border bg-gradient-to-br p-4 ${cls}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400">{label}</span>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

// ── Data Sources Tab ────────────────────────────────────────────────────

function SourcesTab({ providers }: { providers: [string, ProviderStatus][] }) {
  const iconMap: Record<string, React.ReactNode> = {
    oanda: <Globe className="h-6 w-6" />,
    polygon: <TrendingUp className="h-6 w-6" />,
    iex: <Building2 className="h-6 w-6" />,
    calendar: <Calendar className="h-6 w-6" />,
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {providers.map(([key, provider]) => (
        <div
          key={key}
          className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all hover:border-white/10"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                provider.connected ? "bg-emerald-500/20 text-emerald-400" : "bg-yellow-500/20 text-yellow-400"
              }`}>
                {iconMap[key] || <Database className="h-6 w-6" />}
              </div>
              <div>
                <h3 className="font-semibold text-white">{provider.name}</h3>
                <p className="text-xs text-gray-500">{provider.type}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {provider.connected ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-400">
                  <Wifi className="h-3 w-3" /> Live
                </span>
              ) : provider.fallbackMode ? (
                <span className="flex items-center gap-1 rounded-full bg-yellow-500/20 px-2.5 py-1 text-xs font-medium text-yellow-400">
                  <WifiOff className="h-3 w-3" /> Fallback
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2.5 py-1 text-xs font-medium text-red-400">
                  <WifiOff className="h-3 w-3" /> Offline
                </span>
              )}
            </div>
          </div>

          <p className="mt-3 text-sm text-gray-400">{provider.description}</p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-white/[0.03] p-2.5">
              <p className="text-[10px] font-medium uppercase text-gray-500">Successful</p>
              <p className="text-lg font-bold text-emerald-400">{provider.requestsOK.toLocaleString()}</p>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-2.5">
              <p className="text-[10px] font-medium uppercase text-gray-500">Failed</p>
              <p className="text-lg font-bold text-red-400">{provider.requestsFail.toLocaleString()}</p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-white/[0.04] pt-3">
            <code className="text-[11px] text-gray-600 truncate max-w-[200px]">{provider.endpoint}</code>
            <a
              href={provider.docsURL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Docs <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Central Bank Rates Tab ──────────────────────────────────────────────

function CentralBankTab({ rates }: { rates: CentralBankRate[] }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left">
              <th className="px-4 py-3 font-medium text-gray-400">Central Bank</th>
              <th className="px-4 py-3 font-medium text-gray-400">Currency</th>
              <th className="px-4 py-3 font-medium text-gray-400 text-right">Rate</th>
              <th className="px-4 py-3 font-medium text-gray-400 text-right">Previous</th>
              <th className="px-4 py-3 font-medium text-gray-400">Direction</th>
              <th className="px-4 py-3 font-medium text-gray-400">Last Changed</th>
              <th className="px-4 py-3 font-medium text-gray-400">Next Meeting</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((rate) => (
              <tr key={rate.bank} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3 font-medium text-white">{rate.bank}</td>
                <td className="px-4 py-3">
                  <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-xs font-mono text-gray-300">
                    {rate.currency}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono font-bold text-white">{rate.rate.toFixed(2)}%</td>
                <td className="px-4 py-3 text-right font-mono text-gray-500">{rate.previousRate.toFixed(2)}%</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${directionColor(rate.direction)}`}>
                    {directionLabel(rate.direction)}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400">{rate.lastChanged}</td>
                <td className="px-4 py-3 text-gray-400">{rate.nextMeeting}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Economic Calendar Tab ───────────────────────────────────────────────

function CalendarTab({ events }: { events: EconomicEvent[] }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left">
              <th className="px-4 py-3 font-medium text-gray-400">Date</th>
              <th className="px-4 py-3 font-medium text-gray-400">Time</th>
              <th className="px-4 py-3 font-medium text-gray-400">Currency</th>
              <th className="px-4 py-3 font-medium text-gray-400">Event</th>
              <th className="px-4 py-3 font-medium text-gray-400">Impact</th>
              <th className="px-4 py-3 font-medium text-gray-400 text-right">Forecast</th>
              <th className="px-4 py-3 font-medium text-gray-400 text-right">Previous</th>
              <th className="px-4 py-3 font-medium text-gray-400 text-right">Actual</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event, i) => (
              <tr key={`${event.date}-${event.event}-${i}`} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3 text-gray-300">{event.date}</td>
                <td className="px-4 py-3 text-gray-400">{event.time} UTC</td>
                <td className="px-4 py-3">
                  <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-xs font-mono text-gray-300">
                    {event.currency}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-white">{event.event}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-bold uppercase ${impactColor(event.impact)}`}>
                    {event.impact}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-300">{event.forecast || "—"}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-500">{event.previous || "—"}</td>
                <td className="px-4 py-3 text-right font-mono text-white">{event.actual || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Reference FX Rates Tab ──────────────────────────────────────────────

function FXRatesTab({ rates }: { rates: ExchangeRate[] }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left">
              <th className="px-4 py-3 font-medium text-gray-400">Pair</th>
              <th className="px-4 py-3 font-medium text-gray-400 text-right">Rate</th>
              <th className="px-4 py-3 font-medium text-gray-400">Source</th>
              <th className="px-4 py-3 font-medium text-gray-400">Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((rate) => (
              <tr key={rate.pair} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3 font-mono font-bold text-white">{rate.pair}</td>
                <td className="px-4 py-3 text-right font-mono text-lg font-bold text-white">
                  {rate.rate < 10 ? rate.rate.toFixed(4) : rate.rate.toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-medium text-blue-400">
                    {rate.source}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {new Date(rate.lastUpdated).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
