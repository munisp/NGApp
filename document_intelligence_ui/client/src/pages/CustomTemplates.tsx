import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Trash2,
  Copy,
  Download,
  Loader2,
  FileText,
  Globe,
  Lock,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";

export default function CustomTemplates() {
  const [, setLocation] = useLocation();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);

  const { data: templates, isLoading, refetch } = trpc.customTemplates.list.useQuery();

  const deleteMutation = trpc.customTemplates.delete.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setDeleteDialogOpen(false);
      setSelectedTemplateId(null);
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to delete template: ${error.message}`);
    },
  });

  const duplicateMutation = trpc.customTemplates.duplicate.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to duplicate template: ${error.message}`);
    },
  });

  const exportTemplateMutation = trpc.customTemplates.exportTemplate.useQuery(
    { id: selectedTemplateId! },
    { enabled: false }
  );

  const handleDelete = () => {
    if (selectedTemplateId) {
      deleteMutation.mutate({ id: selectedTemplateId });
    }
  };

  const handleDuplicate = (id: number) => {
    duplicateMutation.mutate({ id });
  };

  const handleExport = async (id: number, name: string) => {
    try {
      const data = await trpc.customTemplates.exportTemplate.useQuery({ id });
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${name}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Template exported successfully");
    } catch (error) {
      toast.error("Failed to export template");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Custom Templates</h1>
            <p className="text-muted-foreground mt-2">
              Manage your custom document templates and field definitions
            </p>
          </div>
          <Button onClick={() => setLocation("/template-builder")}>
            <Plus className="mr-2 h-4 w-4" />
            Create Template
          </Button>
        </div>

        {/* Templates Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : templates && templates.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{template.icon}</span>
                      <div>
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {template.description || "No description"}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Stats */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>{template.fields.length} fields</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span>{template.useCount} uses</span>
                      </div>
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">
                        {template.ocrSettings.strategy.replace(/_/g, " ")}
                      </Badge>
                      <Badge variant="outline">
                        {template.ocrSettings.confidenceThreshold}% threshold
                      </Badge>
                      {template.isPublic ? (
                        <Badge variant="default">
                          <Globe className="h-3 w-3 mr-1" />
                          Public
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <Lock className="h-3 w-3 mr-1" />
                          Private
                        </Badge>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      <div>Created {format(new Date(template.createdAt), "MMM d, yyyy")}</div>
                      {template.lastUsedAt && (
                        <div>
                          Last used {format(new Date(template.lastUsedAt), "MMM d, yyyy")}
                        </div>
                      )}
                      {!template.isOwner && (
                        <div className="text-primary mt-1">Shared template</div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleDuplicate(template.id)}
                        disabled={duplicateMutation.isPending}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Duplicate
                      </Button>
                      {template.isOwner && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedTemplateId(template.id);
                            setDeleteDialogOpen(true);
                          }}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Custom Templates</h3>
              <p className="text-muted-foreground mb-6">
                Create your first custom template to define document fields and OCR settings
              </p>
              <Button onClick={() => setLocation("/template-builder")}>
                <Plus className="mr-2 h-4 w-4" />
                Create Template
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Custom Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
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
