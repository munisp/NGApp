import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const DOCUMENT_CATEGORIES = [
  { value: "citizenship_identity", label: "Citizenship & Identity" },
  { value: "immigration_status", label: "Immigration Status" },
  { value: "income_employment", label: "Income & Employment" },
  { value: "tribal_aian", label: "Tribal/AIAN" },
  { value: "employer_health_coverage", label: "Employer Health Coverage" },
  { value: "household_relationship", label: "Household Relationship" },
  { value: "other_supporting", label: "Other Supporting" },
];

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

interface CreateScheduledExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function CreateScheduledExportDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateScheduledExportDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [includeOcrResults, setIncludeOcrResults] = useState(true);
  const [scheduleType, setScheduleType] = useState<"once" | "daily" | "weekly" | "monthly" | "custom">("daily");
  const [cronExpression, setCronExpression] = useState("");
  const [emailRecipients, setEmailRecipients] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  const createMutation = trpc.scheduledExports.create.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      resetForm();
      onSuccess();
    },
    onError: (error) => {
      toast.error(`Failed to create schedule: ${error.message}`);
    },
  });

  const resetForm = () => {
    setName("");
    setDescription("");
    setExportFormat("csv");
    setCategory("");
    setStatus("");
    setIncludeOcrResults(true);
    setScheduleType("daily");
    setCronExpression("");
    setEmailRecipients("");
    setEmailSubject("");
    setEmailBody("");
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error("Please enter a name for the schedule");
      return;
    }

    if (scheduleType === "custom" && !cronExpression.trim()) {
      toast.error("Please enter a cron expression for custom schedule");
      return;
    }

    // Parse email recipients (comma-separated)
    const recipients = emailRecipients
      .split(",")
      .map((email) => email.trim())
      .filter((email) => email.length > 0);

    createMutation.mutate({
      name,
      description: description || undefined,
      exportFormat,
      category: category || undefined,
      status: status as any,
      includeOcrResults,
      scheduleType,
      cronExpression: scheduleType === "custom" ? cronExpression : undefined,
      emailRecipients: recipients.length > 0 ? recipients : undefined,
      emailSubject: emailSubject || undefined,
      emailBody: emailBody || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Scheduled Export</DialogTitle>
          <DialogDescription>
            Set up an automated export job with recurring schedule and email delivery
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Basic Information */}
          <div className="space-y-2">
            <Label htmlFor="name">Schedule Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Daily Document Export"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Optional description of this export schedule"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Export Configuration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Export Format</Label>
              <Select value={exportFormat} onValueChange={(val) => setExportFormat(val as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV (Excel)</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Document Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Categories</SelectItem>
                  {DOCUMENT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Document Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Statuses</SelectItem>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2 pt-8">
              <Checkbox
                id="includeOcr"
                checked={includeOcrResults}
                onCheckedChange={(checked) => setIncludeOcrResults(checked as boolean)}
              />
              <Label htmlFor="includeOcr" className="cursor-pointer">
                Include OCR Results
              </Label>
            </div>
          </div>

          {/* Schedule Configuration */}
          <div className="space-y-2">
            <Label>Schedule Type</Label>
            <Select value={scheduleType} onValueChange={(val) => setScheduleType(val as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="once">One-time (Run once)</SelectItem>
                <SelectItem value="daily">Daily (Every 24 hours)</SelectItem>
                <SelectItem value="weekly">Weekly (Every 7 days)</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="custom">Custom (Cron expression)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scheduleType === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="cron">Cron Expression</Label>
              <Input
                id="cron"
                placeholder="e.g., 0 0 * * * (every day at midnight)"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Use standard cron syntax: minute hour day month weekday
              </p>
            </div>
          )}

          {/* Email Configuration */}
          <div className="space-y-2">
            <Label htmlFor="recipients">Email Recipients (Optional)</Label>
            <Input
              id="recipients"
              placeholder="email1@example.com, email2@example.com"
              value={emailRecipients}
              onChange={(e) => setEmailRecipients(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated email addresses. Leave empty to skip email delivery.
            </p>
          </div>

          {emailRecipients && (
            <>
              <div className="space-y-2">
                <Label htmlFor="subject">Email Subject</Label>
                <Input
                  id="subject"
                  placeholder="e.g., Daily Document Export Report"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="body">Email Body</Label>
                <Textarea
                  id="body"
                  placeholder="Optional email message"
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={3}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Schedule"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
