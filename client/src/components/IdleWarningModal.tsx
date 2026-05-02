import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Clock } from "lucide-react";

interface IdleWarningModalProps {
  /**
   * Whether the modal is open
   */
  open: boolean;
  
  /**
   * Remaining time in seconds
   */
  remainingTime: number;
  
  /**
   * Callback when user wants to stay logged in
   */
  onStayLoggedIn: () => void;
  
  /**
   * Callback when user wants to logout now
   */
  onLogoutNow: () => void;
}

/**
 * Modal shown when user is idle and about to be logged out
 */
export function IdleWarningModal({
  open,
  remainingTime,
  onStayLoggedIn,
  onLogoutNow,
}: IdleWarningModalProps) {
  const minutes = Math.floor(remainingTime / 60);
  const seconds = remainingTime % 60;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/20">
              <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-500" />
            </div>
            <div>
              <DialogTitle>Session Timeout Warning</DialogTitle>
              <DialogDescription>
                You've been inactive for a while
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-6">
          <div className="flex items-center justify-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-6 dark:border-yellow-900/50 dark:bg-yellow-900/10">
            <Clock className="h-8 w-8 text-yellow-600 dark:text-yellow-500" />
            <div className="text-center">
              <div className="text-3xl font-bold tabular-nums text-yellow-900 dark:text-yellow-100">
                {minutes}:{seconds.toString().padStart(2, '0')}
              </div>
              <div className="text-sm text-yellow-700 dark:text-yellow-300">
                until automatic logout
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            For your security, you'll be automatically logged out due to inactivity.
            Click "Stay Logged In" to continue your session.
          </p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={onLogoutNow}
            className="w-full sm:w-auto"
          >
            Logout Now
          </Button>
          <Button
            onClick={onStayLoggedIn}
            className="w-full sm:w-auto"
          >
            Stay Logged In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
