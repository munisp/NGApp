/**
 * CommandPalette — Ctrl+K / Cmd+K to search and jump to any page.
 * Uses the existing cmdk-based Command component.
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Activity, AlertTriangle, BarChart2, Brain, Calendar, CheckSquare,
  ClipboardList, Cloud, Container, CreditCard, Database, DollarSign,
  Drill, Droplet, Droplets, Eye, Factory, FileBarChart, FileCheck,
  FileText, FlaskConical, Gauge, GitBranch, Globe, Layers,
  LayoutDashboard, Lock, Map, Microscope, Monitor, Network, Package,
  Radio, RefreshCw, Satellite, Search, Server, Settings, Shield,
  ShieldAlert, Sliders, Target, TestTube, Thermometer, TrendingUp,
  Users, Waves, Webhook, Wind, Wrench, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface PageEntry {
  icon: LucideIcon;
  label: string;
  path: string;
  group: string;
  keywords?: string;
}

const pages: PageEntry[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/", group: "Overview", keywords: "home overview" },
  { icon: Map, label: "Field Map", path: "/map", group: "Overview", keywords: "gis location" },
  { icon: Activity, label: "Well KPI Dashboard", path: "/well-kpi-dashboard", group: "Overview", keywords: "kpi metrics" },
  { icon: Radio, label: "Telemetry Live", path: "/telemetry-dashboard", group: "Overview", keywords: "realtime sensor" },
  { icon: Drill, label: "Wells", path: "/wells", group: "Wells & Production", keywords: "well list" },
  { icon: TrendingUp, label: "Production Targets", path: "/production-targets", group: "Wells & Production" },
  { icon: TrendingUp, label: "Production Forecasting", path: "/production-forecasting", group: "Wells & Production" },
  { icon: Sliders, label: "Production Optimization", path: "/production-optimization", group: "Wells & Production" },
  { icon: Layers, label: "Production Allocation", path: "/production-allocation", group: "Wells & Production" },
  { icon: TestTube, label: "Well Tests", path: "/well-tests", group: "Wells & Production" },
  { icon: Wrench, label: "Workovers", path: "/workovers", group: "Wells & Production" },
  { icon: Gauge, label: "Reservoir Pressure", path: "/reservoir-pressure", group: "Reservoir & Geo" },
  { icon: Thermometer, label: "Wellbore Geomechanics", path: "/wellbore-geomechanics", group: "Reservoir & Geo" },
  { icon: FlaskConical, label: "Sand Management", path: "/sand-management", group: "Reservoir & Geo" },
  { icon: Wind, label: "Gas Well Liquid Loading", path: "/gas-well-liquid-loading", group: "Reservoir & Geo" },
  { icon: Waves, label: "Heavy Oil", path: "/heavy-oil", group: "Reservoir & Geo" },
  { icon: Microscope, label: "Mud Management", path: "/mud-management", group: "Reservoir & Geo" },
  { icon: Shield, label: "Wellbore Integrity", path: "/wellbore-integrity", group: "Reservoir & Geo" },
  { icon: Droplets, label: "Water Injection", path: "/water-injection", group: "Water & Injection" },
  { icon: Droplet, label: "Produced Water", path: "/produced-water", group: "Water & Injection" },
  { icon: Zap, label: "Rust Physics Engine", path: "/rust-physics-engine", group: "Physics & ML", keywords: "simulation" },
  { icon: Brain, label: "ML Insights", path: "/ml-insights", group: "Physics & ML", keywords: "machine learning" },
  { icon: Brain, label: "AI Advanced", path: "/ai-advanced", group: "Physics & ML", keywords: "federated gnn graph" },
  { icon: Brain, label: "AI Copilot", path: "/ai-copilot", group: "Physics & ML", keywords: "chat assistant" },
  { icon: GitBranch, label: "Digital Twin", path: "/digital-twin", group: "Physics & ML" },
  { icon: GitBranch, label: "Digital Twin v4.2", path: "/digital-twin-v42", group: "Physics & ML" },
  { icon: Satellite, label: "PWA Physics Twin", path: "/pwa-twin-physics", group: "Physics & ML", keywords: "offline" },
  { icon: AlertTriangle, label: "Alarms", path: "/alarms", group: "Alarms & Safety", keywords: "alert notification" },
  { icon: AlertTriangle, label: "Alarm Rules", path: "/alarm-rules", group: "Alarms & Safety" },
  { icon: FileCheck, label: "Permit to Work", path: "/permits", group: "Alarms & Safety", keywords: "ptw" },
  { icon: ShieldAlert, label: "HSE", path: "/hse", group: "Alarms & Safety", keywords: "health safety environment" },
  { icon: CheckSquare, label: "SIS", path: "/sis", group: "Alarms & Safety", keywords: "safety instrumented" },
  { icon: Network, label: "Device Management", path: "/device-management", group: "IoT & Devices" },
  { icon: RefreshCw, label: "OTA Management", path: "/ota-management", group: "IoT & Devices", keywords: "firmware update" },
  { icon: Sliders, label: "Actuator Control", path: "/actuator-control", group: "IoT & Devices" },
  { icon: Gauge, label: "Calibration", path: "/calibration", group: "IoT & Devices" },
  { icon: Satellite, label: "Connectivity", path: "/connectivity", group: "IoT & Devices" },
  { icon: Monitor, label: "FPSO", path: "/fpso", group: "IoT & Devices", keywords: "floating production" },
  { icon: BarChart2, label: "Analytics", path: "/analytics", group: "Analytics & Data" },
  { icon: Database, label: "Historian", path: "/historian", group: "Analytics & Data", keywords: "timeseries" },
  { icon: Database, label: "Lakehouse", path: "/lakehouse", group: "Analytics & Data" },
  { icon: Activity, label: "InfluxDB Benchmark", path: "/influx-benchmark", group: "Analytics & Data" },
  { icon: FileBarChart, label: "Data Export", path: "/data-export", group: "Analytics & Data" },
  { icon: Search, label: "OSDU Explorer", path: "/osdu-explorer", group: "Analytics & Data" },
  { icon: Monitor, label: "Grafana Dashboards", path: "/grafana-dashboards", group: "Analytics & Data" },
  { icon: DollarSign, label: "Financials", path: "/financials", group: "Financials" },
  { icon: CreditCard, label: "Billing", path: "/billing", group: "Financials" },
  { icon: Package, label: "Materials Management", path: "/materials-management", group: "Financials" },
  { icon: Shield, label: "Cybersecurity", path: "/cybersecurity", group: "Compliance", keywords: "security" },
  { icon: ShieldAlert, label: "IEC 62443", path: "/iec62443", group: "Compliance" },
  { icon: FileCheck, label: "SIL Certification", path: "/sil-certification", group: "Compliance" },
  { icon: Eye, label: "SOC 2", path: "/soc2", group: "Compliance", keywords: "audit" },
  { icon: FileText, label: "Regulatory", path: "/regulatory", group: "Compliance" },
  { icon: FileText, label: "Regulatory ME", path: "/regulatory-me", group: "Compliance", keywords: "middle east" },
  { icon: Calendar, label: "Reg. Scheduler", path: "/regulatory-scheduler", group: "Compliance" },
  { icon: Globe, label: "GCC Interop", path: "/gcc-interop", group: "Compliance" },
  { icon: ClipboardList, label: "Shift Handover", path: "/shift-handover", group: "Operations" },
  { icon: Wrench, label: "Damage Assessment", path: "/damage-assessment", group: "Operations" },
  { icon: Target, label: "Demand Response", path: "/demand-response", group: "Operations" },
  { icon: GitBranch, label: "Temporal Workflows", path: "/temporal-workflows", group: "Operations" },
  { icon: GitBranch, label: "Workflow Engine", path: "/workflow-engine", group: "Operations" },
  { icon: Factory, label: "Operations v4.2", path: "/operations-v42", group: "Operations" },
  { icon: Webhook, label: "Integrations", path: "/integrations-v42", group: "Integrations" },
  { icon: Server, label: "PI Connector", path: "/pi-connector", group: "Integrations" },
  { icon: Cloud, label: "SaaS Platform", path: "/saas-platform", group: "Integrations" },
  { icon: Container, label: "Infrastructure", path: "/infrastructure", group: "Infrastructure" },
  { icon: Users, label: "User Management", path: "/user-management", group: "Admin" },
  { icon: Lock, label: "Tenant Management", path: "/tenant-management", group: "Admin" },
  { icon: Settings, label: "Settings", path: "/settings", group: "Admin" },
  { icon: Database, label: "Seed Admin", path: "/seed-admin", group: "Admin" },
  { icon: FileText, label: "Audit Log", path: "/audit-log", group: "Admin" },
  { icon: Database, label: "Production Ledger", path: "/production-ledger", group: "Production Ledger" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const navigate = useCallback(
    (path: string) => {
      setLocation(path);
      setOpen(false);
    },
    [setLocation]
  );

  const groups = Array.from(new Set(pages.map((p) => p.group)));

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages… (Ctrl+K)" />
      <CommandList>
        <CommandEmpty>No pages found.</CommandEmpty>
        {groups.map((group) => (
          <CommandGroup key={group} heading={group}>
            {pages
              .filter((p) => p.group === group)
              .map((page) => (
                <CommandItem
                  key={page.path}
                  value={`${page.label} ${page.keywords ?? ""}`}
                  onSelect={() => navigate(page.path)}
                  className="gap-2"
                >
                  <page.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{page.label}</span>
                </CommandItem>
              ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
