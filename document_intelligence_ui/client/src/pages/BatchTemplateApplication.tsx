import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  Layers,
  Loader2,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { DOCUMENT_CATEGORIES } from "@shared/documentCategories";
import { DOCUMENT_TEMPLATES, getTemplatesByCategory } from "@shared/documentTemplates";
import { formatDistanceToNow } from "date-fns";

export default function BatchTemplateApplication() {
  const [selectedDocuments, setSelectedDocuments] = useState<number[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [withoutTemplateOnly, setWithoutTemplateOnly] = useState(false);

  // Fetch eligible documents
  const { data: documents, isLoading, refetch } = trpc.batchTemplateApplication.getEligibleDocuments.useQuery({
    category: categoryFilter || undefined,
    status: statusFilter as any || undefined,
    withoutTemplate: withoutTemplateOnly,
  });

  // Fetch custom templates
  const { data: customTemplates } = trpc.customTemplates.list.useQuery();

  // Fetch stats
  const { data: stats } = trpc.batchTemplateApplication.getBatchStats.useQuery();

  // Apply template mutation
  const applyMutation = trpc.batchTemplateApplication.applyTemplateToDocuments.useMutation({
    onSuccess: (data) => {
      toast.success(`Template applied to ${data.successful} of ${data.total} documents`);
      setSelectedDocuments([]);
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to apply template: ${error.message}`);
    },
  });

  const handleSelectAll = () => {
    if (documents) {
      if (selectedDocuments.length === documents.length) {
        setSelectedDocuments([]);
      } else {
        setSelectedDocuments(documents.map(d => d.id));
      }
    }
  };

  const handleToggleDocument = (id: number) => {
    setSelectedDocuments(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const handleApplyTemplate = () => {
    if (!selectedTemplate) {
      toast.error("Please select a template");
      return;
    }

    if (selectedDocuments.length === 0) {
      toast.error("Please select at least one document");
      return;
    }

    applyMutation.mutate({
      documentIds: selectedDocuments,
      templateId: selectedTemplate,
      revalidate: true,
    });
  };

  // Get available templates for selected category
  const availableTemplates = categoryFilter
    ? [
        ...getTemplatesByCategory(categoryFilter as any),
        ...(customTemplates?.filter(t => t.category === categoryFilter) || []),
      ]
    : [];

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Layers className="h-8 w-8" />
            Batch Template Application
          </h1>
          <p className="text-muted-foreground mt-2">
            Apply templates to existing documents retroactively
          </p>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">With Template</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">{stats.withTemplate}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Without Template</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-500">{stats.withoutTemplate}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Validated</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-500">{stats.validated}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Category</label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All categories</SelectItem>
                    {Object.entries(DOCUMENT_CATEGORIES).map(([id, category]) => (
                      <SelectItem key={id} value={id}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Template</label>
                <Select 
                  value={selectedTemplate} 
                  onValueChange={setSelectedTemplate}
                  disabled={!categoryFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={categoryFilter ? "Select template" : "Select category first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTemplates.length === 0 ? (
                      <SelectItem value="" disabled>No templates available</SelectItem>
                    ) : (
                      <>
                        {getTemplatesByCategory(categoryFilter as any).map(template => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.icon} {template.name}
                          </SelectItem>
                        ))}
                        {customTemplates?.filter(t => t.category === categoryFilter).map(template => (
                          <SelectItem key={`custom-${template.id}`} value={`custom-${template.id}`}>
                            {template.icon} {template.name} (Custom)
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={withoutTemplateOnly}
                    onCheckedChange={(checked) => setWithoutTemplateOnly(checked as boolean)}
                  />
                  <span className="text-sm">Without template only</span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Document List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Documents</CardTitle>
                <CardDescription>
                  {selectedDocuments.length > 0
                    ? `${selectedDocuments.length} document(s) selected`
                    : "Select documents to apply template"}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleSelectAll}>
                  {selectedDocuments.length === documents?.length ? "Deselect All" : "Select All"}
                </Button>
                <Button
                  onClick={handleApplyTemplate}
                  disabled={selectedDocuments.length === 0 || !selectedTemplate || applyMutation.isPending}
                >
                  {applyMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Applying...
                    </>
                  ) : (
                    `Apply Template (${selectedDocuments.length})`
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : documents && documents.length > 0 ? (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedDocuments.includes(doc.id) ? "bg-muted border-primary" : ""
                    }`}
                    onClick={() => handleToggleDocument(doc.id)}
                  >
                    <Checkbox
                      checked={selectedDocuments.includes(doc.id)}
                      onCheckedChange={() => handleToggleDocument(doc.id)}
                    />
                    <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1">
                      <div className="font-medium">{doc.filename}</div>
                      <div className="text-sm text-muted-foreground">
                        {DOCUMENT_CATEGORIES[doc.category as keyof typeof DOCUMENT_CATEGORIES]?.label || doc.category}
                        {" • "}
                        {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant={doc.status === "completed" ? "default" : "secondary"}>
                        {doc.status}
                      </Badge>
                      {doc.templateId ? (
                        <Badge variant="outline">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Has Template
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          No Template
                        </Badge>
                      )}
                      {doc.validationStatus && doc.validationStatus !== 'not_validated' && (
                        <Badge
                          variant={
                            doc.validationStatus === 'valid' ? 'default' :
                            doc.validationStatus === 'invalid' ? 'destructive' : 'secondary'
                          }
                        >
                          {doc.validationStatus}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Documents Found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your filters or upload some documents first
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
