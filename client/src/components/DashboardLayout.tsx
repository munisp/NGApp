import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  Activity, AlertTriangle, BarChart2, Bell, BookOpen, Brain,
  Calendar, CheckSquare, ChevronDown, ChevronRight,
  ClipboardList, Cloud, Container, CreditCard, Database, DollarSign,
  Drill, Droplet, Droplets, Eye, Factory, FileBarChart, FileCheck,
  FileText, FlaskConical, Gauge, GitBranch, Globe,
  Layers, LayoutDashboard, Lock, LogOut, Map, Microscope, Monitor,
  Network, Package, PanelLeft, Radio, RefreshCw, Satellite, Search,
  Server, Settings, Shield, ShieldAlert, Sliders, Target, TestTube,
  Thermometer, TrendingUp, Users, Waves, Webhook, Wind, Wrench, Zap
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";

interface NavItem { icon: LucideIcon; label: string; path: string; }
interface NavGroup { label: string; icon: LucideIcon; items: NavItem[]; }

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    icon: LayoutDashboard,
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/" },
      { icon: Map, label: "Field Map", path: "/map" },
      { icon: Activity, label: "Well KPI Dashboard", path: "/well-kpi-dashboard" },
      { icon: Radio, label: "Telemetry Live", path: "/telemetry-dashboard" },
    ],
  },
  {
    label: "Wells & Production",
    icon: Drill,
    items: [
      { icon: Drill, label: "Wells", path: "/wells" },
      { icon: TrendingUp, label: "Production Targets", path: "/production-targets" },
      { icon: TrendingUp, label: "Production Forecasting", path: "/production-forecasting" },
      { icon: Sliders, label: "Production Optimization", path: "/production-optimization" },
      { icon: Layers, label: "Production Allocation", path: "/production-allocation" },
      { icon: TestTube, label: "Well Tests", path: "/well-tests" },
      { icon: Wrench, label: "Workovers", path: "/workovers" },
    ],
  },
  {
    label: "Reservoir & Geo",
    icon: Layers,
    items: [
      { icon: Gauge, label: "Reservoir Pressure", path: "/reservoir-pressure" },
      { icon: Thermometer, label: "Wellbore Geomechanics", path: "/wellbore-geomechanics" },
      { icon: FlaskConical, label: "Sand Management", path: "/sand-management" },
      { icon: Wind, label: "Gas Well Liquid Loading", path: "/gas-well-liquid-loading" },
      { icon: Waves, label: "Heavy Oil", path: "/heavy-oil" },
      { icon: Microscope, label: "Mud Management", path: "/mud-management" },
      { icon: Shield, label: "Wellbore Integrity", path: "/wellbore-integrity" },
    ],
  },
  {
    label: "Water & Injection",
    icon: Droplets,
    items: [
      { icon: Droplets, label: "Water Injection", path: "/water-injection" },
      { icon: Droplet, label: "Produced Water", path: "/produced-water" },
    ],
  },
  {
    label: "Physics & ML",
    icon: Brain,
    items: [
      { icon: Zap, label: "Rust Physics Engine", path: "/rust-physics-engine" },
      { icon: Brain, label: "ML Insights", path: "/ml-insights" },
      { icon: Brain, label: "AI Advanced", path: "/ai-advanced" },
      { icon: Brain, label: "AI Copilot", path: "/ai-copilot" },
      { icon: GitBranch, label: "Digital Twin", path: "/digital-twin" },
      { icon: GitBranch, label: "Digital Twin v4.2", path: "/digital-twin-v42" },
      { icon: Satellite, label: "PWA Physics Twin", path: "/pwa-twin-physics" },
    ],
  },
  {
    label: "Alarms & Safety",
    icon: AlertTriangle,
    items: [
      { icon: AlertTriangle, label: "Alarms", path: "/alarms" },
      { icon: Bell, label: "Alarm Rules", path: "/alarm-rules" },
      { icon: FileCheck, label: "Permit to Work", path: "/permits" },
      { icon: ShieldAlert, label: "HSE", path: "/hse" },
      { icon: CheckSquare, label: "SIS", path: "/sis" },
    ],
  },
  {
    label: "IoT & Devices",
    icon: Network,
    items: [
      { icon: Network, label: "Device Management", path: "/device-management" },
      { icon: RefreshCw, label: "OTA Management", path: "/ota-management" },
      { icon: Sliders, label: "Actuator Control", path: "/actuator-control" },
      { icon: Gauge, label: "Calibration", path: "/calibration" },
      { icon: Satellite, label: "Connectivity", path: "/connectivity" },
      { icon: Monitor, label: "FPSO", path: "/fpso" },
    ],
  },
  {
    label: "Analytics & Data",
    icon: BarChart2,
    items: [
      { icon: BarChart2, label: "Analytics", path: "/analytics" },
      { icon: Database, label: "Historian", path: "/historian" },
      { icon: Database, label: "Lakehouse", path: "/lakehouse" },
      { icon: Activity, label: "InfluxDB Benchmark", path: "/influx-benchmark" },
      { icon: FileBarChart, label: "Data Export", path: "/data-export" },
      { icon: Search, label: "OSDU Explorer", path: "/osdu-explorer" },
      { icon: Monitor, label: "Grafana Dashboards", path: "/grafana-dashboards" },
    ],
  },
  {
    label: "Financials",
    icon: DollarSign,
    items: [
      { icon: DollarSign, label: "Financials", path: "/financials" },
      { icon: CreditCard, label: "Billing", path: "/billing" },
      { icon: Package, label: "Materials Mgmt", path: "/materials-management" },
    ],
  },
  {
    label: "Compliance",
    icon: Shield,
    items: [
      { icon: Shield, label: "Cybersecurity", path: "/cybersecurity" },
      { icon: ShieldAlert, label: "IEC 62443", path: "/iec62443" },
      { icon: FileCheck, label: "SIL Certification", path: "/sil-certification" },
      { icon: BookOpen, label: "SOC 2", path: "/soc2" },
      { icon: FileText, label: "Regulatory", path: "/regulatory" },
      { icon: FileText, label: "Regulatory ME", path: "/regulatory-me" },
      { icon: Calendar, label: "Reg. Scheduler", path: "/regulatory-scheduler" },
      { icon: Globe, label: "GCC Interop", path: "/gcc-interop" },
    ],
  },
  {
    label: "Operations",
    icon: ClipboardList,
    items: [
      { icon: ClipboardList, label: "Shift Handover", path: "/shift-handover" },
      { icon: Wrench, label: "Damage Assessment", path: "/damage-assessment" },
      { icon: Target, label: "Demand Response", path: "/demand-response" },
      { icon: GitBranch, label: "Temporal Workflows", path: "/temporal-workflows" },
      { icon: Factory, label: "Operations v4.2", path: "/operations-v42" },
    ],
  },
  {
    label: "Integrations",
    icon: Webhook,
    items: [
      { icon: Webhook, label: "Integrations", path: "/integrations-v42" },
      { icon: Server, label: "PI Connector", path: "/pi-connector" },
      { icon: Cloud, label: "SaaS Platform", path: "/saas-platform" },
    ],
  },
  {
    label: "Infrastructure",
    icon: Container,
    items: [
      { icon: Container, label: "Infrastructure", path: "/infrastructure" },
      { icon: Layers, label: "SIL", path: "/sil" },
    ],
  },
  {
    label: "Admin",
    icon: Settings,
    items: [
      { icon: Users, label: "User Management", path: "/user-management" },
      { icon: Settings, label: "Settings", path: "/settings" },
      { icon: Database, label: "Seed Admin", path: "/seed-admin" },
    ],
  },
];

