import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { DOCUMENT_CATEGORIES, DocumentCategoryId } from "@shared/documentCategories";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
  Play,
  X,
  AlertCircle,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useLocation } from "wouter";
import { useBatchQueue } from "@/hooks/useBatchQueue";
import Joyride from 'react-joyride';
import { useGuidedTour } from '@/hooks/useGuidedTour';
import { batchUploadTourSteps } from '@/config/batchUploadTour';
import { HelpCircle } from 'lucide-react';

export default function BatchUpload() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategoryId>("citizenship_identity");
  const [batchName, setBatchName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  
  // Guided tour
  const { run, stepIndex, startTour, handleJoyrideCallback } = useGuidedTour({
    tourKey: 'batch-upload',
    steps: batchUploadTourSteps,
  });

  const {
    queue,
    isProcessing,
    addFiles,
    removeFile,
    clearQueue,
    clearProcessed,
    processQueue,
    cancelProcessing,
    statistics,
  } = useBatchQueue();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      handleFiles(files);
    },
    [selectedCategory]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      handleFiles(files);
    },
    [selectedCategory]
  );

  const handleFiles = (files: File[]) => {
    // Validate files
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
    const validFiles = files.filter((file) => {
      if (!validTypes.includes(file.type)) {
        return false;
      }
      if (file.size > 50 * 1024 * 1024) {
        return false;
      }
      return true;
    });

    if (validFiles.length < files.length) {
      alert(
        `${files.length - validFiles.length} files were skipped (invalid type or size > 50MB)`
      );
    }

    if (validFiles.length > 0) {
      addFiles(validFiles, selectedCategory);
    }
  };

  const handleProcessQueue = async () => {
    const result = await processQueue(batchName || undefined);
    if (result) {
      // Navigate to batch detail page after a delay
      setTimeout(() => {
        setLocation(`/batches/${result.batchId}`);
      }, 2000);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "queued":
        return <FileText className="h-4 w-4 text-muted-foreground" />;
      case "uploading":
      case "processing":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "queued":
        return "secondary";
      case "uploading":
      case "processing":
        return "default";
      case "completed":
        return "default";
      case "failed":
        return "destructive";
      default:
        return "secondary";
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container max-w-7xl py-12">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Batch Upload</h1>
            <p className="text-muted-foreground text-lg">
              Upload multiple documents at once for efficient processing
            </p>
          </div>
          <Button onClick={startTour} variant="outline">
            <HelpCircle className="w-4 h-4 mr-2" />
            Start Tour
          </Button>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column: Upload Area */}
          <div className="space-y-6">
            {/* Batch Name */}
            <Card>
              <CardHeader>
                <CardTitle>Batch Information</CardTitle>
                <CardDescription>Optional: Give this batch a name for easy reference</CardDescription>
              </CardHeader>
              <CardContent>
                <Input
                  placeholder="e.g., January 2025 Applications"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  disabled={isProcessing}
                />
              </CardContent>
            </Card>

            {/* Category Selection */}
            <Card data-tour="category-selector">
              <CardHeader>
                <CardTitle>Document Category</CardTitle>
                <CardDescription>All files in this batch will use this category</CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  value={selectedCategory}
                  onValueChange={(value) => setSelectedCategory(value as DocumentCategoryId)}
                  disabled={isProcessing}
                  data-tour="file-selector"
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(DOCUMENT_CATEGORIES).map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{category.icon}</span>
                          <div>
                            <div className="font-medium">{category.label}</div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Upload Area */}
            <Card>
              <CardContent className="p-0">
                <div
                  className={`
                    relative border-2 border-dashed rounded-lg p-12 text-center transition-all
                    ${isDragging ? "border-primary bg-primary/5 scale-[1.02]" : "border-muted-foreground/25 hover:border-primary/50"}
                    ${isProcessing ? "opacity-50 pointer-events-none" : ""}
                  `}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    id="batch-file-upload"
                    className="hidden"
                    accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                    multiple
                    onChange={handleFileSelect}
                    disabled={isProcessing}
                  />

                  <div className="flex flex-col items-center gap-4">
                    <div className="rounded-full bg-primary/10 p-6">
                      <Upload className="h-12 w-12 text-primary" />
                    </div>

                    <div>
                      <h3 className="text-xl font-semibold mb-2">Add files to batch</h3>
                      <p className="text-muted-foreground">
                        Drop files here or click to browse
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        JPG, PNG, WEBP, PDF • Max 50MB per file
                      </p>
                    </div>

                    <Button asChild size="lg" disabled={isProcessing}>
                      <label htmlFor="batch-file-upload" className="cursor-pointer">
                        <FileText className="mr-2 h-5 w-5" />
                        Select Files
                      </label>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Queue */}
          <div className="space-y-6">
            {/* Statistics */}
            <Card data-tour="queue-stats">
              <CardHeader>
                <CardTitle>Queue Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold">{statistics.total}</div>
                    <div className="text-sm text-muted-foreground">Total</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{statistics.completed}</div>
                    <div className="text-sm text-muted-foreground">Completed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">{statistics.failed}</div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Queue Actions */}
            <Card data-tour="upload-button">
              <CardContent className="pt-6">
                <div className="flex gap-2" data-tour="batch-actions">
                  <Button
                    className="flex-1"
                    onClick={handleProcessQueue}
                    disabled={queue.length === 0 || isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Process Batch ({queue.length})
                      </>
                    )}
                  </Button>
                  {isProcessing ? (
                    <Button variant="destructive" onClick={cancelProcessing}>
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" onClick={clearProcessed} disabled={queue.length === 0}>
                        Clear Processed
                      </Button>
                      <Button variant="outline" onClick={clearQueue} disabled={queue.length === 0}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Queue List */}
            <Card data-tour="queue-list">
              <CardHeader>
                <CardTitle>File Queue</CardTitle>
                <CardDescription>
                  {queue.length === 0 ? "No files in queue" : `${queue.length} files ready`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[500px] overflow-y-auto" data-tour="selected-files">
                  {queue.map((queuedFile) => (
                    <div
                      key={queuedFile.id}
                      className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex-shrink-0">{getStatusIcon(queuedFile.status)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{queuedFile.file.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {(queuedFile.file.size / 1024).toFixed(1)} KB
                        </div>
                        {queuedFile.status === "uploading" || queuedFile.status === "processing" ? (
                          <Progress value={queuedFile.progress} className="mt-1 h-1" />
                        ) : null}
                        {queuedFile.error && (
                          <div className="text-xs text-red-500 mt-1">{queuedFile.error}</div>
                        )}
                      </div>
                      <Badge variant={getStatusColor(queuedFile.status) as any}>
                        {queuedFile.status}
                      </Badge>
                      {!isProcessing && queuedFile.status === "queued" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(queuedFile.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* Concurrent Processing Info */}
        <div className="mt-6" data-tour="concurrent-info">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Concurrent Processing</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    The system processes up to 5 files simultaneously for optimal performance. 
                    Remaining files wait in the queue and start automatically as slots become available.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* File Actions Info */}
        <div className="mt-4" data-tour="file-actions">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">File Actions</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    For completed files, click to view detailed OCR results. For failed files, 
                    you can retry processing or remove them from the batch.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Guided Tour */}
      <Joyride
        steps={batchUploadTourSteps}
        run={run}
        stepIndex={stepIndex}
        callback={handleJoyrideCallback}
        continuous
        showProgress
        showSkipButton
        styles={{
          options: {
            primaryColor: '#3b82f6',
            zIndex: 10000,
          },
        }}
      />
    </div>
  );
}
