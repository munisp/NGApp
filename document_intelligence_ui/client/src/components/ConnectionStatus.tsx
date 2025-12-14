import { useWebSocket } from "@/contexts/WebSocketContext";
import { Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export function ConnectionStatus() {
  const { connected } = useWebSocket();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!connected) {
      // Show disconnected status immediately
      setShow(true);
    } else {
      // Show connected status briefly, then hide
      setShow(true);
      const timer = setTimeout(() => setShow(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [connected]);

  if (!show) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg px-4 py-2 shadow-lg transition-all ${
        connected
          ? "bg-green-500 text-white"
          : "bg-red-500 text-white animate-pulse"
      }`}
    >
      {connected ? (
        <>
          <Wifi className="h-4 w-4" />
          <span className="text-sm font-medium">Connected</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4" />
          <span className="text-sm font-medium">Disconnected - Reconnecting...</span>
        </>
      )}
    </div>
  );
}
