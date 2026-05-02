import { useServiceWorker } from "@/hooks/useServiceWorker";
import { WifiOff, Wifi } from "lucide-react";
import { useEffect, useState } from "react";

export default function OfflineIndicator() {
  const { isOffline } = useServiceWorker();
  const [showBanner, setShowBanner] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (isOffline) {
      setShowBanner(true);
      setWasOffline(true);
    } else if (wasOffline) {
      // Show "back online" message briefly
      setShowBanner(true);
      const timer = setTimeout(() => {
        setShowBanner(false);
        setWasOffline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOffline, wasOffline]);

  if (!showBanner) {
    return null;
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-center text-sm font-medium transition-all duration-300 ${
        isOffline
          ? "bg-amber-500 text-amber-950"
          : "bg-green-500 text-green-950"
      }`}
    >
      <div className="flex items-center justify-center gap-2">
        {isOffline ? (
          <>
            <WifiOff className="h-4 w-4" />
            <span>You are offline. Some features may be limited.</span>
          </>
        ) : (
          <>
            <Wifi className="h-4 w-4" />
            <span>You are back online!</span>
          </>
        )}
      </div>
    </div>
  );
}
