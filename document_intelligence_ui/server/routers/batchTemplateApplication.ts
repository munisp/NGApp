import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { documents, ocrResults, customTemplates } from "../../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
import { DOCUMENT_TEMPLATES } from "../../shared/documentTemplates";
import { validateAgainstTemplate, type TemplateField } from "../../shared/templateValidation";

export const batchTemplateApplicationRouter = router({
  /**
   * Apply template to multiple existing documents
   */
  applyTemplateToDocuments: protectedProcedure
    .input(z.object({
      documentIds: z.array(z.number()),
      templateId: z.string(), // Can be built-in or custom-{id}
      revalidate: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const results = [];
      
      // Get template fields
      let templateFields: TemplateField[] = [];
      let templateIdNumber: number | null = null;
      
      const isCustom = input.templateId.startsWith('custom-');
      
      if (isCustom) {
        const customId = parseInt(input.templateId.replace('custom-', ''));
        const customTemplateResults = await db
          .select()
          .from(customTemplates)
          .where(eq(customTemplates.id, customId))
          .limit(1);
        
        const customTemplate = customTemplateResults.length > 0 ? customTemplateResults[0] : null;
        
        if (!customTemplate) {
          throw new Error("Custom template not found");
        }
        
        templateFields = (typeof customTemplate.fields === 'string' 
          ? JSON.parse(customTemplate.fields) 
          : customTemplate.fields) as unknown as TemplateField[];
        templateIdNumber = customId;
      } else {
        const builtInTemplate = DOCUMENT_TEMPLATES.find(t => t.id === input.templateId);
        
        if (!builtInTemplate) {
          throw new Error("Built-in template not found");
        }
        
        templateFields = builtInTemplate.fields;
        // For built-in templates, we can use a string ID or convert to a number
        // For simplicity, we'll store the template ID as-is
      }

      // Process each document
      for (const documentId of input.documentIds) {
        try {
          // Get document
          const docResults = await db
            .select()
            .from(documents)
            .where(
              and(
                eq(documents.id, documentId),
                eq(documents.userId, ctx.user.id)
              )
            )
            .limit(1);
          
          const document = docResults.length > 0 ? docResults[0] : null;

          if (!document) {
            results.push({
              documentId,
              success: false,
              error: 'Document not found or access denied',
            });
            continue;
          }

          // Get OCR result
          const ocrResultData = await db
            .select()
            .from(ocrResults)
            .where(eq(ocrResults.documentId, documentId))
            .limit(1);
          
          const ocrResult = ocrResultData.length > 0 ? ocrResultData[0] : null;

          if (!ocrResult) {
            results.push({
              documentId,
              success: false,
              error: 'No OCR result found',
            });
            continue;
          }

          // Update OCR result with template ID
          await db.update(ocrResults)
            .set({
              templateId: templateIdNumber,
            })
            .where(eq(ocrResults.id, ocrResult.id));

          // Validate if requested
          if (input.revalidate && ocrResult.extractedData) {
            const extractedData = JSON.parse(ocrResult.extractedData);
            const validationResult = validateAgainstTemplate(extractedData, templateFields);

            await db.update(ocrResults)
              .set({
                validationStatus: validationResult.status,
                validationErrors: JSON.stringify(validationResult.errors),
                validatedAt: new Date(),
              })
              .where(eq(ocrResults.id, ocrResult.id));

            results.push({
              documentId,
              success: true,
              validation: validationResult,
            });
          } else {
            results.push({
              documentId,
              success: true,
            });
          }
        } catch (error) {
          results.push({
            documentId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return {
        total: input.documentIds.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
      };
    }),

  /**
   * Get documents eligible for template application
   */
  getEligibleDocuments: protectedProcedure
    .input(z.object({
      category: z.string().optional(),
      status: z.enum(["pending", "processing", "completed", "failed"]).optional(),
      withoutTemplate: z.boolean().default(false),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Build query
      const conditions = [eq(documents.userId, ctx.user.id)];

      if (input.category) {
        conditions.push(eq(documents.category, input.category as any));
      }

      if (input.status) {
        conditions.push(eq(documents.status, input.status));
      }

      const docs = await db.select({
        id: documents.id,
        filename: documents.filename,
        category: documents.category,
        status: documents.status,
        createdAt: documents.createdAt,
        ocrResultId: ocrResults.id,
        templateId: ocrResults.templateId,
        validationStatus: ocrResults.validationStatus,
      })
      .from(documents)
      .leftJoin(ocrResults, eq(documents.id, ocrResults.documentId))
      .where(and(...conditions));

      // Filter by template status if requested
      if (input.withoutTemplate) {
        return docs.filter(d => !d.templateId);
      }

      return docs;
    }),

  /**
   * Get batch application statistics
   */
  getBatchStats: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const allDocs = await db.select({
        id: documents.id,
        templateId: ocrResults.templateId,
        validationStatus: ocrResults.validationStatus,
      })
      .from(documents)
      .leftJoin(ocrResults, eq(documents.id, ocrResults.documentId))
      .where(eq(documents.userId, ctx.user.id));

      return {
        total: allDocs.length,
        withTemplate: allDocs.filter(d => d.templateId).length,
        withoutTemplate: allDocs.filter(d => !d.templateId).length,
        validated: allDocs.filter(d => d.validationStatus !== 'not_validated' && d.validationStatus !== null).length,
        valid: allDocs.filter(d => d.validationStatus === 'valid').length,
        invalid: allDocs.filter(d => d.validationStatus === 'invalid').length,
        partial: allDocs.filter(d => d.validationStatus === 'partial').length,
      };
    }),
});
