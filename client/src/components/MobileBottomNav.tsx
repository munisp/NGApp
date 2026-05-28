/**
 * MobileBottomNav — Fixed bottom tab bar for mobile PWA (visible < 768px).
 * Provides quick access to 5 key sections without opening the hamburger menu.
 */
import { useLocation } from "wouter";
import { LayoutDashboard, Drill, AlertTriangle, Brain, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/useMobile";

interface TabItem {
  icon: LucideIcon;
  label: string;
  path: string;
  matchPaths?: string[];
}

const tabs: TabItem[] = [
  { icon: LayoutDashboard, label: "Home", path: "/", matchPaths: ["/", "/well-kpi-dashboard", "/map", "/telemetry-dashboard"] },
  { icon: Drill, label: "Wells", path: "/wells", matchPaths: ["/wells", "/workovers", "/well-tests", "/production-targets"] },
  { icon: AlertTriangle, label: "Alarms", path: "/alarms", matchPaths: ["/alarms", "/alarm-rules", "/permits", "/hse"] },
  { icon: Brain, label: "AI / ML", path: "/ml-insights", matchPaths: ["/ml-insights", "/ai-advanced", "/rust-physics-engine", "/digital-twin"] },
  { icon: Settings, label: "More", path: "/settings", matchPaths: ["/settings", "/infrastructure", "/analytics"] },
];

export function MobileBottomNav() {
  const isMobile = useIsMobile();
  const [location, setLocation] = useLocation();

  if (!isMobile) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur safe-area-inset-bottom">
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const isActive = tab.matchPaths?.includes(location) ?? location === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => setLocation(tab.path)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground active:text-foreground"
              }`}
            >
              <tab.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
