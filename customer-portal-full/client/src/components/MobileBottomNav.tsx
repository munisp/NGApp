import { useLocation } from "wouter";
import {
  LayoutDashboard,
  Shield,
  FileText,
  CreditCard,
  MoreHorizontal,
} from "lucide-react";
import { useIsMobile } from "@/hooks/useMobile";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Home", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Policies", icon: Shield, path: "/policies" },
  { label: "Claims", icon: FileText, path: "/claims" },
  { label: "Payments", icon: CreditCard, path: "/payments" },
  { label: "More", icon: MoreHorizontal, path: "__more__" },
] as const;

interface MobileBottomNavProps {
  onMorePress: () => void;
}

export default function MobileBottomNav({ onMorePress }: MobileBottomNavProps) {
  const isMobile = useIsMobile();
  const [location, setLocation] = useLocation();

  if (!isMobile) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-around h-16 px-1">
        {NAV_ITEMS.map((item) => {
          const isMore = item.path === "__more__";
          const isActive = !isMore && location === item.path;
          const Icon = item.icon;

          return (
            <button
              key={item.label}
              onClick={() => {
                if (isMore) {
                  onMorePress();
                } else {
                  setLocation(item.path);
                  if (navigator.vibrate) navigator.vibrate(10);
                }
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 min-w-[64px] h-12 rounded-xl transition-all duration-200 active:scale-95",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-7 rounded-full transition-all duration-200",
                  isActive && "bg-primary/10"
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 transition-all duration-200",
                    isActive && "scale-110"
                  )}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </div>
              <span
                className={cn(
                  "text-[10px] leading-tight font-medium transition-all duration-200",
                  isActive && "font-semibold"
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
