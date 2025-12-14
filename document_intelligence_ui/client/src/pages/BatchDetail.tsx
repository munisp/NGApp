import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { DOCUMENT_CATEGORIES, DOCUMENT_STATUS } from "@shared/documentCategories";
import {
  ArrowLeft,
  Loader2,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Eye,
  Download,
} from "lucide-react";
import { useLocation, useParams, Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { useEffect } from "react";
import { useWebSocket } from "@/contexts/WebSocketContext";

export default function BatchDetail() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams();
  const batchId = params.id ? parseInt(params.id) : 0;

  const utils = trpc.useUtils();
  const retryFailedMutation = trpc.batches.retryFailed.useMutation({
    onSuccess: (data) => {
      toast.success(`Retrying ${data.retriedCount} failed documents`);
      utils.batches.getById.invalidate({ id: batchId });
    },
    onError: (error) => {
      toast.error("Failed to retry documents", {
        description: error.message,
      });
    },
  });

  const deleteBatchMutation = trpc.batches.delete.useMutation({
    onSuccess: () => {
      toast.success("Batch deleted successfully");
      setLocation("/batches");
    },
    onError: (error) => {
      toast.error("Failed to delete batch", {
        description: error.message,
      });
    },
  });

  const { data: batch, isLoading } = trpc.batches.getById.useQuery(
    { id: batchId },
    {
      enabled: !!user && batchId > 0,
    }
  );

  // WebSocket integration for real-time batch progress updates
  const { subscribeToBatch, unsubscribeFromBatch, onBatchProgress, onDocumentStatus, connected } = useWebSocket();

  useEffect(() => {
    if (!connected || !batchId) return;

    // Subscribe to this specific batch
    subscribeToBatch(batchId);

    const unsubscribeBatch = onBatchProgress((data) => {
      if (data.batchId !== batchId) return;

      console.log("[BatchDetail] Received batch progress update:", data);
      
      // Invalidate and refetch batch details
      utils.batches.getById.invalidate({ id: batchId });

      // Show toast notification for batch completion
      if (data.status === "completed") {
        toast.success("Batch processing completed", {
          description: `${data.completedFiles}/${data.totalFiles} documents processed successfully`,
        });
      } else if (data.status === "failed") {
        toast.error("Batch processing failed", {
          description: `${data.failedFiles}/${data.totalFiles} documents failed`,
        });
      }
    });

    const unsubscribeDoc = onDocumentStatus((data) => {
      // Refetch batch when any document in the batch updates
      utils.batches.getById.invalidate({ id: batchId });
    });

    return () => {
      unsubscribeBatch();
      unsubscribeDoc();
      unsubscribeFromBatch(batchId);
    };
  }, [connected, batchId, subscribeToBatch, unsubscribeFromBatch, onBatchProgress, onDocumentStatus, utils]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Batch Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The batch you're looking for doesn't exist or you don't have access to it.
            </p>
            <Button onClick={() => setLocation("/documents")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Documents
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-5 w-5" />;
      case "processing":
        return <Loader2 className="h-5 w-5 animate-spin" />;
      case "completed":
        return <CheckCircle2 className="h-5 w-5" />;
      case "failed":
      case "cancelled":
        return <XCircle className="h-5 w-5" />;
      default:
        return <AlertCircle className="h-5 w-5" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "secondary";
      case "processing":
        return "default";
      case "completed":
        return "default";
      case "failed":
      case "cancelled":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const progressPercentage = batch.totalFiles > 0
    ? Math.round(((batch.completedFiles + batch.failedFiles) / batch.totalFiles) * 100)
    : 0;

  const handleDownloadResults = () => {
    const data = {
      batch: {
        id: batch.id,
        name: batch.name,
        status: batch.status,
        totalFiles: batch.totalFiles,
        completedFiles: batch.completedFiles,
        failedFiles: batch.failedFiles,
        createdAt: batch.createdAt,
      },
      documents: batch.documents,
      statistics: batch.statistics,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `batch-${batch.id}-results.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container max-w-7xl py-12">
        <Button variant="ghost" onClick={() => setLocation("/documents")} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Documents
        </Button>

        {/* Batch Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-2xl mb-2">{batch.name || `Batch #${batch.id}`}</CardTitle>
                <CardDescription className="flex items-center gap-2 flex-wrap text-base">
                  <span>{formatDistanceToNow(new Date(batch.createdAt), { addSuffix: true })}</span>
                  <span>•</span>
                  <span>{batch.totalFiles} files</span>
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={getStatusColor(batch.status) as any} className="text-base px-3 py-1">
                  <span className="mr-1.5">{getStatusIcon(batch.status)}</span>
                  {batch.status}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Progress Bar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Overall Progress</span>
                  <span className="text-sm text-muted-foreground">{progressPercentage}%</span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">{batch.statistics.total}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{batch.statistics.pending}</div>
                  <div className="text-xs text-muted-foreground">Pending</div>
                </div>
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{batch.statistics.processing}</div>
                  <div className="text-xs text-muted-foreground">Processing</div>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{batch.statistics.completed}</div>
                  <div className="text-xs text-muted-foreground">Completed</div>
                </div>
                <div className="text-center p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{batch.statistics.failed}</div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 flex-wrap">
                {batch.status === "completed" && (
                  <Button variant="outline" onClick={handleDownloadResults}>
                    <Download className="mr-2 h-4 w-4" />
                    Download Results
                  </Button>
                )}
                {batch.statistics.failed > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => retryFailedMutation.mutate({ id: batch.id })}
                    disabled={retryFailedMutation.isPending}
                  >
                    {retryFailedMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <AlertCircle className="mr-2 h-4 w-4" />
                    )}
                    Retry Failed ({batch.statistics.failed})
                  </Button>
                )}
                {(batch.status === "completed" || batch.status === "failed" || batch.status === "cancelled") && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete this batch and all ${batch.totalFiles} documents?`)) {
                        deleteBatchMutation.mutate({ id: batch.id });
                      }
                    }}
                    disabled={deleteBatchMutation.isPending}
                  >
                    {deleteBatchMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="mr-2 h-4 w-4" />
                    )}
                    Delete Batch
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documents List */}
        <Card>
          <CardHeader>
            <CardTitle>Documents in Batch</CardTitle>
            <CardDescription>{batch.documents.length} documents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {batch.documents.map((doc) => {
                const category = DOCUMENT_CATEGORIES[doc.category as keyof typeof DOCUMENT_CATEGORIES];
                const statusInfo = DOCUMENT_STATUS[doc.status as keyof typeof DOCUMENT_STATUS];

                return (
                  <div
                    key={doc.id}
                    className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="rounded-lg bg-primary/10 p-2">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{doc.filename}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <span className="text-base">{category?.icon}</span>
                        <span>{category?.label}</span>
                        <span>•</span>
                        <span>{(doc.fileSize / 1024).toFixed(1)} KB</span>
                      </div>
                    </div>
                    <Badge
                      variant={statusInfo?.color === "green" ? "default" : "secondary"}
                      className={`
                        ${statusInfo?.color === "blue" && "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"}
                        ${statusInfo?.color === "red" && "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"}
                        ${statusInfo?.color === "gray" && "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100"}
                      `}
                    >
                      {statusInfo?.label || doc.status}
                    </Badge>
                    {doc.status === "completed" && (
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/documents/${doc.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
