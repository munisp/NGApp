import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { DOCUMENT_CATEGORIES, DOCUMENT_STATUS } from "@shared/documentCategories";
import { FileText, Loader2, Upload, Eye, Clock, CheckCircle2, XCircle, AlertCircle, GitCompare } from "lucide-react";
import { Link, useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { SearchBar } from "@/components/SearchBar";
import { FilterBar } from "@/components/FilterBar";
import DateRangePicker from "@/components/DateRangePicker";
import { DatePresets } from "@/components/DatePresets";
import { useFilters, FilterState } from "@/hooks/useFilters";
import { DateRange } from "react-day-picker";
import { useMemo, useEffect } from "react";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { toast } from "sonner";

export default function Documents() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const utils = trpc.useUtils();
  const { data: documents, isLoading } = trpc.documents.list.useQuery(undefined, {
    enabled: !!user,
  });

  // WebSocket integration for real-time updates
  const { onDocumentStatus, connected } = useWebSocket();

  useEffect(() => {
    if (!connected) return;

    const unsubscribe = onDocumentStatus((data) => {
      console.log("[Documents] Received status update:", data);
      
      // Invalidate and refetch documents list
      utils.documents.list.invalidate();

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

    return unsubscribe;
  }, [connected, onDocumentStatus, utils]);

  // Filter function
  const filterDocuments = useMemo(
    () => (doc: any, filters: FilterState) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (!doc.filename.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      // Category filter
      if (filters.categories.length > 0) {
        if (!filters.categories.includes(doc.category)) {
          return false;
        }
      }

      // Status filter
      if (filters.statuses.length > 0) {
        if (!filters.statuses.includes(doc.status)) {
          return false;
        }
      }

      // Date range filter
      if (filters.dateFrom) {
        if (new Date(doc.createdAt) < filters.dateFrom) {
          return false;
        }
      }
      if (filters.dateTo) {
        const dateTo = new Date(filters.dateTo);
        dateTo.setHours(23, 59, 59, 999); // End of day
        if (new Date(doc.createdAt) > dateTo) {
          return false;
        }
      }

      return true;
    },
    []
  );

  const {
    filters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
    filteredItems,
    totalCount,
    filteredCount,
  } = useFilters(documents || [], filterDocuments);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="container flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-8 w-8" />}
              <span className="text-xl font-bold text-foreground">{APP_TITLE}</span>
            </div>
            <Button asChild>
              <a href={getLoginUrl()}>Sign In</a>
            </Button>
          </div>
        </header>
        <div className="container max-w-2xl py-20 text-center">
          <h1 className="text-4xl font-bold mb-4">Sign in to view your documents</h1>
          <p className="text-muted-foreground text-lg mb-8">
            Access your uploaded documents and OCR results
          </p>
          <Button asChild size="lg">
            <a href={getLoginUrl()}>Sign In</a>
          </Button>
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "processing":
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4" />;
      case "failed":
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    const statusInfo = DOCUMENT_STATUS[status as keyof typeof DOCUMENT_STATUS];
    return statusInfo?.color || "gray";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-8 w-8" />}
            <span className="text-xl font-bold text-foreground">{APP_TITLE}</span>
          </div>
          <nav className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/">Home</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/documents">Documents</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/batches">Batches</Link>
            </Button>
            <Button asChild>
              <Link href="/upload">
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <div className="container max-w-7xl py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">My Documents</h1>
            <p className="text-muted-foreground text-lg">
              {filteredCount === totalCount
                ? `${totalCount} documents`
                : `${filteredCount} of ${totalCount} documents`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/batch-upload">
                <Upload className="mr-2 h-4 w-4" />
                Batch Upload
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/compare">
                <GitCompare className="mr-2 h-5 w-5" />
                Compare
              </Link>
            </Button>
            <Button asChild size="lg">
              <Link href="/upload">
                <Upload className="mr-2 h-5 w-5" />
                Upload Document
              </Link>
            </Button>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4">
              <SearchBar
                value={filters.search}
                onChange={(value) => updateFilter("search", value)}
                placeholder="Search documents by filename..."
              />
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <FilterBar
                    categories={filters.categories}
                    statuses={filters.statuses}
                    sortBy={filters.sortBy}
                    sortOrder={filters.sortOrder}
                    onCategoriesChange={(categories) => updateFilter("categories", categories)}
                    onStatusesChange={(statuses) => updateFilter("statuses", statuses)}
                    onSortByChange={(sortBy) => updateFilter("sortBy", sortBy)}
                    onSortOrderChange={(sortOrder) => updateFilter("sortOrder", sortOrder)}
                    onClearFilters={clearFilters}
                    hasActiveFilters={hasActiveFilters}
                    showCategories={true}
                  />
                </div>
                <div className="md:w-80">
                  <DatePresets
                    onSelectPreset={(range) => {
                      updateFilter("dateFrom", range.from ?? null);
                      updateFilter("dateTo", range.to ?? null);
                    }}
                  />
                  <DateRangePicker
                    value={{
                      from: filters.dateFrom ?? undefined,
                      to: filters.dateTo ?? undefined,
                    }}
                    onChange={(range: DateRange | undefined) => {
                      updateFilter("dateFrom", range?.from ?? null);
                      updateFilter("dateTo", range?.to ?? null);
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documents Grid */}
        {filteredItems.length === 0 ? (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <div className="rounded-full bg-primary/10 p-6 w-fit mx-auto mb-4">
                <FileText className="h-12 w-12 text-primary" />
              </div>
              {hasActiveFilters ? (
                <>
                  <h2 className="text-2xl font-bold mb-2">No documents found</h2>
                  <p className="text-muted-foreground mb-6">
                    Try adjusting your filters or search terms
                  </p>
                  <Button onClick={clearFilters}>Clear Filters</Button>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold mb-2">No documents yet</h2>
                  <p className="text-muted-foreground mb-6">
                    Upload your first document to get started with OCR processing
                  </p>
                  <Button asChild size="lg">
                    <Link href="/upload">
                      <Upload className="mr-2 h-5 w-5" />
                      Upload Your First Document
                    </Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredItems.map((doc: any) => {
              const category = DOCUMENT_CATEGORIES[doc.category as keyof typeof DOCUMENT_CATEGORIES];
              const statusInfo = DOCUMENT_STATUS[doc.status as keyof typeof DOCUMENT_STATUS];

              return (
                <Card key={doc.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="rounded-lg bg-primary/10 p-3">
                          <FileText className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-xl truncate">{doc.filename}</CardTitle>
                          <CardDescription className="flex items-center gap-2 flex-wrap mt-1">
                            <span className="text-base">{category?.icon}</span>
                            <span>{category?.label}</span>
                            <span>•</span>
                            <span>{(doc.fileSize / 1024).toFixed(1)} KB</span>
                            <span>•</span>
                            <span>{formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}</span>
                          </CardDescription>
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
                        <span className="mr-1.5">{getStatusIcon(doc.status)}</span>
                        {statusInfo?.label || doc.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  {doc.status === "completed" && (
                    <CardContent>
                      <Button variant="outline" asChild>
                        <Link href={`/documents/${doc.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Results
                        </Link>
                      </Button>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
