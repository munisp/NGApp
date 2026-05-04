import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Shield } from "lucide-react";

interface ThreeDSecureProps {
  challengeUrl: string;
  onSuccess: (result: any) => void;
  onFailure: (error: string) => void;
  onCancel: () => void;
}

/**
 * 3D Secure authentication component
 * Handles the 3DS challenge flow in an iframe
 */
export function ThreeDSecure({ challengeUrl, onSuccess, onFailure, onCancel }: ThreeDSecureProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [timeoutReached, setTimeoutReached] = useState(false);

  useEffect(() => {
    // Set timeout for 3DS challenge (5 minutes)
    const timeout = setTimeout(() => {
      setTimeoutReached(true);
      onFailure("3D Secure authentication timed out");
    }, 5 * 60 * 1000);

    // Listen for messages from the iframe
    const handleMessage = (event: MessageEvent) => {
      // Verify origin for security
      if (!event.origin.includes(new URL(challengeUrl).origin)) {
        return;
      }

      const { type, data } = event.data;

      switch (type) {
        case "3DS_SUCCESS":
          clearTimeout(timeout);
          onSuccess(data);
          break;
        case "3DS_FAILURE":
          clearTimeout(timeout);
          onFailure(data.error || "3D Secure authentication failed");
          break;
        case "3DS_CANCEL":
          clearTimeout(timeout);
          onCancel();
          break;
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener("message", handleMessage);
    };
  }, [challengeUrl, onSuccess, onFailure, onCancel]);

  const handleIframeLoad = () => {
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>3D Secure Authentication</CardTitle>
          </div>
          <CardDescription>
            Please complete the additional security verification from your bank
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Loading authentication...</span>
            </div>
          )}
          
          {timeoutReached && (
            <div className="text-center py-12">
              <p className="text-destructive">Authentication timed out. Please try again.</p>
            </div>
          )}

          <iframe
            ref={iframeRef}
            src={challengeUrl}
            onLoad={handleIframeLoad}
            className={`w-full border-0 rounded-md ${loading ? 'hidden' : 'block'}`}
            style={{ height: '500px' }}
            title="3D Secure Authentication"
            sandbox="allow-forms allow-scripts allow-same-origin"
          />

          <div className="mt-4 text-xs text-muted-foreground text-center">
            <p>This is a secure authentication process provided by your card issuer.</p>
            <p className="mt-1">Do not close this window until authentication is complete.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
