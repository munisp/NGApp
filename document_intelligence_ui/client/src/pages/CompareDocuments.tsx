import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { DOCUMENT_CATEGORIES, DOCUMENT_STATUS } from "@shared/documentCategories";
import { 
  FileText, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle,
  ArrowLeft,
  GitCompare,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export default function CompareDocuments() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedDocuments, setSelectedDocuments] = useState<number[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: documents, isLoading } = trpc.documents.list.useQuery(undefined, {
    enabled: !!user,
  });

  // Filter documents by selected category and completed status
  const filteredDocuments = useMemo(() => {
    if (!documents) return [];
    
    return documents.filter((doc) => {
      // Only show completed documents
      if (doc.status !== "completed") return false;
      
      // Filter by category if selected
      if (selectedCategory && doc.category !== selectedCategory) return false;
      
      return true;
    });
  }, [documents, selectedCategory]);

  // Group documents by category for display
  const documentsByCategory = useMemo(() => {
    const grouped: Record<string, typeof filteredDocuments> = {};
    
    filteredDocuments.forEach((doc) => {
      if (!grouped[doc.category]) {
        grouped[doc.category] = [];
      }
      grouped[doc.category].push(doc);
    });
    
    return grouped;
  }, [filteredDocuments]);

  const handleDocumentToggle = (documentId: number, category: string) => {
    setSelectedDocuments((prev) => {
      // If selecting a document from a different category, reset selection
      if (selectedCategory && selectedCategory !== category) {
        setSelectedCategory(category);
        return [documentId];
      }
      
      // Set category on first selection
      if (!selectedCategory) {
        setSelectedCategory(category);
      }
      
      // Toggle selection
      if (prev.includes(documentId)) {
        const newSelection = prev.filter((id) => id !== documentId);
        // Clear category if no documents selected
        if (newSelection.length === 0) {
          setSelectedCategory(null);
        }
        return newSelection;
      } else {
        // Limit to 3 documents
        if (prev.length >= 3) {
          toast.error("Maximum 3 documents can be compared");
          return prev;
        }
        return [...prev, documentId];
      }
    });
  };

  const handleCompare = () => {
    if (selectedDocuments.length < 2) {
      toast.error("Please select at least 2 documents to compare");
      return;
    }
    
    // Navigate to comparison view
    const ids = selectedDocuments.join(",");
    setLocation(`/compare/${ids}`);
  };

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
    switch (status) {
      case "pending":
        return "bg-gray-500";
      case "processing":
        return "bg-blue-500";
      case "completed":
        return "bg-green-500";
      case "failed":
        return "bg-red-500";
      default:
        return "bg-gray-500";
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
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Authentication Required</h2>
            <p className="text-muted-foreground mb-4">
              Please log in to compare documents.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/documents">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Documents
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Compare Documents</h1>
              <p className="text-sm text-muted-foreground">
                Select 2-3 documents from the same category to compare
              </p>
            </div>
          </div>
          <Button
            onClick={handleCompare}
            disabled={selectedDocuments.length < 2}
            size="lg"
          >
            <GitCompare className="mr-2 h-5 w-5" />
            Compare {selectedDocuments.length > 0 && `(${selectedDocuments.length})`}
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Selection Info */}
        {selectedDocuments.length > 0 && (
          <Card className="mb-6 border-primary">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {selectedDocuments.length} document{selectedDocuments.length !== 1 ? "s" : ""} selected
                  </p>
                  {selectedCategory && (
                    <p className="text-sm text-muted-foreground">
                      Category: {selectedCategory && DOCUMENT_CATEGORIES[selectedCategory as keyof typeof DOCUMENT_CATEGORIES]?.label}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedDocuments([]);
                    setSelectedCategory(null);
                  }}
                >
                  Clear Selection
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {filteredDocuments.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Completed Documents</h3>
              <p className="text-muted-foreground mb-4">
                You need at least 2 completed documents from the same category to use the comparison tool.
              </p>
              <Link href="/upload">
                <Button>Upload Documents</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Documents by Category */}
        {Object.entries(documentsByCategory).map(([category, docs]) => {
          const categoryInfo = DOCUMENT_CATEGORIES[category as keyof typeof DOCUMENT_CATEGORIES];
          
          return (
            <Card key={category} className="mb-6">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{categoryInfo?.icon}</div>
                  <div>
                    <CardTitle>{categoryInfo?.label}</CardTitle>
                    <CardDescription>
                      {docs.length} completed document{docs.length !== 1 ? "s" : ""}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {docs.map((doc) => {
                    const isSelected = selectedDocuments.includes(doc.id);
                    const isDisabled = 
                      selectedCategory && 
                      selectedCategory !== category && 
                      selectedDocuments.length > 0;

                    return (
                      <div
                        key={doc.id}
                        className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : isDisabled
                            ? "border-gray-200 bg-gray-50 opacity-50"
                            : "border-gray-200 hover:border-primary/50 hover:bg-gray-50"
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          disabled={isDisabled || undefined}
                          onCheckedChange={() => handleDocumentToggle(doc.id, category)}
                        />
                        
                        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{doc.filename}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <Badge
                              variant="secondary"
                              className={`${getStatusColor(doc.status)} text-white`}
                            >
                              <span className="mr-1">{getStatusIcon(doc.status)}</span>
                              {doc.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(doc.createdAt), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB` : "N/A"}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </main>
    </div>
  );
}
