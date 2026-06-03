import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Plus, X, FileText, Shield, Phone } from "lucide-react";
import { useIsMobile } from "@/hooks/useMobile";
import { cn } from "@/lib/utils";

const QUICK_ACTIONS = [
  { label: "File Claim", icon: FileText, path: "/claims", color: "bg-blue-600" },
  { label: "Get Quote", icon: Shield, path: "/insurance-marketplace", color: "bg-green-600" },
  { label: "Emergency", icon: Phone, path: "/emergency-sos", color: "bg-red-600" },
] as const;

export default function FloatingActionButton() {
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();
  const [expanded, setExpanded] = useState(false);

  const handleAction = useCallback(
    (path: string) => {
      setLocation(path);
      setExpanded(false);
      if (navigator.vibrate) navigator.vibrate(10);
    },
    [setLocation]
  );

  if (!isMobile) return null;

  return (
    <div className="fixed bottom-[88px] right-4 z-50 flex flex-col-reverse items-end gap-3">
      {expanded &&
        QUICK_ACTIONS.map((action, i) => (
          <button
            key={action.label}
            onClick={() => handleAction(action.path)}
            className={cn(
              "flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full shadow-lg text-white text-sm font-medium",
              "animate-in slide-in-from-bottom-2 fade-in duration-200",
              action.color
            )}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <action.icon className="h-4 w-4" />
            {action.label}
          </button>
        ))}

      <button
        onClick={() => {
          setExpanded(!expanded);
          if (navigator.vibrate) navigator.vibrate(10);
        }}
        className={cn(
          "h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg",
          "flex items-center justify-center transition-transform duration-200",
          "active:scale-95 hover:shadow-xl",
          expanded && "rotate-45"
        )}
        aria-label={expanded ? "Close quick actions" : "Quick actions"}
        aria-expanded={expanded}
      >
        {expanded ? (
          <X className="h-6 w-6" />
        ) : (
          <Plus className="h-6 w-6" />
        )}
      </button>
    </div>
  );
}
