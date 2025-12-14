import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { documents, ocrResults } from "../../drizzle/schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";

export const exportRouter = router({
  /**
   * Export documents to CSV/Excel format
   * Returns data that can be converted to CSV/Excel on the frontend
   */
  exportDocuments: protectedProcedure
    .input(
      z.object({
        documentIds: z.array(z.number()).optional(),
        category: z.string().optional(),
        status: z.enum(["pending", "processing", "completed", "failed"]).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        includeOcrResults: z.boolean().default(true),
        fields: z.array(z.string()).optional(), // Specific fields to export
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      try {
        // Build query conditions
        const conditions = [eq(documents.userId, ctx.user.id)];

        if (input.documentIds && input.documentIds.length > 0) {
          conditions.push(inArray(documents.id, input.documentIds));
        }

        if (input.category) {
          // Category is an enum, cast input to match
          conditions.push(eq(documents.category, input.category as any));
        }

        if (input.status) {
          conditions.push(eq(documents.status, input.status));
        }

        if (input.startDate) {
          conditions.push(gte(documents.createdAt, new Date(input.startDate)));
        }

        if (input.endDate) {
          conditions.push(lte(documents.createdAt, new Date(input.endDate)));
        }

        // Fetch documents
        const docs = await db
          .select()
          .from(documents)
          .where(and(...conditions))
          .orderBy(documents.createdAt);

        // Fetch OCR results if requested
        let ocrResultsMap: Record<number, any> = {};
        if (input.includeOcrResults && docs.length > 0) {
          const docIds = docs.map((d) => d.id);
          const results = await db
            .select()
            .from(ocrResults)
            .where(inArray(ocrResults.documentId, docIds));

          ocrResultsMap = results.reduce((acc, result) => {
            acc[result.documentId] = result;
            return acc;
          }, {} as Record<number, any>);
        }

        // Format data for export
        const exportData = docs.map((doc) => {
          const ocrResult = ocrResultsMap[doc.id];

          // Base document data
          const baseData: Record<string, any> = {
            id: doc.id,
            filename: doc.filename,
            category: doc.category,
            status: doc.status,
            uploaded_at: doc.createdAt.toISOString(),
            file_size: doc.fileSize,
            mime_type: doc.mimeType,
          };

          // Add OCR results if available
          if (ocrResult) {
            baseData.ocr_confidence = ocrResult.confidence;
            baseData.ocr_engine = ocrResult.selectedEngine;
            baseData.ocr_processing_time_ms = ocrResult.processingTime;
            baseData.ocr_text = ocrResult.extractedText;

            // Add extracted fields
            if (ocrResult.extractedData) {
              const fields = typeof ocrResult.extractedData === 'string'
                ? JSON.parse(ocrResult.extractedData)
                : ocrResult.extractedData;

              Object.entries(fields).forEach(([key, value]) => {
                baseData[`field_${key}`] = value;
              });
            }
          }

          // Filter fields if specified
          if (input.fields && input.fields.length > 0) {
            const filteredData: Record<string, any> = {};
            input.fields.forEach((field) => {
              if (baseData[field] !== undefined) {
                filteredData[field] = baseData[field];
              }
            });
            return filteredData;
          }

          return baseData;
        });

        return {
          success: true,
          data: exportData,
          count: exportData.length,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.error("Export failed:", error);
        throw new Error(`Export failed: ${error}`);
      }
    }),

  /**
   * Get available export fields for a given category
   */
  getExportFields: protectedProcedure
    .input(
      z.object({
        category: z.string().optional(),
        includeOcrFields: z.boolean().default(true),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Base document fields
      const baseFields = [
        { name: "id", label: "Document ID", type: "number" },
        { name: "filename", label: "Filename", type: "string" },
        { name: "category", label: "Category", type: "string" },
        { name: "status", label: "Status", type: "string" },
        { name: "uploaded_at", label: "Upload Date", type: "date" },
        { name: "file_size", label: "File Size (bytes)", type: "number" },
        { name: "mime_type", label: "MIME Type", type: "string" },
      ];

      if (!input.includeOcrFields) {
        return { fields: baseFields };
      }

      // OCR result fields
      const ocrFields = [
        { name: "ocr_confidence", label: "OCR Confidence", type: "number" },
        { name: "ocr_engine", label: "OCR Engine", type: "string" },
        { name: "ocr_processing_time_ms", label: "Processing Time (ms)", type: "number" },
        { name: "ocr_text", label: "Extracted Text", type: "text" },
      ];

      // Get sample OCR result to extract dynamic fields
      try {
        const conditions = [eq(documents.userId, ctx.user.id)];
        if (input.category) {
          // Category is an enum, cast input to match
          conditions.push(eq(documents.category, input.category as any));
        }

        const sampleDoc = await db
          .select()
          .from(documents)
          .where(and(...conditions))
          .limit(1);

        if (sampleDoc.length > 0) {
          const sampleOcr = await db
            .select()
            .from(ocrResults)
            .where(eq(ocrResults.documentId, sampleDoc[0].id))
            .limit(1);

          if (sampleOcr.length > 0 && sampleOcr[0].extractedData) {
            const fields = typeof sampleOcr[0].extractedData === 'string'
              ? JSON.parse(sampleOcr[0].extractedData)
              : sampleOcr[0].extractedData;

            const dynamicFields = Object.keys(fields).map((key) => ({
              name: `field_${key}`,
              label: key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
              type: "string",
            }));

            return {
              fields: [...baseFields, ...ocrFields, ...dynamicFields],
            };
          }
        }
      } catch (error) {
        console.error("Failed to get dynamic fields:", error);
      }

      return {
        fields: [...baseFields, ...ocrFields],
      };
    }),

  /**
   * Export batch processing results
   */
  exportBatches: protectedProcedure
    .input(
      z.object({
        batchIds: z.array(z.number()).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      try {
        const { batches } = await import("../../drizzle/schema");

        // Build query conditions
        const conditions = [eq(batches.userId, ctx.user.id)];

        if (input.batchIds && input.batchIds.length > 0) {
          conditions.push(inArray(batches.id, input.batchIds));
        }

        if (input.startDate) {
          conditions.push(gte(batches.createdAt, new Date(input.startDate)));
        }

        if (input.endDate) {
          conditions.push(lte(batches.createdAt, new Date(input.endDate)));
        }

        // Fetch batches
        const batchData = await db
          .select()
          .from(batches)
          .where(and(...conditions))
          .orderBy(batches.createdAt);

        // Format data for export
        const exportData = batchData.map((batch) => ({
          id: batch.id,
          name: batch.name,
          status: batch.status,
          total_files: batch.totalFiles,
          completed_files: batch.completedFiles,
          failed_files: batch.failedFiles,
          progress: Math.round((batch.completedFiles / batch.totalFiles) * 100),
          created_at: batch.createdAt.toISOString(),
          updated_at: batch.updatedAt.toISOString(),
        }));

        return {
          success: true,
          data: exportData,
          count: exportData.length,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.error("Batch export failed:", error);
        throw new Error(`Batch export failed: ${error}`);
      }
    }),
});