const allNavItems: NavItem[] = navGroups.flatMap(g => g.items);

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  const [location] = useLocation();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set(navGroups.map(g => g.label)));
  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  };

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Access to this dashboard requires authentication. Continue to launch the login flow.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = allNavItems.find(item => item.path === location);
  const isMobile = useIsMobile();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set(navGroups.map(g => g.label)));
  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  };

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold tracking-tight truncate">
                    Navigation
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 overflow-y-auto">
            {navGroups.map(group => {
              const isExpanded = expandedGroups.has(group.label);
              const GroupIcon = group.icon;
              const hasActive = group.items.some(i => i.path === location);
              return (
                <div key={group.label}>
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors group-data-[collapsible=icon]:hidden ${
                      hasActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <GroupIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="flex-1 text-left">{group.label}</span>
                    {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </button>
                  {isExpanded && (
                    <SidebarMenu className="px-2 pb-1">
                      {group.items.map(item => {
                        const isActive = location === item.path;
                        return (
                          <SidebarMenuItem key={item.path}>
                            <SidebarMenuButton
                              isActive={isActive}
                              onClick={() => setLocation(item.path)}
                              tooltip={item.label as string}
                              className="h-8 text-sm font-normal"
                            >
                              <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : ""}`} aria-hidden="true" />
                              <span className="truncate">{item.label}</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  )}
                </div>
              );
            })}
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "Menu"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-4">{children}</main>
      </SidebarInset>
    </>
  );
}
