import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Upload, Layers, BarChart3, FileText, Sparkles } from "lucide-react";

const WELCOME_MODAL_KEY = "welcome_modal_shown";

export default function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    // Check if modal has been shown before
    const hasSeenWelcome = localStorage.getItem(WELCOME_MODAL_KEY);
    if (!hasSeenWelcome) {
      // Show modal after a short delay
      setTimeout(() => setOpen(true), 1000);
    }
  }, []);

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem(WELCOME_MODAL_KEY, "true");
    }
    setOpen(false);
  };

  const handleStartTour = (path: string, tourKey: string) => {
    if (dontShowAgain) {
      localStorage.setItem(WELCOME_MODAL_KEY, "true");
    }
    setOpen(false);
    // Navigate and trigger tour
    window.location.href = path;
    setTimeout(() => {
      localStorage.setItem(`tour_${tourKey}_trigger`, "true");
    }, 500);
  };

  const features = [
    {
      icon: Upload,
      title: "Upload Documents",
      description: "Drag and drop documents for instant OCR processing",
      path: "/upload",
      tourKey: "upload",
    },
    {
      icon: Layers,
      title: "Batch Processing",
      description: "Process multiple documents simultaneously with queue management",
      path: "/batch-upload",
      tourKey: "batch-upload",
    },
    {
      icon: BarChart3,
      title: "Analytics Dashboard",
      description: "View processing trends, category statistics, and insights",
      path: "/analytics",
      tourKey: "analytics",
    },
    {
      icon: FileText,
      title: "Document Management",
      description: "Search, filter, and compare your processed documents",
      path: "/documents",
      tourKey: "documents",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="h-6 w-6 text-primary" />
            Welcome to Document Intelligence Platform!
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            Get started with intelligent OCR processing powered by multi-engine ensemble technology with 96% accuracy.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          {features.map((feature) => (
            <button
              key={feature.tourKey}
              onClick={() => handleStartTour(feature.path, feature.tourKey)}
              className="flex flex-col items-start gap-2 p-4 rounded-lg border border-border hover:border-primary hover:bg-accent transition-colors text-left group"
            >
              <feature.icon className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
              <div>
                <h3 className="font-semibold text-sm">{feature.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {feature.description}
                </p>
              </div>
              <span className="text-xs text-primary mt-auto">
                Start Tour →
              </span>
            </button>
          ))}
        </div>

        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h4 className="font-semibold text-sm">Key Features:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• 7 document categories supported (Citizenship, Immigration, Income, etc.)</li>
            <li>• Real-time processing with WebSocket notifications</li>
            <li>• Batch upload up to 50 files with 5 concurrent processing</li>
            <li>• Advanced search, filtering, and document comparison</li>
          </ul>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-3">
          <div className="flex items-center space-x-2 mr-auto">
            <Checkbox
              id="dont-show"
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked as boolean)}
            />
            <Label
              htmlFor="dont-show"
              className="text-sm font-normal cursor-pointer"
            >
              Don't show this again
            </Label>
          </div>
          <Button variant="outline" onClick={handleClose}>
            Skip
          </Button>
          <Button onClick={() => handleStartTour("/upload", "upload")}>
            Get Started
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
