import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useServiceWorker } from "@/hooks/useServiceWorker";
import { RefreshCw, X } from "lucide-react";
import { useState } from "react";

export default function PWAUpdateNotification() {
  const { isUpdateAvailable, skipWaiting } = useServiceWorker();
  const [dismissed, setDismissed] = useState(false);

  if (!isUpdateAvailable || dismissed) {
    return null;
  }

  const handleUpdate = () => {
    skipWaiting();
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-sm animate-in slide-in-from-bottom-5">
      <Card className="p-4 shadow-lg border-primary/20">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <RefreshCw className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm">Update Available</h3>
            <p className="text-xs text-muted-foreground mt-1">
              A new version of Payment Switch is available. Update now for the latest features and improvements.
            </p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={handleUpdate}>
                Update Now
              </Button>
              <Button size="sm" variant="outline" onClick={handleDismiss}>
                Later
              </Button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </Card>
    </div>
  );
}
