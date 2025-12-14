import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import {
  Plus,
  Play,
  Pause,
  Trash2,
  Edit,
  Calendar,
  Mail,
  FileSpreadsheet,
  FileText,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import CreateScheduledExportDialog from "@/components/CreateScheduledExportDialog";

export default function ScheduledExports() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedExportId, setSelectedExportId] = useState<number | null>(null);

  const { data: exports, isLoading, refetch } = trpc.scheduledExports.list.useQuery();

  const toggleActiveMutation = trpc.scheduledExports.toggleActive.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to toggle schedule: ${error.message}`);
    },
  });

  const deleteMutation = trpc.scheduledExports.delete.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setDeleteDialogOpen(false);
      setSelectedExportId(null);
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to delete schedule: ${error.message}`);
    },
  });

  const runNowMutation = trpc.scheduledExports.runNow.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to run export: ${error.message}`);
    },
  });

  const handleToggleActive = (id: number, currentlyActive: boolean) => {
    toggleActiveMutation.mutate({ id, isActive: !currentlyActive });
  };

  const handleDelete = () => {
    if (selectedExportId) {
      deleteMutation.mutate({ id: selectedExportId });
    }
  };

  const handleRunNow = (id: number) => {
    runNowMutation.mutate({ id });
  };

  const getScheduleLabel = (scheduleType: string, cronExpression: string | null) => {
    switch (scheduleType) {
      case "once":
        return "One-time";
      case "daily":
        return "Daily";
      case "weekly":
        return "Weekly";
      case "monthly":
        return "Monthly";
      case "custom":
        return cronExpression || "Custom";
      default:
        return scheduleType;
    }
  };

  const getFormatIcon = (format: string) => {
    return format === "csv" ? (
      <FileSpreadsheet className="h-4 w-4" />
    ) : (
      <FileText className="h-4 w-4" />
    );
  };

  const getStatusBadge = (lastStatus: string | null, isActive: number) => {
    if (!isActive) {
      return <Badge variant="secondary">Paused</Badge>;
    }

    if (!lastStatus) {
      return <Badge variant="outline">Not Run Yet</Badge>;
    }

    switch (lastStatus) {
      case "success":
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Success
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case "skipped":
        return <Badge variant="secondary">Skipped</Badge>;
      default:
        return <Badge variant="outline">{lastStatus}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Scheduled Exports</h1>
            <p className="text-muted-foreground mt-2">
              Automate document exports with recurring schedules and email delivery
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Schedule
          </Button>
        </div>

        {/* Scheduled Exports List */}
        <Card>
          <CardHeader>
            <CardTitle>Export Schedules</CardTitle>
            <CardDescription>
              Manage your automated export jobs and view execution history
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : exports && exports.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>Next Run</TableHead>
                    <TableHead>Last Run</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Recipients</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exports.map((exp) => (
                    <TableRow key={exp.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{exp.name}</div>
                          {exp.description && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {exp.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {getScheduleLabel(exp.scheduleType, exp.cronExpression)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getFormatIcon(exp.exportFormat)}
                          <span className="text-sm uppercase">{exp.exportFormat}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {exp.nextRunAt ? (
                          <div className="text-sm">
                            <div>{format(new Date(exp.nextRunAt), "MMM d, yyyy")}</div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(exp.nextRunAt), "h:mm a")}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {exp.lastRunAt ? (
                          <div className="text-sm">
                            <div>{format(new Date(exp.lastRunAt), "MMM d, yyyy")}</div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(exp.lastRunAt), "h:mm a")}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(exp.lastStatus, exp.isActive)}</TableCell>
                      <TableCell>
                        {exp.emailRecipients && exp.emailRecipients.length > 0 ? (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{exp.emailRecipients.length}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRunNow(exp.id)}
                            disabled={runNowMutation.isPending}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(exp.id, exp.isActive === 1)}
                            disabled={toggleActiveMutation.isPending}
                          >
                            {exp.isActive ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedExportId(exp.id);
                              setDeleteDialogOpen(true);
                            }}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Scheduled Exports</h3>
                <p className="text-muted-foreground mb-6">
                  Create your first scheduled export to automate document exports
                </p>
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Schedule
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Dialog */}
      <CreateScheduledExportDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {
          refetch();
          setCreateDialogOpen(false);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Scheduled Export</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this scheduled export? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
