/**
 * PullToRefreshIndicator — Visual pull-down indicator for mobile PWA.
 */
import { RefreshCw } from "lucide-react";

interface Props {
  pullDistance: number;
  isRefreshing: boolean;
  isReady: boolean;
}

export function PullToRefreshIndicator({ pullDistance, isRefreshing, isReady }: Props) {
  if (pullDistance === 0 && !isRefreshing) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center pointer-events-none transition-transform"
      style={{ transform: `translateY(${Math.min(pullDistance, 80)}px)` }}
    >
      <div
        className={`flex items-center gap-2 rounded-full px-4 py-2 shadow-lg text-sm font-medium ${
          isReady || isRefreshing
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        }`}
      >
        <RefreshCw
          className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
          style={!isRefreshing ? { transform: `rotate(${pullDistance * 3}deg)` } : undefined}
        />
        {isRefreshing ? "Refreshing…" : isReady ? "Release to refresh" : "Pull to refresh"}
      </div>
    </div>
  );
}
