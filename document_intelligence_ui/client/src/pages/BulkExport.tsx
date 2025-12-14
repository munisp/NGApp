import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Download, FileSpreadsheet, FileText, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import DateRangePicker from "@/components/DateRangePicker";

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

export default function BulkExport() {
  const [category, setCategory] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [includeOcrResults, setIncludeOcrResults] = useState(true);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv");

  // Get available fields based on category
  const { data: fieldsData, isLoading: fieldsLoading } = trpc.export.getExportFields.useQuery({
    category: category || undefined,
    includeOcrFields: includeOcrResults,
  });

  // Export mutation
  const exportMutation = trpc.export.exportDocuments.useMutation({
    onSuccess: (data) => {
      if (data.count === 0) {
        toast.error("No documents found matching the criteria");
        return;
      }

      // Convert data to CSV or JSON and download
      if (exportFormat === "csv") {
        downloadCSV(data.data);
      } else {
        downloadJSON(data.data);
      }

      toast.success(`Exported ${data.count} documents successfully`);
    },
    onError: (error) => {
      toast.error(`Export failed: ${error.message}`);
    },
  });

  const downloadCSV = (data: any[]) => {
    if (data.length === 0) return;

    // Get all unique keys from all objects
    const allKeys = Array.from(new Set(data.flatMap((item) => Object.keys(item))));

    // Create CSV header
    const header = allKeys.join(",");

    // Create CSV rows
    const rows = data.map((item) =>
      allKeys
        .map((key) => {
          const value = item[key];
          // Escape quotes and wrap in quotes if contains comma or newline
          if (value === null || value === undefined) return "";
          const stringValue = String(value);
          if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes('"')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
        .join(",")
    );

    const csv = [header, ...rows].join("\n");

    // Create download link
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `documents_export_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadJSON = (data: any[]) => {
    const json = JSON.stringify(data, null, 2);

    // Create download link
    const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `documents_export_${new Date().toISOString().split("T")[0]}.json`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = () => {
    exportMutation.mutate({
      category: category || undefined,
      status: status as any,
      startDate: dateRange.from?.toISOString(),
      endDate: dateRange.to?.toISOString(),
      includeOcrResults,
      fields: selectedFields.length > 0 ? selectedFields : undefined,
    });
  };

  const handleFieldToggle = (fieldName: string) => {
    setSelectedFields((prev) =>
      prev.includes(fieldName) ? prev.filter((f) => f !== fieldName) : [...prev, fieldName]
    );
  };

  const handleSelectAllFields = () => {
    if (fieldsData?.fields) {
      setSelectedFields(fieldsData.fields.map((f) => f.name));
    }
  };

  const handleDeselectAllFields = () => {
    setSelectedFields([]);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Bulk Export</h1>
          <p className="text-muted-foreground mt-2">
            Export processed documents with customizable field selection and filtering options
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Filters */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Export Filters</CardTitle>
                <CardDescription>Configure what to export</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Category Filter */}
                <div>
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

                {/* Status Filter */}
                <div>
                  <Label>Status</Label>
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

                {/* Date Range */}
                <div>
                  <Label>Date Range</Label>
                  <DateRangePicker
                    value={dateRange}
                    onChange={(range) => setDateRange({ from: range?.from, to: range?.to })}
                  />
                </div>

                {/* Include OCR Results */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeOcr"
                    checked={includeOcrResults}
                    onCheckedChange={(checked) => setIncludeOcrResults(checked as boolean)}
                  />
                  <Label htmlFor="includeOcr" className="cursor-pointer">
                    Include OCR Results
                  </Label>
                </div>

                {/* Export Format */}
                <div>
                  <Label>Export Format</Label>
                  <Select value={exportFormat} onValueChange={(val) => setExportFormat(val as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4" />
                          CSV (Excel)
                        </div>
                      </SelectItem>
                      <SelectItem value="json">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          JSON
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Field Selection */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Select Fields to Export</CardTitle>
                    <CardDescription>
                      Choose which fields to include in the export
                      {selectedFields.length > 0 && ` (${selectedFields.length} selected)`}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleSelectAllFields}>
                      Select All
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDeselectAllFields}>
                      Deselect All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {fieldsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : fieldsData?.fields && fieldsData.fields.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto">
                    {fieldsData.fields.map((field) => (
                      <div
                        key={field.name}
                        className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                      >
                        <Checkbox
                          id={field.name}
                          checked={selectedFields.includes(field.name)}
                          onCheckedChange={() => handleFieldToggle(field.name)}
                        />
                        <div className="flex-1">
                          <Label htmlFor={field.name} className="cursor-pointer font-medium">
                            {field.label}
                          </Label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {field.name} • {field.type}
                          </p>
                        </div>
                        {selectedFields.includes(field.name) && (
                          <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No fields available. Upload some documents first.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Export Button */}
            <div className="mt-6">
              <Button
                size="lg"
                className="w-full"
                onClick={handleExport}
                disabled={exportMutation.isPending || (fieldsData?.fields.length === 0)}
              >
                {exportMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-5 w-5" />
                    Export {exportFormat.toUpperCase()}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
