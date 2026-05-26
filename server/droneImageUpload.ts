/**
 * Drone Inspection Image Upload Router
 * Handles multipart/form-data uploads for drone inspection photos/videos
 * Stores in S3 and returns CDN URLs for database persistence
 */
import express from "express";
import multer from "multer";
import { storagePut } from "./storage";
import { getDb } from "./db";
import { droneInspections } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const router = express.Router();

// 50MB limit for drone images/videos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "application/pdf"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed. Supported: JPEG, PNG, WebP, MP4, MOV, PDF`));
    }
  },
});

/**
 * POST /api/drone/upload
 * Upload drone inspection media (images, videos, reports)
 * Body: multipart/form-data with fields:
 *   - file: the media file (required)
 *   - inspectionId: drone inspection DB ID (optional, to link to existing inspection)
 *   - assetId: asset ID (optional)
 *   - mediaType: "photo" | "video" | "thermal" | "report" (optional, default: "photo")
 */
router.post("/api/drone/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const { inspectionId, assetId, mediaType = "photo" } = req.body as {
      inspectionId?: string;
      assetId?: string;
      mediaType?: string;
    };

    const timestamp = Date.now();
    const ext = req.file.originalname.split(".").pop() ?? "bin";
    const safeFilename = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `drone-inspections/${assetId ?? "unknown"}/${timestamp}-${safeFilename}`;

    const { url } = await storagePut(key, req.file.buffer, req.file.mimetype);

    // If an inspectionId is provided, update the inspection record with the media URL
    if (inspectionId) {
      const db = await getDb();
      if (db) {
        const id = parseInt(inspectionId, 10);
        if (!isNaN(id)) {
          // Fetch current inspection to append to media array
          const [inspection] = await db.select()
            .from(droneInspections)
            .where(eq(droneInspections.id, id));

          if (inspection) {
            // Parse existing media URLs and append new one
            let mediaUrls: string[] = [];
            try {
              mediaUrls = inspection.mediaUrls ? JSON.parse(inspection.mediaUrls) : [];
            } catch {
              mediaUrls = [];
            }
            mediaUrls.push(url);

            await db.update(droneInspections)
              .set({
                mediaUrls: JSON.stringify(mediaUrls),
                updatedAt: new Date(),
              })
              .where(eq(droneInspections.id, id));
          }
        }
      }
    }

    res.json({
      success: true,
      url,
      key,
      filename: safeFilename,
      mediaType,
      size: req.file.size,
      mimeType: req.file.mimetype,
      inspectionId: inspectionId ?? null,
    });
  } catch (err) {
    console.error("[DroneUpload] Error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Upload failed" });
  }
});

/**
 * POST /api/drone/upload-multiple
 * Upload multiple drone inspection media files at once (max 10)
 */
router.post("/api/drone/upload-multiple", upload.array("files", 10), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files provided" });
    }

    const { inspectionId, assetId } = req.body as { inspectionId?: string; assetId?: string };
    const timestamp = Date.now();
    const results: Array<{ url: string; filename: string; size: number; mimeType: string }> = [];

    for (const file of files) {
      const safeFilename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `drone-inspections/${assetId ?? "unknown"}/${timestamp}-${safeFilename}`;
      const { url } = await storagePut(key, file.buffer, file.mimetype);
      results.push({ url, filename: safeFilename, size: file.size, mimeType: file.mimetype });
    }

    // Update inspection record if provided
    if (inspectionId) {
      const db = await getDb();
      if (db) {
        const id = parseInt(inspectionId, 10);
        if (!isNaN(id)) {
          const [inspection] = await db.select()
            .from(droneInspections)
            .where(eq(droneInspections.id, id));

          if (inspection) {
            let mediaUrls: string[] = [];
            try {
              mediaUrls = inspection.mediaUrls ? JSON.parse(inspection.mediaUrls) : [];
            } catch {
              mediaUrls = [];
            }
            mediaUrls.push(...results.map(r => r.url));

            await db.update(droneInspections)
              .set({ mediaUrls: JSON.stringify(mediaUrls), updatedAt: new Date() })
              .where(eq(droneInspections.id, id));
          }
        }
      }
    }

    res.json({ success: true, uploaded: results.length, files: results, inspectionId: inspectionId ?? null });
  } catch (err) {
    console.error("[DroneUpload] Batch error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Batch upload failed" });
  }
});

export { router as droneImageUploadRouter };
