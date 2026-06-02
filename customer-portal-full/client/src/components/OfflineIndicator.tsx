import { useState, useEffect } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 3000);
      }
    };
    const goOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [wasOffline]);

  if (isOnline && !showReconnected) return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 py-2 px-4 text-xs font-medium transition-all duration-300",
        !isOnline
          ? "bg-destructive text-destructive-foreground"
          : "bg-green-600 text-white animate-in slide-in-from-top-2"
      )}
      role="status"
      aria-live="assertive"
    >
      {!isOnline ? (
        <>
          <WifiOff className="h-3.5 w-3.5" />
          <span>You are offline. Some features may be unavailable.</span>
        </>
      ) : (
        <>
          <Wifi className="h-3.5 w-3.5" />
          <span>Back online</span>
        </>
      )}
    </div>
  );
}
