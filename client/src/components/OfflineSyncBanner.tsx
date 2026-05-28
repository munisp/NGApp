/**
 * OfflineSyncBanner.tsx — Persistent offline/sync status indicator
 *
 * Shows:
 *   - Amber banner when offline with pending queue count
 *   - Green toast when sync completes
 *   - Manual "Sync now" button when online with pending items
 */

import { useOfflineSync } from "@/hooks/useOfflineSync";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WifiOff, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

export function OfflineSyncBanner() {
  const { isOnline, pendingCount, lastSync, isSyncing, triggerSync, clearSyncResult } = useOfflineSync();

  // Show toast when sync completes
  useEffect(() => {
    if (!lastSync) return;
    if (lastSync.failCount === 0) {
      toast.success(`Sync complete — ${lastSync.successCount} item${lastSync.successCount !== 1 ? "s" : ""} uploaded`, {
        description: "All offline changes have been saved to the server.",
        duration: 5000,
      });
    } else {
      toast.warning(`Sync partial — ${lastSync.successCount} synced, ${lastSync.failCount} failed`, {
        description: "Some offline changes could not be uploaded. They will be retried.",
        duration: 8000,
      });
    }
    clearSyncResult();
  }, [lastSync, clearSyncResult]);

  // Don't render anything when online and no pending items
  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-full shadow-lg border text-sm font-medium transition-all ${
        isOnline
          ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
          : "bg-destructive/10 border-destructive/30 text-destructive"
      }`}
    >
      {isOnline ? (
        <AlertTriangle className="h-4 w-4 shrink-0" />
      ) : (
        <WifiOff className="h-4 w-4 shrink-0" />
      )}

      <span>
        {isOnline
          ? `${pendingCount} change${pendingCount !== 1 ? "s" : ""} pending upload`
          : `Offline — ${pendingCount > 0 ? `${pendingCount} change${pendingCount !== 1 ? "s" : ""} queued` : "changes will be queued"}`}
      </span>

      {pendingCount > 0 && (
        <Badge variant="secondary" className="text-xs px-1.5 py-0">
          {pendingCount}
        </Badge>
      )}

      {isOnline && pendingCount > 0 && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs gap-1"
          onClick={triggerSync}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3 w-3" />
          )}
          {isSyncing ? "Syncing…" : "Sync now"}
        </Button>
      )}
    </div>
  );
}
