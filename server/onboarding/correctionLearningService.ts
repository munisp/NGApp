/**
 * OCR Correction Learning Service
 * Analyzes feedback data to identify common errors and generate correction patterns
 */

import { getDb } from "../db";
import { ocrFeedback, ocrCorrectionPatterns } from "../../drizzle/schema";
import { sql, eq, and, desc } from "drizzle-orm";

interface FeedbackPattern {
  fieldName: string;
  incorrectValue: string;
  correctValue: string;
  count: number;
}

/**
 * Analyze feedback to find common error patterns
 */
export async function analyzeCommonErrors(minOccurrences: number = 3): Promise<FeedbackPattern[]> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Group feedback by field name and incorrect/correct value pairs
  const patterns = await db
    .select({
      fieldName: ocrFeedback.fieldName,
      incorrectValue: ocrFeedback.incorrectValue,
      correctValue: ocrFeedback.correctValue,
      count: sql<number>`count(*)`,
    })
    .from(ocrFeedback)
    .where(sql`${ocrFeedback.incorrectValue} IS NOT NULL`)
    .groupBy(
      ocrFeedback.fieldName,
      ocrFeedback.incorrectValue,
      ocrFeedback.correctValue
    )
    .having(sql`count(*) >= ${minOccurrences}`)
    .orderBy(desc(sql`count(*)`));

  return patterns.map(p => ({
    fieldName: p.fieldName,
    incorrectValue: p.incorrectValue || "",
    correctValue: p.correctValue,
    count: p.count,
  }));
}

/**
 * Calculate confidence score for a pattern based on frequency
 */
function calculateConfidence(occurrences: number): number {
  // Simple confidence calculation: more occurrences = higher confidence
  // Cap at 100
  return Math.min(100, Math.floor((occurrences / 10) * 100));
}

/**
 * Determine pattern type based on the error characteristics
 */
function determinePatternType(incorrect: string, correct: string): "exact" | "regex" | "fuzzy" {
  // For now, use exact matching
  // Future: implement regex detection for patterns like "0" vs "O", "1" vs "l"
  return "exact";
}

/**
 * Generate correction patterns from feedback data
 */
export async function generateCorrectionPatterns(minOccurrences: number = 3): Promise<number> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const patterns = await analyzeCommonErrors(minOccurrences);
  let createdCount = 0;

  for (const pattern of patterns) {
    // Check if pattern already exists
    const existing = await db
      .select()
      .from(ocrCorrectionPatterns)
      .where(
        and(
          eq(ocrCorrectionPatterns.fieldName, pattern.fieldName),
          eq(ocrCorrectionPatterns.incorrectPattern, pattern.incorrectValue),
          eq(ocrCorrectionPatterns.correctPattern, pattern.correctValue)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing pattern
      await db
        .update(ocrCorrectionPatterns)
        .set({
          feedbackCount: pattern.count,
          confidence: calculateConfidence(pattern.count),
          updatedAt: new Date(),
        })
        .where(eq(ocrCorrectionPatterns.id, existing[0].id));
    } else {
      // Create new pattern
      await db.insert(ocrCorrectionPatterns).values({
        fieldName: pattern.fieldName,
        incorrectPattern: pattern.incorrectValue,
        correctPattern: pattern.correctValue,
        patternType: determinePatternType(pattern.incorrectValue, pattern.correctValue),
        confidence: calculateConfidence(pattern.count),
        feedbackCount: pattern.count,
        status: pattern.count >= 5 ? "active" : "pending", // Auto-activate if 5+ occurrences
        createdBy: null, // Auto-generated
      });
      createdCount++;
    }
  }

  console.log(`[CorrectionLearning] Generated ${createdCount} new patterns from ${patterns.length} total patterns`);
  return createdCount;
}

/**
 * Merge similar patterns to avoid duplication
 */
export async function mergeSimilarPatterns(): Promise<number> {
  // Future enhancement: use fuzzy matching to merge similar patterns
  // For now, exact matching is sufficient
  return 0;
}

/**
 * Get pattern statistics
 */
export async function getPatternStats() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const totalPatterns = await db
    .select({ count: sql<number>`count(*)` })
    .from(ocrCorrectionPatterns)
    .then(rows => rows[0]?.count || 0);

  const activePatterns = await db
    .select({ count: sql<number>`count(*)` })
    .from(ocrCorrectionPatterns)
    .where(eq(ocrCorrectionPatterns.status, "active"))
    .then(rows => rows[0]?.count || 0);

  const pendingPatterns = await db
    .select({ count: sql<number>`count(*)` })
    .from(ocrCorrectionPatterns)
    .where(eq(ocrCorrectionPatterns.status, "pending"))
    .then(rows => rows[0]?.count || 0);

  const totalCorrections = await db
    .select({ count: sql<number>`sum(success_count)` })
    .from(ocrCorrectionPatterns)
    .then(rows => rows[0]?.count || 0);

  const avgConfidence = await db
    .select({ avg: sql<number>`avg(confidence)` })
    .from(ocrCorrectionPatterns)
    .where(eq(ocrCorrectionPatterns.status, "active"))
    .then(rows => rows[0]?.avg || 0);

  return {
    totalPatterns,
    activePatterns,
    pendingPatterns,
    totalCorrections,
    avgConfidence: Math.round(avgConfidence),
  };
}
