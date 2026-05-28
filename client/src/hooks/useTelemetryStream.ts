/**
 * useTelemetryStream — React hook for real-time telemetry via SSE
 *
 * Usage:
 *   const { telemetry, alarms, connected, simulated } = useTelemetryStream("PB-047");
 *
 * The hook opens a Server-Sent Events connection to /api/telemetry/stream?wellId=<id>
 * and updates state whenever new telemetry or alarm events arrive.
 * It automatically reconnects on disconnect with exponential back-off.
 */
import { useEffect, useRef, useState, useCallback } from "react";

export interface LiveTelemetry {
  wellId: string;
  tubingPressure?: number;
  casingPressure?: number;
  flowRate?: number;
  waterCut?: number;
  gasOilRatio?: number;
  espCurrent?: number;
  espFrequency?: number;
  espVibration?: number;
  espMotorTemp?: number;
  espInletPressure?: number;
  espDischargePressure?: number;
  wellheadTemp?: number;
  chokePosition?: number;
  protocol?: string;
  quality?: number;
  recordedAt?: string;
}

export interface LiveAlarm {
  id: number;
  alarmId: string;
  wellId: string;
  tag: string;
  description: string;
  severity: number;
  state: string;
  value?: number;
  setpoint?: number;
  unit?: string;
}

interface StreamState {
  telemetry: LiveTelemetry | null;
  alarms: LiveAlarm[];
  connected: boolean;
  simulated: boolean;
  lastUpdate: Date | null;
}

export function useTelemetryStream(wellId: string | null | undefined): StreamState {
  const [state, setState] = useState<StreamState>({
    telemetry: null,
    alarms: [],
    connected: false,
    simulated: false,
    lastUpdate: null,
  });

  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelay = useRef(1000);

  const connect = useCallback(() => {
    if (!wellId) return;

    // Close any existing connection
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const url = `/api/telemetry/stream?wellId=${encodeURIComponent(wellId)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      setState(prev => ({ ...prev, connected: true }));
      retryDelay.current = 1000; // Reset back-off on successful connect
    };

    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "connected") {
          setState(prev => ({ ...prev, connected: true }));
        } else if (msg.type === "telemetry") {
          setState(prev => ({
            ...prev,
            telemetry: msg.data as LiveTelemetry,
            simulated: msg.simulated === true,
            lastUpdate: new Date(),
          }));
        } else if (msg.type === "alarms") {
          setState(prev => ({
            ...prev,
            alarms: msg.data as LiveAlarm[],
          }));
        } else if (msg.type === "alarm") {
          setState(prev => ({
            ...prev,
            alarms: [...prev.alarms.filter(a => a.alarmId !== (msg.data as LiveAlarm).alarmId), msg.data as LiveAlarm],
          }));
        }
      } catch {
        // Ignore malformed messages
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      setState(prev => ({ ...prev, connected: false }));

      // Exponential back-off reconnect (max 30s)
      retryRef.current = setTimeout(() => {
        retryDelay.current = Math.min(retryDelay.current * 2, 30000);
        connect();
      }, retryDelay.current);
    };
  }, [wellId]);

  useEffect(() => {
    connect();

    return () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      if (retryRef.current) {
        clearTimeout(retryRef.current);
      }
    };
  }, [connect]);

  return state;
}

/**
 * useOverviewStream — SSE hook for the Overview page (wildcard well subscription)
 * Receives heartbeat events and can be extended to receive fleet-wide updates.
 */
export function useOverviewStream(): { connected: boolean; lastHeartbeat: Date | null } {
  const [connected, setConnected] = useState(false);
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/telemetry/stream");
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "connected" || msg.type === "heartbeat") {
          setConnected(true);
          setLastHeartbeat(new Date());
        }
      } catch { /* ignore */ }
    };

    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
    };
  }, []);

  return { connected, lastHeartbeat };
}
