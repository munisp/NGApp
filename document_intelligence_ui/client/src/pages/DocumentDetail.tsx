import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { DOCUMENT_CATEGORIES, DOCUMENT_STATUS } from "@shared/documentCategories";
import {
  ArrowLeft,
  Loader2,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
  Eye,
  Gauge,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";
import { useLocation, useParams } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { getValidationStatusColor, getValidationStatusLabel } from "@shared/templateValidation";
import { useEffect } from "react";
import { useWebSocket } from "@/contexts/WebSocketContext";

export default function DocumentDetail() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams();
  const documentId = params.id ? parseInt(params.id) : 0;

  const utils = trpc.useUtils();
  
  // Validation query
  const { data: validationStatus, refetch: refetchValidation } = trpc.validation.getValidationStatus.useQuery(
    { documentId },
    { enabled: !!user && documentId > 0 }
  );
  
  // Validation mutation
  const validateMutation = trpc.validation.validateDocument.useMutation({
    onSuccess: () => {
      toast.success("Document validated successfully");
      refetchValidation();
      utils.documents.getById.invalidate({ id: documentId });
    },
    onError: (error) => {
      toast.error(`Validation failed: ${error.message}`);
    },
  });
  
  const { data: document, isLoading } = trpc.documents.getById.useQuery(
    { id: documentId },
    {
      enabled: !!user && documentId > 0,
    }
  );

  // WebSocket integration for real-time updates
  const { subscribeToDocument, unsubscribeFromDocument, onDocumentStatus, connected } = useWebSocket();

  useEffect(() => {
    if (!connected || !documentId) return;

    // Subscribe to this specific document
    subscribeToDocument(documentId);

    const unsubscribe = onDocumentStatus((data) => {
      if (data.documentId !== documentId) return;

      console.log("[DocumentDetail] Received status update:", data);
      
      // Invalidate and refetch document details
      utils.documents.getById.invalidate({ id: documentId });

      // Show toast notification
      if (data.status === "completed") {
        toast.success("Document processed successfully", {
          description: `Confidence: ${data.confidence}% | Time: ${data.processingTimeMs}ms`,
        });
      } else if (data.status === "failed") {
        toast.error("Document processing failed", {
          description: data.error || "Unknown error occurred",
        });
      } else if (data.status === "processing") {
        toast.info("Processing document...", {
          description: "OCR analysis in progress",
        });
      }
    });

    return () => {
      unsubscribe();
      unsubscribeFromDocument(documentId);
    };
  }, [connected, documentId, subscribeToDocument, unsubscribeFromDocument, onDocumentStatus, utils]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Document Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The document you're looking for doesn't exist or you don't have access to it.
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

  const category = DOCUMENT_CATEGORIES[document.category as keyof typeof DOCUMENT_CATEGORIES];
  const statusInfo = DOCUMENT_STATUS[document.status as keyof typeof DOCUMENT_STATUS];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-5 w-5" />;
      case "processing":
        return <Loader2 className="h-5 w-5 animate-spin" />;
      case "completed":
        return <CheckCircle2 className="h-5 w-5" />;
      case "failed":
        return <XCircle className="h-5 w-5" />;
      default:
        return <AlertCircle className="h-5 w-5" />;
    }
  };

  const handleDownloadJSON = () => {
    const data = {
      document: {
        id: document.id,
        filename: document.filename,
        category: document.category,
        status: document.status,
        createdAt: document.createdAt,
      },
      ocrResult: document.ocrResult,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `${document.filename}-ocr-result.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("JSON downloaded successfully");
  };

  const handleViewDocument = () => {
    window.open(document.fileUrl, "_blank");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container max-w-6xl py-12">
        <Button variant="ghost" onClick={() => setLocation("/documents")} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Documents
        </Button>

        {/* Document Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4 flex-1">
                <div className="rounded-lg bg-primary/10 p-4">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-2xl mb-2 truncate">{document.filename}</CardTitle>
                  <CardDescription className="flex items-center gap-2 flex-wrap text-base">
                    <span className="flex items-center gap-1">
                      <span className="text-xl">{category?.icon}</span>
                      {category?.label}
                    </span>
                    <span>•</span>
                    <span>{formatDistanceToNow(new Date(document.createdAt), { addSuffix: true })}</span>
                    <span>•</span>
                    <span>{(document.fileSize / 1024).toFixed(1)} KB</span>
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={statusInfo?.color === "green" ? "default" : "secondary"}
                  className={`
                    text-base px-3 py-1
                    ${statusInfo?.color === "blue" && "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"}
                    ${statusInfo?.color === "red" && "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"}
                    ${statusInfo?.color === "gray" && "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100"}
                  `}
                >
                  <span className="mr-1.5">{getStatusIcon(document.status)}</span>
                  {statusInfo?.label || document.status}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleViewDocument}>
                <Eye className="mr-2 h-4 w-4" />
                View Original
              </Button>
              {document.ocrResult && (
                <Button variant="outline" onClick={handleDownloadJSON}>
                  <Download className="mr-2 h-4 w-4" />
                  Download JSON
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Processing Status */}
        {(document.status === "pending" || document.status === "processing") && (
          <Card className="mb-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                    {document.status === "pending" ? "Waiting in queue..." : "Processing document..."}
                  </h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    This usually takes less than a second. The page will update automatically.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {document.status === "failed" && (
          <Card className="mb-6 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <XCircle className="h-8 w-8 text-red-600" />
                <div>
                  <h3 className="font-semibold text-red-900 dark:text-red-100">Processing Failed</h3>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    There was an error processing this document. Please try uploading it again.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* OCR Results */}
        {document.ocrResult && (
          <>
            {/* Confidence Score */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gauge className="h-5 w-5" />
                  OCR Confidence Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="h-4 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          document.ocrResult.confidence >= 90
                            ? "bg-green-500"
                            : document.ocrResult.confidence >= 70
                            ? "bg-yellow-500"
                            : "bg-red-500"
                        }`}
                        style={{ width: `${document.ocrResult.confidence}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-2xl font-bold">{document.ocrResult.confidence}%</div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Engine</div>
                    <div className="font-medium">{document.ocrResult.selectedEngine || "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Strategy</div>
                    <div className="font-medium">{document.ocrResult.strategy || "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Processing Time</div>
                    <div className="font-medium">
                      {document.ocrResult.processingTimeMs ? `${document.ocrResult.processingTimeMs}ms` : "N/A"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Validation Status */}
            {validationStatus && validationStatus.templateId && (
              <Card className="mb-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {validationStatus.status === 'valid' ? (
                        <ShieldCheck className="h-5 w-5 text-green-500" />
                      ) : (
                        <ShieldAlert className="h-5 w-5 text-yellow-500" />
                      )}
                      <CardTitle>Template Validation</CardTitle>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => validateMutation.mutate({ documentId })}
                      disabled={validateMutation.isPending}
                    >
                      {validateMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Validating...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Re-validate
                        </>
                      )}
                    </Button>
                  </div>
                  <CardDescription>
                    Validation against template field definitions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Status Badge */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Status:</span>
                      <Badge variant={getValidationStatusColor(validationStatus.status) as any}>
                        {getValidationStatusLabel(validationStatus.status)}
                      </Badge>
                      {validationStatus.validatedAt && (
                        <span className="text-xs text-muted-foreground">
                          Validated {formatDistanceToNow(new Date(validationStatus.validatedAt), { addSuffix: true })}
                        </span>
                      )}
                    </div>

                    {/* Validation Errors */}
                    {validationStatus.errors && validationStatus.errors.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-destructive">Validation Errors:</h4>
                        <div className="space-y-2">
                          {validationStatus.errors.map((error: any, index: number) => (
                            <div key={index} className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <div className="font-medium text-sm">{error.field}</div>
                                <div className="text-sm text-muted-foreground">{error.message}</div>
                                {error.value && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Current value: <code className="bg-muted px-1 rounded">{String(error.value)}</code>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Success Message */}
                    {validationStatus.status === 'valid' && (
                      <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm">All required fields are valid and meet template requirements.</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Extracted Text */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Extracted Text</CardTitle>
                <CardDescription>Raw text extracted from the document</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-4 rounded-lg max-h-96 overflow-y-auto">
                  <pre className="text-sm whitespace-pre-wrap font-mono">{document.ocrResult.extractedText}</pre>
                </div>
              </CardContent>
            </Card>

            {/* Extracted Data Fields */}
            {document.ocrResult.extractedData && Object.keys(document.ocrResult.extractedData).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Extracted Data Fields</CardTitle>
                  <CardDescription>Structured data extracted from the document</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    {Object.entries(document.ocrResult.extractedData).map(([key, value]) => (
                      <div key={key} className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-muted-foreground mb-1">
                            {key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                          </div>
                          <div className="font-mono text-sm">
                            {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
