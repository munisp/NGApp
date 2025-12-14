import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { customTemplates } from "../../drizzle/schema";
import { eq, and, or, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// Field definition schema
const fieldSchema = z.object({
  name: z.string(),
  label: z.string(),
  type: z.enum(["text", "number", "date", "currency", "email", "phone", "address", "boolean"]),
  required: z.boolean().default(false),
  validation: z
    .object({
      pattern: z.string().optional(),
      minLength: z.number().optional(),
      maxLength: z.number().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
    })
    .optional(),
  extractionHints: z.array(z.string()).optional(),
});

// OCR settings schema
const ocrSettingsSchema = z.object({
  strategy: z.enum(["weighted_average", "highest_confidence", "majority_vote"]),
  confidenceThreshold: z.number().min(0).max(100),
});

export const customTemplatesRouter = router({
  /**
   * List all custom templates (user's own + public templates)
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const templates = await db
      .select()
      .from(customTemplates)
      .where(
        or(
          eq(customTemplates.userId, ctx.user.id),
          eq(customTemplates.isPublic, 1)
        )
      )
      .orderBy(desc(customTemplates.createdAt));

    return templates.map((template) => ({
      ...template,
      fields: JSON.parse(template.fields),
      ocrSettings: JSON.parse(template.ocrSettings),
      isOwner: template.userId === ctx.user.id,
    }));
  }),

  /**
   * Get a single custom template by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result = await db
        .select()
        .from(customTemplates)
        .where(
          and(
            eq(customTemplates.id, input.id),
            or(
              eq(customTemplates.userId, ctx.user.id),
              eq(customTemplates.isPublic, 1)
            )
          )
        )
        .limit(1);

      if (result.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found",
        });
      }

      const template = result[0];
      return {
        ...template,
        fields: JSON.parse(template.fields),
        ocrSettings: JSON.parse(template.ocrSettings),
        isOwner: template.userId === ctx.user.id,
      };
    }),

  /**
   * Create a new custom template
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        icon: z.string().max(10).optional(),
        category: z.string().min(1).max(100),
        fields: z.array(fieldSchema).min(1),
        ocrSettings: ocrSettingsSchema,
        isPublic: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [inserted] = await db.insert(customTemplates).values({
        userId: ctx.user.id,
        name: input.name,
        description: input.description || null,
        icon: input.icon || "📄",
        category: input.category,
        fields: JSON.stringify(input.fields),
        ocrSettings: JSON.stringify(input.ocrSettings),
        isPublic: input.isPublic ? 1 : 0,
        isActive: 1,
        useCount: 0,
      }).returning({ id: customTemplates.id });

      return {
        id: inserted?.id ?? 0,
        message: "Custom template created successfully",
      };
    }),

  /**
   * Update a custom template
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        icon: z.string().max(10).optional(),
        category: z.string().min(1).max(100).optional(),
        fields: z.array(fieldSchema).min(1).optional(),
        ocrSettings: ocrSettingsSchema.optional(),
        isPublic: z.boolean().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const existing = await db
        .select()
        .from(customTemplates)
        .where(
          and(
            eq(customTemplates.id, input.id),
            eq(customTemplates.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found or you don't have permission to edit it",
        });
      }

      const updateData: any = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.icon !== undefined) updateData.icon = input.icon;
      if (input.category !== undefined) updateData.category = input.category;
      if (input.fields !== undefined) updateData.fields = JSON.stringify(input.fields);
      if (input.ocrSettings !== undefined) updateData.ocrSettings = JSON.stringify(input.ocrSettings);
      if (input.isPublic !== undefined) updateData.isPublic = input.isPublic ? 1 : 0;
      if (input.isActive !== undefined) updateData.isActive = input.isActive ? 1 : 0;

      await db
        .update(customTemplates)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(customTemplates.id, input.id));

      return { success: true, message: "Template updated successfully" };
    }),

  /**
   * Delete a custom template
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const existing = await db
        .select()
        .from(customTemplates)
        .where(
          and(
            eq(customTemplates.id, input.id),
            eq(customTemplates.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found or you don't have permission to delete it",
        });
      }

      await db.delete(customTemplates).where(eq(customTemplates.id, input.id));

      return { success: true, message: "Template deleted successfully" };
    }),

  /**
   * Duplicate a template (create a copy)
   */
  duplicate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get the template to duplicate
      const result = await db
        .select()
        .from(customTemplates)
        .where(
          and(
            eq(customTemplates.id, input.id),
            or(
              eq(customTemplates.userId, ctx.user.id),
              eq(customTemplates.isPublic, 1)
            )
          )
        )
        .limit(1);

      if (result.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found",
        });
      }

      const original = result[0];

      // Create a copy
      const [duplicated] = await db.insert(customTemplates).values({
        userId: ctx.user.id,
        name: `${original.name} (Copy)`,
        description: original.description,
        icon: original.icon,
        category: original.category,
        fields: original.fields,
        ocrSettings: original.ocrSettings,
        isPublic: 0, // Always create as private
        isActive: 1,
        useCount: 0,
      }).returning({ id: customTemplates.id });

      return {
        id: duplicated?.id ?? 0,
        message: "Template duplicated successfully",
      };
    }),

  /**
   * Export template as JSON
   */
  exportTemplate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result = await db
        .select()
        .from(customTemplates)
        .where(
          and(
            eq(customTemplates.id, input.id),
            or(
              eq(customTemplates.userId, ctx.user.id),
              eq(customTemplates.isPublic, 1)
            )
          )
        )
        .limit(1);

      if (result.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found",
        });
      }

      const template = result[0];

      // Return template data without internal IDs
      return {
        name: template.name,
        description: template.description,
        icon: template.icon,
        category: template.category,
        fields: JSON.parse(template.fields),
        ocrSettings: JSON.parse(template.ocrSettings),
        exportedAt: new Date().toISOString(),
        version: "1.0",
      };
    }),

  /**
   * Import template from JSON
   */
  importTemplate: protectedProcedure
    .input(
      z.object({
        templateData: z.object({
          name: z.string(),
          description: z.string().optional().nullable(),
          icon: z.string().optional(),
          category: z.string(),
          fields: z.array(fieldSchema),
          ocrSettings: ocrSettingsSchema,
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { templateData } = input;

      const [imported] = await db.insert(customTemplates).values({
        userId: ctx.user.id,
        name: templateData.name,
        description: templateData.description || null,
        icon: templateData.icon || "📄",
        category: templateData.category,
        fields: JSON.stringify(templateData.fields),
        ocrSettings: JSON.stringify(templateData.ocrSettings),
        isPublic: 0, // Always import as private
        isActive: 1,
        useCount: 0,
      }).returning({ id: customTemplates.id });

      return {
        id: imported?.id ?? 0,
        message: "Template imported successfully",
      };
    }),

  /**
   * Increment use count when template is used
   */
  incrementUseCount: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get current use count first
      const currentTemplate = await db
        .select()
        .from(customTemplates)
        .where(eq(customTemplates.id, input.id))
        .limit(1);

      if (currentTemplate.length === 0) {
        throw new Error("Template not found");
      }

      await db
        .update(customTemplates)
        .set({
          useCount: currentTemplate[0].useCount + 1,
          lastUsedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(customTemplates.id, input.id));

      return { success: true };
    }),
});
