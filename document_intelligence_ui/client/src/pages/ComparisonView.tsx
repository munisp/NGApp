import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { DOCUMENT_CATEGORIES } from "@shared/documentCategories";
import { 
  ArrowLeft, 
  Loader2, 
  AlertCircle, 
  FileText,
  Download,
  Eye,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export default function ComparisonView() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams();
  
  // Parse document IDs from URL
  const documentIds = params.ids
    ? params.ids.split(",").map((id: string) => parseInt(id))
    : [];

  const { data: comparison, isLoading, error } = trpc.documents.compare.useQuery(
    { documentIds },
    {
      enabled: !!user && documentIds.length >= 2 && documentIds.length <= 3,
      retry: false,
    }
  );

  const handleExport = () => {
    if (!comparison) return;

    // Create CSV export
    const headers = ["Field", ...comparison.documents.map((d) => d.filename)];
    const rows = Object.entries(comparison.fieldComparison.fields).map(
      ([fieldName, fieldData]: [string, any]) => {
        return [
          fieldName,
          ...fieldData.values.map((v: any) => v.value ?? "N/A"),
        ];
      }
    );

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comparison-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success("Comparison exported successfully");
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Authentication Required</h2>
            <p className="text-muted-foreground mb-4">
              Please log in to view document comparisons.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !comparison) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Comparison Failed</h2>
            <p className="text-muted-foreground mb-4">
              {error?.message || "Failed to load comparison data"}
            </p>
            <Link href="/compare">
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Selection
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const categoryInfo = DOCUMENT_CATEGORIES[comparison.category as keyof typeof DOCUMENT_CATEGORIES];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link href="/compare">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Selection
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Document Comparison</h1>
                <p className="text-sm text-muted-foreground">
                  {categoryInfo?.label} • {comparison.documents.length} documents
                </p>
              </div>
            </div>
            <Button onClick={handleExport} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">
                    {comparison.fieldComparison.totalFields}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Fields</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600">
                    {comparison.fieldComparison.differingFields}
                  </p>
                  <p className="text-sm text-muted-foreground">Differences Found</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {(comparison.fieldComparison.totalFields || 0) -
                      (comparison.fieldComparison.differingFields || 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Matching Fields</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Document Headers */}
        <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: `repeat(${comparison.documents.length}, 1fr)` }}>
          {comparison.documents.map((doc) => (
            <Card key={doc.id}>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{doc.filename}</CardTitle>
                    <CardDescription className="mt-1">
                      {formatDistanceToNow(new Date(doc.createdAt), {
                        addSuffix: true,
                      })}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge
                      variant={doc.status === "completed" ? "default" : "secondary"}
                    >
                      {doc.status}
                    </Badge>
                  </div>
                  {doc.ocrResult && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Confidence:</span>
                        <span className="font-medium">{doc.ocrResult.confidence}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Engine:</span>
                        <span className="font-medium">{doc.ocrResult.selectedEngine}</span>
                      </div>
                    </>
                  )}
                  <Link href={`/documents/${doc.id}`}>
                    <Button variant="outline" size="sm" className="w-full mt-2">
                      <Eye className="mr-2 h-3 w-3" />
                      View Details
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Field Comparison Table */}
        <Card>
          <CardHeader>
            <CardTitle>Extracted Fields Comparison</CardTitle>
            <CardDescription>
              {comparison.fieldComparison.hasDifferences
                ? "Fields with differences are highlighted"
                : "All fields match across documents"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(comparison.fieldComparison.fields).map(
                ([fieldName, fieldData]: [string, any]) => {
                  const isDifferent = fieldData.isDifferent;
                  const allPresent = fieldData.allPresent;

                  return (
                    <div
                      key={fieldName}
                      className={`p-4 rounded-lg border ${
                        isDifferent
                          ? "border-orange-300 bg-orange-50"
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        {isDifferent ? (
                          <AlertTriangle className="h-4 w-4 text-orange-600" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                        <h4 className="font-semibold capitalize">
                          {fieldName.replace(/_/g, " ")}
                        </h4>
                        {!allPresent && (
                          <Badge variant="secondary" className="ml-auto">
                            Missing in some documents
                          </Badge>
                        )}
                      </div>

                      <div
                        className="grid gap-3"
                        style={{
                          gridTemplateColumns: `repeat(${comparison.documents.length}, 1fr)`,
                        }}
                      >
                        {fieldData.values.map((valueData: any, index: number) => {
                          const doc = comparison.documents.find(
                            (d) => d.id === valueData.documentId
                          );

                          return (
                            <div
                              key={valueData.documentId}
                              className="p-3 rounded bg-white border border-gray-200"
                            >
                              <p className="text-xs text-muted-foreground mb-1 truncate">
                                {doc?.filename}
                              </p>
                              <p className="font-medium break-words">
                                {valueData.value !== null
                                  ? typeof valueData.value === "object"
                                    ? JSON.stringify(valueData.value)
                                    : String(valueData.value)
                                  : "—"}
                              </p>
                              {valueData.confidence > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {valueData.confidence}% confidence
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
              )}
            </div>

            {Object.keys(comparison.fieldComparison.fields).length === 0 && (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No extracted fields found in the selected documents
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* OCR Text Comparison */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Extracted Text</CardTitle>
            <CardDescription>
              Full OCR text from each document
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: `repeat(${comparison.documents.length}, 1fr)`,
              }}
            >
              {comparison.documents.map((doc) => (
                <div key={doc.id} className="space-y-2">
                  <p className="font-medium text-sm truncate">{doc.filename}</p>
                  <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 max-h-96 overflow-y-auto">
                    <pre className="text-xs whitespace-pre-wrap break-words font-mono">
                      {doc.ocrResult?.extractedText || "No text extracted"}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
