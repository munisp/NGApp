/**
 * damageImageUpload.ts — Satellite / drone image upload for War Damage Assessment
 *
 * POST /api/damage/upload-image
 *   - Accepts: multipart/form-data with field "image" (JPEG/PNG/TIFF/WebP, max 20MB)
 *   - Body fields: assessmentId (number), lat?, lng?, capturedAt?, context?
 *   - Auth: session cookie
 *   - Returns: { id, s3Url, aiSeverity, aiConfidence, aiSummary, aiAssetType, ocrText, vlmModel }
 *
 * Pipeline:
 *   1. Upload image to S3 → get permanent CDN URL
 *   2. POST to ML service /analyze-image (PaddleOCR + Ollama LLaVA VLM)
 *   3. Save result to damage_images table
 *
 * Falls back to a "manual review required" classification if the ML service is offline.
 */
import { Router, Request, Response } from "express";
import multer from "multer";
import { storagePut } from "./storage";
import { sdk } from "./_core/sdk";
import { getPool } from "./db";

const router = Router();

// ── ML Service config ─────────────────────────────────────────────────────────
const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://localhost:4003";

// ── Multer: memory storage, 20 MB limit ───────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/tiff", "image/gif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported image type: ${file.mimetype}. Accepted: JPEG, PNG, WebP, TIFF`));
    }
  },
});

// ── Auth middleware ────────────────────────────────────────────────────────────
async function requireAuth(req: Request, res: Response, next: () => void) {
  try {
    const cookieHeader = req.headers.cookie ?? "";
    const cookies: Record<string, string> = {};
    cookieHeader.split(";").forEach(part => {
      const [k, ...v] = part.trim().split("=");
      if (k) cookies[k.trim()] = v.join("=");
    });
    const token = cookies["session"];
    if (!token) { res.status(401).json({ error: "Authentication required" }); return; }
    const session = await sdk.verifySession(token);
    if (!session) { res.status(401).json({ error: "Invalid session" }); return; }
    (req as Request & { sessionUser: typeof session }).sessionUser = session;
    next();
  } catch {
    res.status(401).json({ error: "Authentication failed" });
  }
}

// ── ML Service VLM+OCR classification ────────────────────────────────────────
interface MLAnalysisResult {
  severity: string;
  confidence: number;
  asset_type: string;
  summary: string;
  ocr_text: string;
  vlm_model: string;
}

async function analyzeImageWithMLService(
  imageUrl: string,
  assessmentId: number,
  lat: number | null,
  lng: number | null,
  context: string
): Promise<MLAnalysisResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000); // 2 min timeout for VLM
    const response = await fetch(`${ML_SERVICE_URL}/analyze-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: imageUrl,
        assessment_id: assessmentId,
        lat,
        lng,
        context: context || undefined,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) {
      throw new Error(`ML service returned ${response.status}: ${await response.text()}`);
    }
    return await response.json() as MLAnalysisResult;
  } catch (err) {
    console.warn("[DamageImageUpload] ML service unavailable, using fallback:", err);
    return {
      severity: "UNKNOWN",
      confidence: 0.0,
      asset_type: "UNKNOWN",
      summary: "Automatic classification unavailable (ML service offline). Manual review required.",
      ocr_text: "",
      vlm_model: "fallback/offline",
    };
  }
}

// ── Upload endpoint ────────────────────────────────────────────────────────────
router.post(
  "/upload-image",
  requireAuth as unknown as Parameters<typeof router.post>[1],
  upload.single("image"),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "No image file provided" });
        return;
      }

      const assessmentId = parseInt(req.body.assessmentId ?? "0", 10);
      if (!assessmentId) {
        res.status(400).json({ error: "assessmentId is required" });
        return;
      }

      const lat = req.body.lat ? parseFloat(req.body.lat) : null;
      const lng = req.body.lng ? parseFloat(req.body.lng) : null;
      const capturedAt = req.body.capturedAt ? new Date(req.body.capturedAt) : null;
      const context = req.body.context ?? "";
      const user = (req as Request & { sessionUser?: { name?: string; openId?: string } }).sessionUser;

      // ── Step 1: Upload to S3 ────────────────────────────────────────────────
      const suffix = Date.now().toString(36);
      const ext = file.originalname.split(".").pop()?.toLowerCase() ?? "jpg";
      const s3Key = `damage-images/${assessmentId}/${suffix}.${ext}`;
      const { url: s3Url } = await storagePut(s3Key, file.buffer, file.mimetype);

      // ── Step 2: ML Service VLM + PaddleOCR analysis ─────────────────────────
      const classification = await analyzeImageWithMLService(s3Url, assessmentId, lat, lng, context);

      // ── Step 3: Save to DB ──────────────────────────────────────────────────
      const pool = await getPool();
      if (!pool) throw new Error("Database unavailable");

      const result = await pool.query(
        `INSERT INTO damage_images
          (assessment_id, s3_key, s3_url, filename, mime_type, file_size_bytes,
           lat, lng, captured_at, ai_severity, ai_confidence, ai_summary, ai_asset_type, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING *`,
        [
          assessmentId, s3Key, s3Url, file.originalname, file.mimetype, file.size,
          lat, lng, capturedAt,
          classification.severity, classification.confidence,
          classification.summary, classification.asset_type,
          user?.name ?? user?.openId ?? "unknown",
        ]
      );

      // ── Step 4: Update assessment's damage classification if VLM is confident ─
      if (classification.confidence >= 0.6 && classification.severity !== "UNKNOWN") {
        await pool.query(
          `UPDATE damage_assessments
           SET damage_classification = $1, updated_at = NOW()
           WHERE id = $2 AND damage_classification = 'UNKNOWN'`,
          [classification.severity, assessmentId]
        ).catch(() => { /* non-critical */ });
      }

      res.json({
        success: true,
        image: result.rows[0],
        aiSeverity: classification.severity,
        aiConfidence: classification.confidence,
        aiAssetType: classification.asset_type,
        aiSummary: classification.summary,
        ocrText: classification.ocr_text,
        vlmModel: classification.vlm_model,
      });
    } catch (err) {
      console.error("[DamageImageUpload] Error:", err);
      res.status(500).json({ error: "Upload failed", detail: String(err) });
    }
  }
);

// ── List images for an assessment ─────────────────────────────────────────────
router.get(
  "/images/:assessmentId",
  requireAuth as unknown as Parameters<typeof router.get>[1],
  async (req: Request, res: Response) => {
    try {
      const pool = await getPool();
      if (!pool) { res.status(503).json({ error: "Database unavailable" }); return; }
      const result = await pool.query(
        "SELECT * FROM damage_images WHERE assessment_id = $1 ORDER BY created_at DESC",
        [parseInt(req.params.assessmentId, 10)]
      );
      res.json({ images: result.rows });
    } catch (err) {
      res.status(500).json({ error: "Failed to list images", detail: String(err) });
    }
  }
);

export { router as damageImageUploadRouter };
export default router;
