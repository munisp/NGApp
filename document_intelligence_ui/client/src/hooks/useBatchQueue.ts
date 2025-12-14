import { useState, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { DocumentCategoryId } from "@shared/documentCategories";

export interface QueuedFile {
  id: string;
  file: File;
  category: DocumentCategoryId;
  status: "queued" | "uploading" | "processing" | "completed" | "failed";
  progress: number;
  error?: string;
  documentId?: number;
}

export interface BatchUploadResult {
  batchId: number;
  successCount: number;
  failedCount: number;
}

export function useBatchQueue() {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const uploadBatchMutation = trpc.batches.uploadBatch.useMutation();

  /**
   * Add files to the queue
   */
  const addFiles = useCallback((files: File[], category: DocumentCategoryId) => {
    const newFiles: QueuedFile[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      file,
      category,
      status: "queued",
      progress: 0,
    }));

    setQueue((prev) => [...prev, ...newFiles]);
    return newFiles;
  }, []);

  /**
   * Remove a file from the queue
   */
  const removeFile = useCallback((fileId: string) => {
    setQueue((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  /**
   * Clear all files from the queue
   */
  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  /**
   * Clear completed and failed files
   */
  const clearProcessed = useCallback(() => {
    setQueue((prev) =>
      prev.filter((f) => f.status !== "completed" && f.status !== "failed")
    );
  }, []);

  /**
   * Convert files to base64
   */
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  /**
   * Process the entire queue
   */
  const processQueue = useCallback(
    async (batchName?: string): Promise<BatchUploadResult | null> => {
      if (queue.length === 0) {
        toast.error("No files in queue");
        return null;
      }

      if (isProcessing) {
        toast.error("Already processing");
        return null;
      }

      setIsProcessing(true);
      abortControllerRef.current = new AbortController();

      try {
        // Update all files to uploading status
        setQueue((prev) =>
          prev.map((f) => ({
            ...f,
            status: "uploading" as const,
            progress: 0,
          }))
        );

        // Convert all files to base64
        const filesWithData = await Promise.all(
          queue.map(async (queuedFile) => {
            try {
              const base64Data = await fileToBase64(queuedFile.file);
              return {
                filename: queuedFile.file.name,
                category: queuedFile.category,
                fileData: base64Data,
                mimeType: queuedFile.file.type,
                queueId: queuedFile.id,
              };
            } catch (error) {
              console.error("Failed to convert file:", error);
              setQueue((prev) =>
                prev.map((f) =>
                  f.id === queuedFile.id
                    ? {
                        ...f,
                        status: "failed" as const,
                        error: "Failed to read file",
                      }
                    : f
                )
              );
              return null;
            }
          })
        );

        const validFiles = filesWithData.filter((f) => f !== null);

        if (validFiles.length === 0) {
          toast.error("No valid files to upload");
          setIsProcessing(false);
          return null;
        }

        // Upload batch
        const result = await uploadBatchMutation.mutateAsync({
          name: batchName,
          files: validFiles.map((f) => ({
            filename: f.filename,
            category: f.category,
            fileData: f.fileData,
            mimeType: f.mimeType,
          })),
        });

        // Update queue with results
        result.results.forEach((uploadResult, index) => {
          const queueId = validFiles[index]?.queueId;
          if (queueId) {
            setQueue((prev) =>
              prev.map((f) =>
                f.id === queueId
                  ? {
                      ...f,
                      status: uploadResult.success ? "processing" : "failed",
                      progress: uploadResult.success ? 50 : 0,
                      error: uploadResult.error,
                      documentId: uploadResult.documentId,
                    }
                  : f
              )
            );
          }
        });

        const successCount = result.results.filter((r) => r.success).length;
        const failedCount = result.results.filter((r) => !r.success).length;

        toast.success(`Batch uploaded: ${successCount} files`, {
          description:
            failedCount > 0 ? `${failedCount} files failed to upload` : undefined,
        });

        setIsProcessing(false);

        return {
          batchId: result.batch.id,
          successCount,
          failedCount,
        };
      } catch (error) {
        console.error("Batch upload failed:", error);
        toast.error("Batch upload failed", {
          description: error instanceof Error ? error.message : "Unknown error",
        });

        // Mark all as failed
        setQueue((prev) =>
          prev.map((f) => ({
            ...f,
            status: "failed" as const,
            error: "Batch upload failed",
          }))
        );

        setIsProcessing(false);
        return null;
      }
    },
    [queue, isProcessing, uploadBatchMutation]
  );

  /**
   * Cancel processing
   */
  const cancelProcessing = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    toast.info("Processing cancelled");
  }, []);

  /**
   * Get queue statistics
   */
  const getStatistics = useCallback(() => {
    return {
      total: queue.length,
      queued: queue.filter((f) => f.status === "queued").length,
      uploading: queue.filter((f) => f.status === "uploading").length,
      processing: queue.filter((f) => f.status === "processing").length,
      completed: queue.filter((f) => f.status === "completed").length,
      failed: queue.filter((f) => f.status === "failed").length,
    };
  }, [queue]);

  return {
    queue,
    isProcessing,
    addFiles,
    removeFile,
    clearQueue,
    clearProcessed,
    processQueue,
    cancelProcessing,
    statistics: getStatistics(),
  };
}
