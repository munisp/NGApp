/**
 * firmwareUpload.ts — Multipart firmware file upload endpoint
 *
 * POST /api/ota/upload
 *   - Accepts: multipart/form-data with field "firmware" (binary)
 *   - Auth: session cookie (protectedProcedure equivalent — checks JWT)
 *   - Returns: { key, url, filename, size, contentType }
 *
 * The returned `url` is a permanent S3 CDN URL ready to be stored in
 * firmware_versions.download_url via the addFirmwareVersion tRPC procedure.
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import { storagePut } from "./storage";
import { sdk } from "./_core/sdk";

const router = Router();

// ── Multer: memory storage, 64 MB limit ───────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 64 * 1024 * 1024, // 64 MB max firmware image
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    // Accept common firmware binary types
    const allowed = [
      "application/octet-stream",
      "application/x-binary",
      "application/firmware",
      "application/zip",
      "application/x-zip-compressed",
    ];
    const allowedExts = [".bin", ".hex", ".elf", ".img", ".zip", ".tar.gz", ".fw"];
    const ext = "." + file.originalname.split(".").pop()?.toLowerCase();
    if (allowed.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported firmware file type: ${file.mimetype} (${ext})`));
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
    if (!token) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const session = await sdk.verifySession(token);
    if (!session) {
      res.status(401).json({ error: "Invalid or expired session" });
      return;
    }
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session" });
  }
}

// ── POST /api/ota/upload ───────────────────────────────────────────────────────
router.post(
  "/api/ota/upload",
  requireAuth,
  upload.single("firmware"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No firmware file provided. Use field name 'firmware'." });
        return;
      }

      const { originalname, buffer, mimetype, size } = req.file;

      // Build a unique S3 key: firmware/{timestamp}-{sanitized-name}
      const timestamp = Date.now();
      const sanitized = originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      const s3Key = `firmware/${timestamp}-${sanitized}`;

      const { key, url } = await storagePut(s3Key, buffer, mimetype || "application/octet-stream");

      res.json({
        key,
        url,
        filename: originalname,
        size,
        contentType: mimetype,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed";
      console.error("[FirmwareUpload] Error:", message);
      res.status(500).json({ error: message });
    }
  }
);

export { router as firmwareUploadRouter };
