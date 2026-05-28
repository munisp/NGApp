/**
 * useSwipeGesture — Detects horizontal swipe gestures from the screen edge.
 * Used to open/close the sidebar on mobile with a swipe.
 */
import { useCallback, useEffect, useRef } from "react";

interface SwipeGestureOptions {
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  edgeThreshold?: number;
  minDistance?: number;
}

export function useSwipeGesture({
  onSwipeRight,
  onSwipeLeft,
  edgeThreshold = 30,
  minDistance = 60,
}: SwipeGestureOptions) {
  const startX = useRef(0);
  const startY = useRef(0);
  const isEdgeSwipe = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    isEdgeSwipe.current = touch.clientX <= edgeThreshold || touch.clientX >= window.innerWidth - edgeThreshold;
  }, [edgeThreshold]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!isEdgeSwipe.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - startX.current;
    const dy = Math.abs(touch.clientY - startY.current);

    // Must be more horizontal than vertical
    if (dy > Math.abs(dx) * 0.75) return;

    if (dx > minDistance && onSwipeRight) {
      onSwipeRight();
    } else if (dx < -minDistance && onSwipeLeft) {
      onSwipeLeft();
    }

    isEdgeSwipe.current = false;
  }, [minDistance, onSwipeRight, onSwipeLeft]);

  useEffect(() => {
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd]);
}
