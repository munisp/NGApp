import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';

interface UseIdleDetectionOptions {
  /**
   * Idle timeout in milliseconds (default: 15 minutes)
   */
  idleTimeout?: number;
  
  /**
   * Warning time before logout in milliseconds (default: 2 minutes)
   */
  warningTime?: number;
  
  /**
   * Whether idle detection is enabled (default: true)
   */
  enabled?: boolean;
  
  /**
   * Callback when user becomes idle
   */
  onIdle?: () => void;
  
  /**
   * Callback when warning is shown
   */
  onWarning?: () => void;
  
  /**
   * Callback when user becomes active again
   */
  onActive?: () => void;
}

interface UseIdleDetectionReturn {
  /**
   * Whether user is currently idle
   */
  isIdle: boolean;
  
  /**
   * Whether warning is currently shown
   */
  showWarning: boolean;
  
  /**
   * Remaining time until logout (in seconds)
   */
  remainingTime: number;
  
  /**
   * Reset the idle timer
   */
  resetTimer: () => void;
  
  /**
   * Manually trigger logout
   */
  logout: () => void;
}

const DEFAULT_IDLE_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const DEFAULT_WARNING_TIME = 2 * 60 * 1000; // 2 minutes

/**
 * Hook to detect user inactivity and automatically logout
 * 
 * @example
 * ```tsx
 * const { showWarning, remainingTime, resetTimer, logout } = useIdleDetection({
 *   idleTimeout: 15 * 60 * 1000, // 15 minutes
 *   warningTime: 2 * 60 * 1000,  // 2 minutes
 *   onWarning: () => console.log('Warning shown'),
 *   onIdle: () => console.log('User is idle'),
 * });
 * 
 * if (showWarning) {
 *   return (
 *     <Dialog>
 *       <p>You will be logged out in {remainingTime} seconds</p>
 *       <Button onClick={resetTimer}>Stay Logged In</Button>
 *       <Button onClick={logout}>Logout Now</Button>
 *     </Dialog>
 *   );
 * }
 * ```
 */
export function useIdleDetection(options: UseIdleDetectionOptions = {}): UseIdleDetectionReturn {
  const {
    idleTimeout = DEFAULT_IDLE_TIMEOUT,
    warningTime = DEFAULT_WARNING_TIME,
    enabled = true,
    onIdle,
    onWarning,
    onActive,
  } = options;

  const [, setLocation] = useLocation();
  const [isIdle, setIsIdle] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);

  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const logoutMutation = trpc.auth.logout.useMutation();

  /**
   * Clear all timers
   */
  const clearTimers = () => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  /**
   * Logout user and redirect to home
   */
  const logout = () => {
    clearTimers();
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        setLocation('/');
        window.location.reload();
      },
    });
  };

  /**
   * Start countdown timer for warning
   */
  const startCountdown = () => {
    const warningDuration = warningTime / 1000; // Convert to seconds
    setRemainingTime(warningDuration);

    countdownIntervalRef.current = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current!);
          logout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  /**
   * Show warning modal
   */
  const showWarningModal = () => {
    setShowWarning(true);
    startCountdown();
    onWarning?.();

    // Set timer to logout after warning time
    warningTimerRef.current = setTimeout(() => {
      setIsIdle(true);
      onIdle?.();
      logout();
    }, warningTime);
  };

  /**
   * Reset idle timer
   */
  const resetTimer = () => {
    clearTimers();
    setIsIdle(false);
    setShowWarning(false);
    setRemainingTime(0);
    lastActivityRef.current = Date.now();

    if (enabled) {
      // Set timer to show warning
      const timeUntilWarning = idleTimeout - warningTime;
      idleTimerRef.current = setTimeout(showWarningModal, timeUntilWarning);
    }

    onActive?.();
  };

  /**
   * Handle user activity
   */
  const handleActivity = () => {
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityRef.current;

    // Only reset if more than 1 second has passed (debounce)
    if (timeSinceLastActivity > 1000) {
      resetTimer();
    }
  };

  useEffect(() => {
    if (!enabled) {
      clearTimers();
      return;
    }

    // Activity events to monitor
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];

    // Add event listeners
    events.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Start initial timer
    resetTimer();

    // Cleanup
    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      clearTimers();
    };
  }, [enabled, idleTimeout, warningTime]);

  return {
    isIdle,
    showWarning,
    remainingTime,
    resetTimer,
    logout,
  };
}
