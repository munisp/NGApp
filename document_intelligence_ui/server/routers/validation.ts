import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { ocrResults, customTemplates } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { DOCUMENT_TEMPLATES } from "../../shared/documentTemplates";
import { validateAgainstTemplate, type TemplateField } from "../../shared/templateValidation";

export const validationRouter = router({
  /**
   * Validate a document against its template
   */
  validateDocument: protectedProcedure
    .input(z.object({
      documentId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get OCR result
      const results = await db
        .select()
        .from(ocrResults)
        .where(eq(ocrResults.documentId, input.documentId))
        .limit(1);
      
      const ocrResult = results.length > 0 ? results[0] : null;

      if (!ocrResult) {
        throw new Error("OCR result not found");
      }

      if (!ocrResult.templateId) {
        throw new Error("No template associated with this document");
      }

      // Get template
      let templateFields: TemplateField[] = [];
      
      // Check if it's a built-in template
      const builtInTemplate = DOCUMENT_TEMPLATES.find(t => t.id === String(ocrResult.templateId));
      
      if (builtInTemplate) {
        templateFields = builtInTemplate.fields;
      } else {
        // Check custom templates
        const customTemplateResults = await db
          .select()
          .from(customTemplates)
          .where(eq(customTemplates.id, ocrResult.templateId))
          .limit(1);
        
        const customTemplate = customTemplateResults.length > 0 ? customTemplateResults[0] : null;

        if (!customTemplate) {
          throw new Error("Template not found");
        }

        templateFields = typeof customTemplate.fields === 'string' 
          ? JSON.parse(customTemplate.fields) 
          : customTemplate.fields;
      }

      // Parse extracted data
      const extractedData = ocrResult.extractedData 
        ? JSON.parse(ocrResult.extractedData)
        : {};

      // Validate
      const validationResult = validateAgainstTemplate(extractedData, templateFields);

      // Update OCR result with validation
      await db.update(ocrResults)
        .set({
          validationStatus: validationResult.status,
          validationErrors: JSON.stringify(validationResult.errors),
          validatedAt: new Date(),
        })
        .where(eq(ocrResults.id, ocrResult.id));

      return {
        success: true,
        validation: validationResult,
      };
    }),

  /**
   * Get validation status for a document
   */
  getValidationStatus: protectedProcedure
    .input(z.object({
      documentId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const results = await db
        .select()
        .from(ocrResults)
        .where(eq(ocrResults.documentId, input.documentId))
        .limit(1);
      
      const ocrResult = results.length > 0 ? results[0] : null;

      if (!ocrResult) {
        return null;
      }

      return {
        status: ocrResult.validationStatus || 'not_validated',
        errors: ocrResult.validationErrors ? JSON.parse(ocrResult.validationErrors) : [],
        validatedAt: ocrResult.validatedAt,
        templateId: ocrResult.templateId,
      };
    }),

  /**
   * Bulk validate multiple documents
   */
  bulkValidate: protectedProcedure
    .input(z.object({
      documentIds: z.array(z.number()),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const results = [];

      for (const documentId of input.documentIds) {
        try {
          // Get OCR result
          const ocrResultsData = await db
            .select()
            .from(ocrResults)
            .where(eq(ocrResults.documentId, documentId))
            .limit(1);
          
          const ocrResult = ocrResultsData.length > 0 ? ocrResultsData[0] : null;

          if (!ocrResult || !ocrResult.templateId) {
            results.push({
              documentId,
              success: false,
              error: 'No template associated with this document',
            });
            continue;
          }

          // Get template fields
          let templateFields: TemplateField[] = [];
          const builtInTemplate = DOCUMENT_TEMPLATES.find(t => t.id === String(ocrResult.templateId));
          
          if (builtInTemplate) {
            templateFields = builtInTemplate.fields;
          } else {
            const customTemplateResults = await db
              .select()
              .from(customTemplates)
              .where(eq(customTemplates.id, ocrResult.templateId))
              .limit(1);
            
            const customTemplate = customTemplateResults.length > 0 ? customTemplateResults[0] : null;
            if (!customTemplate) {
              results.push({
                documentId,
                success: false,
                error: 'Template not found',
              });
              continue;
            }

            templateFields = typeof customTemplate.fields === 'string' 
              ? JSON.parse(customTemplate.fields) 
              : customTemplate.fields;
          }

          // Parse and validate
          const extractedData = ocrResult.extractedData 
            ? JSON.parse(ocrResult.extractedData)
            : {};
          const validationResult = validateAgainstTemplate(extractedData, templateFields);

          // Update OCR result
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
   * Get validation statistics
   */
  getValidationStats: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const allResults = await db.select().from(ocrResults);

      const stats = {
        total: allResults.length,
        validated: allResults.filter(r => r.validationStatus !== 'not_validated').length,
        valid: allResults.filter(r => r.validationStatus === 'valid').length,
        invalid: allResults.filter(r => r.validationStatus === 'invalid').length,
        partial: allResults.filter(r => r.validationStatus === 'partial').length,
        notValidated: allResults.filter(r => r.validationStatus === 'not_validated').length,
      };

      return stats;
    }),
});
