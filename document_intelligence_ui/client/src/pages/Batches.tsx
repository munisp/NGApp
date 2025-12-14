import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  Upload,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Eye,
  Layers,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { SearchBar } from "@/components/SearchBar";
import { FilterBar } from "@/components/FilterBar";
import DateRangePicker from "@/components/DateRangePicker";
import { DatePresets } from "@/components/DatePresets";
import { useFilters, FilterState } from "@/hooks/useFilters";
import { DateRange } from "react-day-picker";
import { useMemo } from "react";

export default function Batches() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const { data: batches, isLoading } = trpc.batches.list.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 5000, // Refetch every 5 seconds
  });

  // Filter function
  const filterBatches = useMemo(
    () => (batch: any, filters: FilterState) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const batchName = (batch.name || `Batch #${batch.id}`).toLowerCase();
        if (!batchName.includes(searchLower)) {
          return false;
        }
      }

      // Status filter
      if (filters.statuses.length > 0) {
        if (!filters.statuses.includes(batch.status)) {
          return false;
        }
      }

      // Date range filter
      if (filters.dateFrom) {
        if (new Date(batch.createdAt) < filters.dateFrom) {
          return false;
        }
      }
      if (filters.dateTo) {
        const dateTo = new Date(filters.dateTo);
        dateTo.setHours(23, 59, 59, 999); // End of day
        if (new Date(batch.createdAt) > dateTo) {
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
  } = useFilters(batches || [], filterBatches);

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
          <h1 className="text-4xl font-bold mb-4">Sign in to view your batches</h1>
          <p className="text-muted-foreground text-lg mb-8">
            Access your batch uploads and track processing progress
          </p>
          <Button asChild size="lg">
            <a href={getLoginUrl()}>Sign In</a>
          </Button>
        </div>
      </div>
    );
  }

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
              <Link href="/batch-upload">
                <Upload className="mr-2 h-4 w-4" />
                Batch Upload
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <div className="container max-w-7xl py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">My Batches</h1>
            <p className="text-muted-foreground text-lg">
              {filteredCount === totalCount
                ? `${totalCount} batches`
                : `${filteredCount} of ${totalCount} batches`}
            </p>
          </div>
          <Button asChild size="lg">
            <Link href="/batch-upload">
              <Upload className="mr-2 h-5 w-5" />
              New Batch Upload
            </Link>
          </Button>
        </div>

        {/* Search and Filter Bar */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4">
              <SearchBar
                value={filters.search}
                onChange={(value) => updateFilter("search", value)}
                placeholder="Search batches by name..."
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
                    showCategories={false}
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

        {/* Batches List */}
        {filteredItems.length === 0 ? (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <div className="rounded-full bg-primary/10 p-6 w-fit mx-auto mb-4">
                <Layers className="h-12 w-12 text-primary" />
              </div>
              {hasActiveFilters ? (
                <>
                  <h2 className="text-2xl font-bold mb-2">No batches found</h2>
                  <p className="text-muted-foreground mb-6">
                    Try adjusting your filters or search terms
                  </p>
                  <Button onClick={clearFilters}>Clear Filters</Button>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold mb-2">No batches yet</h2>
                  <p className="text-muted-foreground mb-6">
                    Upload multiple documents at once with batch processing
                  </p>
                  <Button asChild size="lg">
                    <Link href="/batch-upload">
                      <Upload className="mr-2 h-5 w-5" />
                      Create Your First Batch
                    </Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredItems.map((batch: any) => {
              const progressPercentage = batch.totalFiles > 0
                ? Math.round(((batch.completedFiles + batch.failedFiles) / batch.totalFiles) * 100)
                : 0;

              return (
                <Card key={batch.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl">
                          {batch.name || `Batch #${batch.id}`}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 flex-wrap mt-1">
                          <span>{formatDistanceToNow(new Date(batch.createdAt), { addSuffix: true })}</span>
                          <span>•</span>
                          <span>{batch.totalFiles} files</span>
                        </CardDescription>
                      </div>
                      <Badge variant={getStatusColor(batch.status) as any} className="px-3 py-1">
                        <span className="mr-1.5">{getStatusIcon(batch.status)}</span>
                        {batch.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Progress */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Progress</span>
                          <span className="text-sm text-muted-foreground">{progressPercentage}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${progressPercentage}%` }}
                          />
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="font-medium">{batch.completedFiles}</span>
                          <span className="text-muted-foreground">completed</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <XCircle className="h-4 w-4 text-red-500" />
                          <span className="font-medium">{batch.failedFiles}</span>
                          <span className="text-muted-foreground">failed</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {batch.totalFiles - batch.completedFiles - batch.failedFiles}
                          </span>
                          <span className="text-muted-foreground">pending</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <Button variant="outline" asChild>
                          <Link href={`/batches/${batch.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
