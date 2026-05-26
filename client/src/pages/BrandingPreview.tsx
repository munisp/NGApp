import { useEffect } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function BrandingPreview() {
  const [, params] = useRoute("/preview/:previewId");
  const previewId = params?.previewId || "";

  const { data, isLoading, error } = trpc.preview.getSession.useQuery(
    { previewId },
    { enabled: !!previewId }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Preview Not Found</AlertTitle>
          <AlertDescription>
            {error?.message || "This preview link is invalid or has expired."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const branding = data.branding;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Preview Banner */}
      <div className="bg-blue-600 text-white py-3 px-4 text-center">
        <div className="container max-w-4xl mx-auto flex items-center justify-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span className="font-medium">
            This is a branding preview - Not a live checkout page
          </span>
        </div>
      </div>

      <div className="container max-w-4xl mx-auto py-12 px-4">
        {/* Info Card */}
        <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-bold mb-2">Branding Preview</h1>
          <p className="text-muted-foreground mb-4">
            This preview shows how your checkout page will appear to customers with your custom branding.
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="font-semibold">Expires:</span>{" "}
              <span className="text-muted-foreground">
                {new Date(data.expiresAt).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Branding Details */}
        <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Branding Configuration</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Primary Color</p>
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded border"
                  style={{ backgroundColor: branding.primaryColor }}
                />
                <span className="text-sm font-mono">{branding.primaryColor}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Secondary Color</p>
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded border"
                  style={{ backgroundColor: branding.secondaryColor }}
                />
                <span className="text-sm font-mono">{branding.secondaryColor}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Background</p>
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded border"
                  style={{ backgroundColor: branding.backgroundColor }}
                />
                <span className="text-sm font-mono">{branding.backgroundColor}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Text Color</p>
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded border"
                  style={{ backgroundColor: branding.textColor }}
                />
                <span className="text-sm font-mono">{branding.textColor}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Font Family</p>
              <p className="text-sm font-semibold">{branding.fontFamily}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Border Radius</p>
              <p className="text-sm font-semibold">{branding.borderRadius}</p>
            </div>
          </div>
        </div>

        {/* Mock Checkout Preview */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-6">Checkout Preview</h2>
          
          <div className="max-w-md mx-auto">
            <div
              className="border rounded-lg overflow-hidden shadow-xl"
              style={{
                backgroundColor: branding.backgroundColor,
                color: branding.textColor,
                fontFamily: branding.fontFamily,
              }}
            >
              {/* Header with branding */}
              <div
                className="p-6 text-white"
                style={{
                  background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.secondaryColor})`,
                  borderRadius: `${branding.borderRadius} ${branding.borderRadius} 0 0`,
                }}
              >
                {branding.logo ? (
                  <img
                    src={branding.logo}
                    alt="Logo"
                    className="max-h-12 max-w-[200px] object-contain mx-auto"
                  />
                ) : (
                  <h3 className="text-2xl font-semibold text-center">Your Logo</h3>
                )}
              </div>

              {/* Payment Form */}
              <div className="p-6 space-y-6">
                <div>
                  <h4 className="text-xl font-semibold mb-2">Complete Payment</h4>
                  <p className="text-sm opacity-75">Secure checkout powered by Payment Switch</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Card Number</label>
                    <div
                      className="border p-3 bg-white dark:bg-gray-900"
                      style={{ borderRadius: branding.borderRadius }}
                    >
                      <span className="text-gray-400">•••• •••• •••• 4242</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Expiry</label>
                      <div
                        className="border p-3 bg-white dark:bg-gray-900"
                        style={{ borderRadius: branding.borderRadius }}
                      >
                        <span className="text-gray-400">12/25</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">CVC</label>
                      <div
                        className="border p-3 bg-white dark:bg-gray-900"
                        style={{ borderRadius: branding.borderRadius }}
                      >
                        <span className="text-gray-400">•••</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Cardholder Name</label>
                    <div
                      className="border p-3 bg-white dark:bg-gray-900"
                      style={{ borderRadius: branding.borderRadius }}
                    >
                      <span className="text-gray-400">John Doe</span>
                    </div>
                  </div>
                </div>

                <button
                  className="w-full text-white py-4 font-semibold text-lg shadow-lg transition-all hover:shadow-xl"
                  style={{
                    backgroundColor: branding.primaryColor,
                    borderRadius: branding.borderRadius,
                  }}
                >
                  Pay $100.00
                </button>

                <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  <span>Secured by SSL encryption</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-8 text-center">
          <Button asChild size="lg">
            <a href="/" className="inline-flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              Visit Payment Switch
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
