/**
 * SignaturePad — Digital signature capture dialog for Permit-to-Work
 * Captures signature on canvas, uploads PNG to S3, returns CDN URL
 */
import { useRef, useState, useCallback } from "react";
import ReactSignatureCanvas from "react-signature-canvas";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PenLine, RotateCcw, CheckCircle, Upload, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SignaturePadProps {
  open: boolean;
  onClose: () => void;
  onSigned: (signatureUrl: string, signedBy: string) => void;
  role: "issuer" | "approver";
  permitNumber: string;
  defaultName?: string;
  isLoading?: boolean;
}

export function SignaturePad({
  open,
  onClose,
  onSigned,
  role,
  permitNumber,
  defaultName = "",
  isLoading = false,
}: SignaturePadProps) {
  const sigRef = useRef<ReactSignatureCanvas>(null);
  const [signedBy, setSignedBy] = useState(defaultName);
  const [isEmpty, setIsEmpty] = useState(true);
  const [uploading, setUploading] = useState(false);

  const handleClear = useCallback(() => {
    sigRef.current?.clear();
    setIsEmpty(true);
  }, []);

  const handleEnd = useCallback(() => {
    setIsEmpty(sigRef.current?.isEmpty() ?? true);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!signedBy.trim()) {
      toast.error("Please enter your name before signing.");
      return;
    }
    if (isEmpty || sigRef.current?.isEmpty()) {
      toast.error("Please draw your signature before submitting.");
      return;
    }

    setUploading(true);
    try {
      // Export signature as PNG blob
      const dataUrl = sigRef.current!.getTrimmedCanvas().toDataURL("image/png");
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `sig-${permitNumber}-${role}-${Date.now()}.png`, { type: "image/png" });

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/firmware/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        // Fallback: use data URL directly if upload fails (e.g. no S3 configured)
        console.warn("[SignaturePad] S3 upload failed, using data URL fallback");
        onSigned(dataUrl, signedBy.trim());
        toast.success("Signature captured (local fallback).");
        return;
      }

      const { url } = await res.json();
      onSigned(url, signedBy.trim());
      toast.success("Signature captured and stored securely.");
    } catch (err) {
      console.error("[SignaturePad] Upload error:", err);
      // Graceful fallback to data URL
      const dataUrl = sigRef.current!.getTrimmedCanvas().toDataURL("image/png");
      onSigned(dataUrl, signedBy.trim());
      toast.success("Signature captured (local fallback).");
    } finally {
      setUploading(false);
    }
  }, [signedBy, isEmpty, permitNumber, role, onSigned]);

  const roleLabel = role === "issuer" ? "Permit Issuer" : "Approving Authority";
  const roleColor = role === "issuer" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold font-[Syne]">
            <PenLine className="w-4 h-4 text-amber-400" />
            Digital Signature Required
          </DialogTitle>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className={cn("text-[10px] font-mono", roleColor)}>
              {roleLabel}
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">{permitNumber}</span>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name input */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Full Name *
            </Label>
            <Input
              value={signedBy}
              onChange={(e) => setSignedBy(e.target.value)}
              placeholder="Enter your full name"
              className="text-sm"
            />
          </div>

          {/* Signature canvas */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Signature *
              </Label>
              <button
                onClick={handleClear}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Clear
              </button>
            </div>
            <div className={cn(
              "border rounded-lg overflow-hidden bg-white",
              isEmpty ? "border-border/50" : "border-amber-500/40"
            )}>
              <ReactSignatureCanvas
                ref={sigRef}
                penColor="#1a1a2e"
                canvasProps={{
                  width: 420,
                  height: 160,
                  className: "w-full",
                  style: { touchAction: "none" },
                }}
                onEnd={handleEnd}
              />
            </div>
            {isEmpty && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Draw your signature in the box above using mouse or touch
              </p>
            )}
            {!isEmpty && (
              <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Signature captured
              </p>
            )}
          </div>

          {/* Legal notice */}
          <div className="bg-muted/30 rounded-lg p-3 text-[10px] text-muted-foreground leading-relaxed border border-border/30">
            By signing, I confirm that I have read, understood, and accept responsibility for the conditions stated in this permit. This digital signature is legally binding under IOGP RP 75 and ISO 45001:2018.
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={uploading || isLoading} size="sm">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={uploading || isLoading || isEmpty || !signedBy.trim()}
            size="sm"
            className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
          >
            {uploading ? (
              <>
                <Upload className="w-3.5 h-3.5 mr-1.5 animate-pulse" />
                Uploading…
              </>
            ) : (
              <>
                <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                Sign & Submit
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
