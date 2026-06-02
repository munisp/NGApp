import { useState, useRef, useCallback, type ReactNode } from "react";
import { Loader2, ArrowDown } from "lucide-react";
import { useIsMobile } from "@/hooks/useMobile";
import { cn } from "@/lib/utils";

const THRESHOLD = 80;
const MAX_PULL = 120;

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh?: () => Promise<void> | void;
}

export default function PullToRefresh({
  children,
  onRefresh,
}: PullToRefreshProps) {
  const isMobile = useIsMobile();
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!isMobile || refreshing) return;
      const scrollTop = containerRef.current?.scrollTop ?? 0;
      if (scrollTop <= 0) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    },
    [isMobile, refreshing]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!pulling.current || refreshing) return;
      const currentY = e.touches[0].clientY;
      const diff = currentY - startY.current;
      if (diff > 0) {
        const dampened = Math.min(diff * 0.5, MAX_PULL);
        setPullDistance(dampened);
      }
    },
    [refreshing]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;

    if (pullDistance >= THRESHOLD && onRefresh) {
      setRefreshing(true);
      if (navigator.vibrate) navigator.vibrate(15);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, onRefresh]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);

  return (
    <div
      ref={containerRef}
      className="relative overflow-auto flex-1"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden transition-all",
          !pulling.current && !refreshing && "duration-300"
        )}
        style={{ height: refreshing ? 48 : pullDistance }}
      >
        {refreshing ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : pullDistance > 0 ? (
          <div
            className="flex items-center gap-1.5 text-muted-foreground"
            style={{
              opacity: progress,
              transform: `rotate(${progress * 180}deg)`,
            }}
          >
            <ArrowDown className="h-4 w-4" />
          </div>
        ) : null}
      </div>

      {children}
    </div>
  );
}
