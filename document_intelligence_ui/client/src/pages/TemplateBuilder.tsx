import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  Plus,
  Trash2,
  Save,
  FileJson,
  Upload as UploadIcon,
  Download,
  Loader2,
  GripVertical,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "currency", label: "Currency" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "address", label: "Address" },
  { value: "boolean", label: "Boolean" },
];

const OCR_STRATEGIES = [
  { value: "weighted_average", label: "Weighted Average" },
  { value: "highest_confidence", label: "Highest Confidence" },
  { value: "majority_vote", label: "Majority Vote" },
];

const DOCUMENT_CATEGORIES = [
  { value: "citizenship_identity", label: "Citizenship & Identity" },
  { value: "immigration_status", label: "Immigration Status" },
  { value: "income_employment", label: "Income & Employment" },
  { value: "tribal_aian", label: "Tribal/AIAN" },
  { value: "employer_health_coverage", label: "Employer Health Coverage" },
  { value: "household_relationship", label: "Household Relationship" },
  { value: "other_supporting", label: "Other Supporting" },
];

interface Field {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'email' | 'phone' | 'address' | 'boolean';
  required: boolean;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  };
  extractionHints?: string[];
}

export default function TemplateBuilder() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("📄");
  const [category, setCategory] = useState("");
  const [fields, setFields] = useState<Field[]>([]);
  const [ocrStrategy, setOcrStrategy] = useState("weighted_average");
  const [confidenceThreshold, setConfidenceThreshold] = useState(85);
  const [isPublic, setIsPublic] = useState(false);

  const createMutation = trpc.customTemplates.create.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setLocation("/templates");
    },
    onError: (error) => {
      toast.error(`Failed to create template: ${error.message}`);
    },
  });

  const addField = () => {
    setFields([
      ...fields,
      {
        name: "",
        label: "",
        type: "text",
        required: false,
      },
    ]);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, updates: Partial<Field>) => {
    setFields(
      fields.map((field, i) => (i === index ? { ...field, ...updates } : field))
    );
  };

  const handleSave = () => {
    // Validation
    if (!name.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    if (!category) {
      toast.error("Please select a document category");
      return;
    }

    if (fields.length === 0) {
      toast.error("Please add at least one field");
      return;
    }

    // Validate fields
    for (const field of fields) {
      if (!field.name.trim()) {
        toast.error("All fields must have a name");
        return;
      }
      if (!field.label.trim()) {
        toast.error("All fields must have a label");
        return;
      }
    }

    createMutation.mutate({
      name,
      description: description || undefined,
      icon,
      category,
      fields,
      ocrSettings: {
        strategy: ocrStrategy as any,
        confidenceThreshold,
      },
      isPublic,
    });
  };

  const handleExport = () => {
    const templateData = {
      name,
      description,
      icon,
      category,
      fields,
      ocrSettings: {
        strategy: ocrStrategy,
        confidenceThreshold,
      },
      exportedAt: new Date().toISOString(),
      version: "1.0",
    };

    const blob = new Blob([JSON.stringify(templateData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name || "template"}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("Template exported successfully");
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        setName(data.name || "");
        setDescription(data.description || "");
        setIcon(data.icon || "📄");
        setCategory(data.category || "");
        setFields(data.fields || []);
        setOcrStrategy(data.ocrSettings?.strategy || "weighted_average");
        setConfidenceThreshold(data.ocrSettings?.confidenceThreshold || 85);
        toast.success("Template imported successfully");
      } catch (error) {
        toast.error("Failed to import template: Invalid JSON format");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-5xl py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Template Builder</h1>
            <p className="text-muted-foreground mt-2">
              Create custom document templates with field definitions and OCR settings
            </p>
          </div>
          <div className="flex gap-2">
            <input
              type="file"
              id="import-template"
              accept=".json"
              className="hidden"
              onChange={handleImport}
            />
            <Button variant="outline" onClick={() => document.getElementById("import-template")?.click()}>
              <UploadIcon className="mr-2 h-4 w-4" />
              Import
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={!name || fields.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button onClick={handleSave} disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Template
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Define template name, category, and appearance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Template Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Company Invoice"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="icon">Icon (Emoji)</Label>
                  <Input
                    id="icon"
                    placeholder="📄"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    maxLength={10}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what this template is for..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Document Category *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isPublic"
                  checked={isPublic}
                  onCheckedChange={(checked) => setIsPublic(checked as boolean)}
                />
                <Label htmlFor="isPublic" className="cursor-pointer">
                  Make this template public (visible to all users)
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Fields */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Fields</CardTitle>
                  <CardDescription>
                    Define the fields to extract from documents
                    {fields.length > 0 && ` (${fields.length} fields)`}
                  </CardDescription>
                </div>
                <Button onClick={addField} variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Field
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {fields.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <FileJson className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Fields Yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Add fields to define what data to extract from documents
                  </p>
                  <Button onClick={addField}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Field
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <div key={index} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1 grid grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs">Field Name *</Label>
                            <Input
                              placeholder="e.g., invoice_number"
                              value={field.name}
                              onChange={(e) => updateField(index, { name: e.target.value })}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Label *</Label>
                            <Input
                              placeholder="e.g., Invoice Number"
                              value={field.label}
                              onChange={(e) => updateField(index, { label: e.target.value })}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Type</Label>
                            <Select
                              value={field.type}
                              onValueChange={(val) => updateField(index, { type: val as Field['type'] })}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FIELD_TYPES.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeField(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>

                      <div className="flex items-center space-x-2 ml-7">
                        <Checkbox
                          id={`required-${index}`}
                          checked={field.required}
                          onCheckedChange={(checked) =>
                            updateField(index, { required: checked as boolean })
                          }
                        />
                        <Label htmlFor={`required-${index}`} className="cursor-pointer text-sm">
                          Required field
                        </Label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* OCR Settings */}
          <Card>
            <CardHeader>
              <CardTitle>OCR Settings</CardTitle>
              <CardDescription>Configure OCR processing strategy and thresholds</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>OCR Strategy</Label>
                  <Select value={ocrStrategy} onValueChange={setOcrStrategy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OCR_STRATEGIES.map((strategy) => (
                        <SelectItem key={strategy.value} value={strategy.value}>
                          {strategy.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Confidence Threshold (%)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={confidenceThreshold}
                      onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                    />
                    <Badge variant="outline">{confidenceThreshold}%</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
