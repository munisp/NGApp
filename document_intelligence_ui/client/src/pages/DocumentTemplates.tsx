import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DOCUMENT_TEMPLATES,
  getTemplateCategories,
  getTemplatesByCategory,
  type DocumentTemplate,
  type FieldTemplate,
} from "@shared/documentTemplates";
import {
  FileText,
  Receipt,
  FileSignature,
  Zap,
  Plane,
  Car,
  Search,
  CheckCircle,
  AlertCircle,
  Info,
} from "lucide-react";

const ICON_MAP: Record<string, any> = {
  FileText,
  Receipt,
  FileSignature,
  Zap,
  Plane,
  Car,
};

const COLOR_MAP: Record<string, string> = {
  blue: "bg-blue-100 text-blue-700 border-blue-200",
  green: "bg-green-100 text-green-700 border-green-200",
  purple: "bg-purple-100 text-purple-700 border-purple-200",
  orange: "bg-orange-100 text-orange-700 border-orange-200",
  red: "bg-red-100 text-red-700 border-red-200",
  yellow: "bg-yellow-100 text-yellow-700 border-yellow-200",
};

export default function DocumentTemplates() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const categories = getTemplateCategories();

  const filteredTemplates = DOCUMENT_TEMPLATES.filter((template) => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleViewDetails = (template: DocumentTemplate) => {
    setSelectedTemplate(template);
    setShowDetails(true);
  };

  const getFieldTypeIcon = (type: string) => {
    switch (type) {
      case 'text':
        return <FileText className="h-4 w-4" />;
      case 'number':
      case 'currency':
        return <span className="text-xs font-bold">#</span>;
      case 'date':
        return <span className="text-xs font-bold">📅</span>;
      case 'email':
        return <span className="text-xs font-bold">@</span>;
      case 'phone':
        return <span className="text-xs font-bold">📞</span>;
      case 'address':
        return <span className="text-xs font-bold">📍</span>;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Document Templates</h1>
          <p className="text-muted-foreground mt-2">
            Pre-configured extraction templates for common document types to improve OCR accuracy
          </p>
        </div>

        {/* Info Banner */}
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">How Templates Work</p>
                <p>
                  Templates define expected fields, validation rules, and extraction hints for specific
                  document types. When you upload a document, select a template to automatically apply
                  optimized OCR settings and field extraction patterns, reducing manual review time.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => {
            const Icon = ICON_MAP[template.icon] || FileText;
            const colorClass = COLOR_MAP[template.color] || COLOR_MAP.blue;

            return (
              <Card key={template.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <div className={`p-3 rounded-lg ${colorClass}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <Badge variant="secondary">{template.category}</Badge>
                  </div>
                  <CardTitle className="text-xl">{template.name}</CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Fields:</span>
                      <span className="font-medium">{template.fields.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Strategy:</span>
                      <Badge variant="outline" className="text-xs">
                        {template.ocrStrategy.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Confidence:</span>
                      <span className="font-medium">{template.confidenceThreshold}%</span>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full mt-2"
                      onClick={() => handleViewDetails(template)}
                    >
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredTemplates.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No templates found matching your criteria</p>
          </div>
        )}
      </div>

      {/* Template Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          {selectedTemplate && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  {(() => {
                    const Icon = ICON_MAP[selectedTemplate.icon] || FileText;
                    const colorClass = COLOR_MAP[selectedTemplate.color] || COLOR_MAP.blue;
                    return (
                      <div className={`p-2 rounded-lg ${colorClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                    );
                  })()}
                  <div>
                    <DialogTitle>{selectedTemplate.name}</DialogTitle>
                    <Badge variant="secondary" className="mt-1">
                      {selectedTemplate.category}
                    </Badge>
                  </div>
                </div>
                <DialogDescription>{selectedTemplate.description}</DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="fields" className="mt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="fields">Fields ({selectedTemplate.fields.length})</TabsTrigger>
                  <TabsTrigger value="settings">OCR Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="fields" className="space-y-4 mt-4">
                  <div className="grid gap-4">
                    {selectedTemplate.fields.map((field) => (
                      <Card key={field.name}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {getFieldTypeIcon(field.type)}
                              <div>
                                <p className="font-medium">{field.label}</p>
                                <p className="text-xs text-muted-foreground">
                                  {field.name} • {field.type}
                                </p>
                              </div>
                            </div>
                            {field.required ? (
                              <Badge variant="destructive" className="text-xs">
                                Required
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                Optional
                              </Badge>
                            )}
                          </div>

                          {field.extractionHints && field.extractionHints.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-muted-foreground mb-1">Extraction hints:</p>
                              <div className="flex flex-wrap gap-1">
                                {field.extractionHints.map((hint, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {hint}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {field.validation && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              <p>Validation:</p>
                              <ul className="list-disc list-inside ml-2 mt-1">
                                {field.validation.pattern && (
                                  <li>Pattern: {field.validation.pattern}</li>
                                )}
                                {field.validation.minLength && (
                                  <li>Min length: {field.validation.minLength}</li>
                                )}
                                {field.validation.maxLength && (
                                  <li>Max length: {field.validation.maxLength}</li>
                                )}
                                {field.validation.min !== undefined && (
                                  <li>Min value: {field.validation.min}</li>
                                )}
                                {field.validation.max !== undefined && (
                                  <li>Max value: {field.validation.max}</li>
                                )}
                              </ul>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="settings" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">OCR Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">OCR Strategy</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          {selectedTemplate.ocrStrategy.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {selectedTemplate.ocrStrategy === 'highest_confidence' &&
                            'Uses the result from the engine with the highest confidence score'}
                          {selectedTemplate.ocrStrategy === 'majority_vote' &&
                            'Uses the result that appears most frequently across engines'}
                          {selectedTemplate.ocrStrategy === 'weighted_average' &&
                            'Combines results from all engines with confidence-based weighting'}
                          {selectedTemplate.ocrStrategy === 'all_engines' &&
                            'Returns results from all engines for manual comparison'}
                        </p>
                      </div>

                      <div>
                        <Label className="text-sm font-medium">Confidence Threshold</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          {selectedTemplate.confidenceThreshold}%
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Documents with confidence below this threshold will be flagged for manual review
                        </p>
                      </div>

                      <div className="pt-4 border-t">
                        <div className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                          <div className="text-sm">
                            <p className="font-medium text-foreground">Optimized for Accuracy</p>
                            <p className="text-muted-foreground">
                              This template uses settings optimized for {selectedTemplate.name.toLowerCase()} documents
                              based on industry best practices
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
