/**
 * KYC Client — HTTP proxy helpers for KYC/KYB microservices
 *
 * Services proxied:
 *  1. Biometric Verification Orchestrator  (BIOMETRIC_SERVICE_URL, default: http://localhost:8046)
 *  2. Liveness Detection Service           (LIVENESS_SERVICE_URL, default: http://localhost:8104)
 *  3. Face Matching Service                (FACE_MATCHING_SERVICE_URL, default: http://localhost:8105)
 *  4. Deepfake Detection Service           (DEEPFAKE_SERVICE_URL, default: http://localhost:8106)
 *  5. Video-KYC liveness (legacy)          (KYC_SERVICE_URL, default: https://videokyc.54link.io)
 *  6. PaddleOCR document service           (PADDLEOCR_SERVICE_URL, default: https://ocr.54link.io)
 *  7. Compliance-KYC record store          (COMPLIANCE_KYC_URL, default: https://kyc.54link.io)
 *
 * All calls are fail-safe: if the downstream service is unavailable the
 * function returns a structured error object rather than throwing, so the
 * tRPC procedure can decide how to handle it (fail-open vs fail-closed).
 */

import { ENV } from "./env.js";

// ── Service URLs ────────────────────────────────────────────────────────────
const BIOMETRIC_SERVICE_URL   = (ENV as any).BIOMETRIC_SERVICE_URL   ?? "http://localhost:8046";
const LIVENESS_SERVICE_URL    = (ENV as any).LIVENESS_SERVICE_URL    ?? "http://localhost:8104";
const FACE_MATCHING_SERVICE_URL = (ENV as any).FACE_MATCHING_SERVICE_URL ?? "http://localhost:8105";
const DEEPFAKE_SERVICE_URL    = (ENV as any).DEEPFAKE_SERVICE_URL    ?? "http://localhost:8106";
const KYC_SERVICE_URL         = (ENV as any).KYC_SERVICE_URL         ?? "https://videokyc.54link.io";
const PADDLEOCR_URL           = (ENV as any).PADDLEOCR_SERVICE_URL   ?? "https://ocr.54link.io";
const COMPLIANCE_KYC_URL      = (ENV as any).COMPLIANCE_KYC_URL      ?? "https://kyc.54link.io";

const TIMEOUT_MS = 30_000;

/** Generic fetch wrapper with timeout */
async function kycFetch(url: string, init: RequestInit = {}, timeoutMs = TIMEOUT_MS): Promise<{ ok: boolean; status: number; data: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(timer);
    let data: unknown;
    try { data = await res.json(); } catch { data = null; }
    return { ok: res.ok, status: res.status, data };
  } catch (err: unknown) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, data: { error: msg } };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BIOMETRIC VERIFICATION (Sprint 90 — production microservices)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Full Biometric Verification ─────────────────────────────────────────────

export interface BiometricVerificationResult {
  verificationId: string;
  status: "verified" | "rejected" | "requires_review";
  overallConfidence: number;
  faceMatch: {
    match: boolean;
    similarity: number;
    confidence: number;
    source: string;
  };
  liveness: {
    result: "real" | "fake" | "uncertain";
    confidence: number;
    spoofType: string;
    source: string;
  };
  deepfake: {
    isReal: boolean;
    confidence: number;
    source: string;
  };
  quality: {
    selfie: { overallQuality: number; scores: Record<string, number>; issues: string[]; icaoCompliant: boolean };
    document: { overallQuality: number; scores: Record<string, number>; issues: string[] };
  };
  landmarks: { has68Point: boolean; count: number };
  issues: string[];
  processingTimeMs: number;
}

/** Full biometric verification: selfie vs document photo */
export async function verifyBiometric(
  selfieBase64: string,
  documentBase64: string,
  userId: string,
): Promise<BiometricVerificationResult | null> {
  const res = await kycFetch(`${BIOMETRIC_SERVICE_URL}/api/v1/biometric/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      selfie_base64: selfieBase64,
      document_base64: documentBase64,
      user_id: userId,
    }),
  }, 60_000);

  if (!res.ok) return null;
  const d = res.data as Record<string, unknown>;
  const fm = (d.face_match ?? {}) as Record<string, unknown>;
  const lv = (d.liveness ?? {}) as Record<string, unknown>;
  const df = (d.deepfake ?? {}) as Record<string, unknown>;
  const q = (d.quality ?? {}) as Record<string, unknown>;
  const lm = (d.landmarks ?? {}) as Record<string, unknown>;

  return {
    verificationId: String(d.verification_id ?? ""),
    status: (d.status as any) ?? "requires_review",
    overallConfidence: Number(d.overall_confidence ?? 0),
    faceMatch: {
      match: Boolean(fm.match),
      similarity: Number(fm.similarity ?? 0),
      confidence: Number(fm.confidence ?? 0),
      source: String(fm.source ?? "unknown"),
    },
    liveness: {
      result: (lv.result as any) ?? "uncertain",
      confidence: Number(lv.confidence ?? 0),
      spoofType: String(lv.spoof_type ?? "none"),
      source: String(lv.source ?? "unknown"),
    },
    deepfake: {
      isReal: Boolean(df.is_real ?? true),
      confidence: Number(df.confidence ?? 0),
      source: String(df.source ?? "unknown"),
    },
    quality: {
      selfie: parseQuality((q.selfie ?? {}) as Record<string, unknown>),
      document: parseQuality((q.document ?? {}) as Record<string, unknown>),
    },
    landmarks: {
      has68Point: Boolean(lm["68_point"]),
      count: Number(lm.count ?? 0),
    },
    issues: Array.isArray(d.issues) ? (d.issues as string[]) : [],
    processingTimeMs: Number(d.processing_time_ms ?? 0),
  };
}

function parseQuality(q: Record<string, unknown>) {
  return {
    overallQuality: Number(q.overall_quality ?? 0),
    scores: (q.scores ?? {}) as Record<string, number>,
    issues: Array.isArray(q.issues) ? (q.issues as string[]) : [],
    icaoCompliant: Boolean(q.icao_compliant ?? false),
  };
}

// ─── Passive Liveness ────────────────────────────────────────────────────────

export interface PassiveLivenessResult {
  isLive: boolean;
  confidence: number;
  spoofType: string;
  checks: Record<string, unknown>;
  source: string;
}

/** Passive liveness check on a single image */
export async function checkPassiveLiveness(imageBase64: string): Promise<PassiveLivenessResult | null> {
  const res = await kycFetch(`${LIVENESS_SERVICE_URL}/liveness/passive`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_base64: imageBase64 }),
  });

  if (!res.ok) return null;
  const d = res.data as Record<string, unknown>;
  return {
    isLive: Boolean(d.is_live),
    confidence: Number(d.overall_score ?? 0),
    spoofType: String(d.spoof_type ?? "none"),
    checks: (d.checks ?? {}) as Record<string, unknown>,
    source: "liveness_service",
  };
}

// ─── Active Liveness ─────────────────────────────────────────────────────────

export interface ActiveLivenessResult {
  isLive: boolean;
  confidence: number;
  motionDetected: boolean;
  blinkDetected: boolean;
  framesAnalyzed: number;
}

/** Active liveness check on multiple frames */
export async function checkActiveLiveness(
  framesBase64: string[],
  challengeType?: string,
): Promise<ActiveLivenessResult | null> {
  const res = await kycFetch(`${LIVENESS_SERVICE_URL}/liveness/active`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      frames_base64: framesBase64,
      challenge_type: challengeType,
    }),
  });

  if (!res.ok) return null;
  const d = res.data as Record<string, unknown>;
  return {
    isLive: Boolean(d.is_live),
    confidence: Number(d.overall_score ?? 0),
    motionDetected: Boolean(d.motion_detected),
    blinkDetected: Boolean(d.blink_detected),
    framesAnalyzed: Number(d.frames_analyzed ?? 0),
  };
}

// ─── Face Matching ───────────────────────────────────────────────────────────

export interface FaceMatchResult {
  match: boolean;
  similarity: number;
  confidence: number;
  model: string;
  demographics: Record<string, unknown>;
  processingTimeMs: number;
}

/** 1:1 face matching between two images */
export async function matchFaces(
  image1Base64: string,
  image2Base64: string,
): Promise<FaceMatchResult | null> {
  const res = await kycFetch(`${FACE_MATCHING_SERVICE_URL}/face/match`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image1_base64: image1Base64,
      image2_base64: image2Base64,
    }),
  });

  if (!res.ok) return null;
  const d = res.data as Record<string, unknown>;
  return {
    match: Boolean(d.match),
    similarity: Number(d.similarity ?? 0),
    confidence: Number(d.confidence ?? 0),
    model: String(d.model ?? "unknown"),
    demographics: (d.demographics ?? {}) as Record<string, unknown>,
    processingTimeMs: Number(d.processing_time_ms ?? 0),
  };
}

// ─── Face Detection ──────────────────────────────────────────────────────────

export interface DetectedFace {
  bbox: number[];
  confidence: number;
  landmarks5pt: number[][] | null;
  gender: string | null;
  age: number | null;
}

/** Detect faces in an image */
export async function detectFaces(imageBase64: string): Promise<DetectedFace[] | null> {
  const res = await kycFetch(`${FACE_MATCHING_SERVICE_URL}/face/detect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_base64: imageBase64 }),
  });

  if (!res.ok) return null;
  const d = res.data as Record<string, unknown>;
  const faces = (d.faces ?? []) as Record<string, unknown>[];
  return faces.map((f) => ({
    bbox: (f.bbox ?? []) as number[],
    confidence: Number(f.confidence ?? 0),
    landmarks5pt: (f.landmarks_5pt ?? null) as number[][] | null,
    gender: f.gender ? String(f.gender) : null,
    age: f.age ? Number(f.age) : null,
  }));
}

// ─── Deepfake Detection ──────────────────────────────────────────────────────

export interface DeepfakeResult {
  isReal: boolean;
  confidence: number;
  deepfakeProbability: number;
  deepfakeType: string;
  analysis: Record<string, unknown>;
}

/** Detect deepfakes in an image */
export async function detectDeepfake(imageBase64: string): Promise<DeepfakeResult | null> {
  const res = await kycFetch(`${DEEPFAKE_SERVICE_URL}/deepfake/detect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_base64: imageBase64 }),
  });

  if (!res.ok) return null;
  const d = res.data as Record<string, unknown>;
  return {
    isReal: Boolean(d.is_real ?? true),
    confidence: Number(d.confidence ?? 0),
    deepfakeProbability: Number(d.deepfake_probability ?? 0),
    deepfakeType: String(d.deepfake_type ?? "unknown"),
    analysis: (d.analysis ?? {}) as Record<string, unknown>,
  };
}

// ─── Face Quality Assessment ─────────────────────────────────────────────────

export interface FaceQualityResult {
  overallQuality: number;
  scores: Record<string, number>;
  issues: string[];
  icaoCompliant: boolean;
}

/** Assess face image quality (ICAO compliance) */
export async function assessFaceQuality(imageBase64: string): Promise<FaceQualityResult | null> {
  const res = await kycFetch(`${BIOMETRIC_SERVICE_URL}/api/v1/biometric/quality`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_base64: imageBase64 }),
  });

  if (!res.ok) return null;
  const d = res.data as Record<string, unknown>;
  return {
    overallQuality: Number(d.overall_quality ?? 0),
    scores: (d.scores ?? {}) as Record<string, number>,
    issues: Array.isArray(d.issues) ? (d.issues as string[]) : [],
    icaoCompliant: Boolean(d.icao_compliant ?? false),
  };
}

// ─── Anti-Spoofing Pipeline ──────────────────────────────────────────────────

export interface AntiSpoofResult {
  antiSpoofScore: number;
  isReal: boolean;
  spoofType: string;
  checks: Record<string, unknown>;
}

/** Run anti-spoofing pipeline on an image */
export async function checkAntiSpoof(imageBase64: string): Promise<AntiSpoofResult | null> {
  const res = await kycFetch(`${BIOMETRIC_SERVICE_URL}/api/v1/biometric/anti-spoof`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_base64: imageBase64 }),
  });

  if (!res.ok) return null;
  const d = res.data as Record<string, unknown>;
  return {
    antiSpoofScore: Number(d.anti_spoof_score ?? 0),
    isReal: Boolean(d.is_real ?? false),
    spoofType: String(d.spoof_type ?? "unknown"),
    checks: (d.checks ?? {}) as Record<string, unknown>,
  };
}

// ─── Service Health ──────────────────────────────────────────────────────────

export interface ServiceHealthStatus {
  name: string;
  url: string;
  status: "healthy" | "unhealthy" | "unavailable";
  version?: string;
  capabilities?: Record<string, boolean>;
  error?: string;
}

/** Check health of all biometric microservices */
export async function checkBiometricServicesHealth(): Promise<ServiceHealthStatus[]> {
  const services = [
    { name: "biometric_orchestrator", url: `${BIOMETRIC_SERVICE_URL}/health` },
    { name: "liveness_detection", url: `${LIVENESS_SERVICE_URL}/health` },
    { name: "face_matching", url: `${FACE_MATCHING_SERVICE_URL}/health` },
    { name: "deepfake_detection", url: `${DEEPFAKE_SERVICE_URL}/health` },
    { name: "video_kyc_legacy", url: `${KYC_SERVICE_URL}/health` },
    { name: "paddleocr", url: `${PADDLEOCR_URL}/health` },
    { name: "compliance_kyc", url: `${COMPLIANCE_KYC_URL}/health` },
  ];

  const results = await Promise.allSettled(
    services.map(async (s) => {
      const res = await kycFetch(s.url, {}, 5000);
      if (!res.ok) {
        return { name: s.name, url: s.url, status: "unavailable" as const, error: `HTTP ${res.status}` };
      }
      const d = res.data as Record<string, unknown>;
      return {
        name: s.name,
        url: s.url,
        status: "healthy" as const,
        version: d.version ? String(d.version) : undefined,
        capabilities: (d.capabilities ?? {}) as Record<string, boolean>,
      };
    })
  );

  return results.map((r) =>
    r.status === "fulfilled" ? r.value : { name: "unknown", url: "", status: "unavailable" as const, error: "Promise rejected" }
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEGACY KYC SERVICES (preserved for backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Liveness Detection (Legacy) ─────────────────────────────────────────────

export interface LivenessChallengeResult {
  challengeId: string;
  method: string;
  instruction: string;
  expiresAt: number;
}

export interface LivenessVerifyResult {
  challengeId: string;
  passed: boolean;
  score: number;
  method: string;
  spoofingDetected: boolean;
  spoofingType?: string;
  raw: unknown;
}

/** Ask the legacy liveness service to generate a new challenge */
export async function createLivenessChallenge(method = "active_blink"): Promise<LivenessChallengeResult | null> {
  const res = await kycFetch(`${KYC_SERVICE_URL}/create_challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method }),
  });
  if (!res.ok) return null;
  const d = res.data as Record<string, unknown>;
  return {
    challengeId: String(d.challenge_id ?? d.challengeId ?? ""),
    method: String(d.method ?? method),
    instruction: String(d.instruction ?? "Please blink twice"),
    expiresAt: Date.now() + 60_000,
  };
}

/** Submit a base64-encoded frame to verify a legacy liveness challenge */
export async function verifyLivenessChallenge(
  challengeId: string,
  frameBase64: string,
): Promise<LivenessVerifyResult | null> {
  const res = await kycFetch(`${KYC_SERVICE_URL}/respond_challenge/${challengeId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: frameBase64 }),
  });
  if (!res.ok) return null;
  const d = res.data as Record<string, unknown>;
  return {
    challengeId,
    passed: Boolean(d.passed ?? d.is_live),
    score: Number(d.score ?? d.liveness_score ?? 0),
    method: String(d.method ?? ""),
    spoofingDetected: Boolean(d.spoofing_detected ?? false),
    spoofingType: d.spoofing_type ? String(d.spoofing_type) : undefined,
    raw: res.data,
  };
}

// ─── Document OCR ────────────────────────────────────────────────────────────

export interface OcrResult {
  documentType: string;
  extractedName?: string;
  extractedDob?: string;
  extractedIdNumber?: string;
  confidence: number;
  fraudIndicators: string[];
  raw: unknown;
}

/** Submit a base64-encoded document image for OCR extraction */
export async function processDocument(
  imageBase64: string,
  documentType: "NIN" | "BVN_CARD" | "PASSPORT" | "DRIVERS_LICENCE" | "VOTER_CARD",
): Promise<OcrResult | null> {
  const res = await kycFetch(`${PADDLEOCR_URL}/process-document`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image: imageBase64,
      document_type: documentType.toLowerCase().replace("_", "-"),
    }),
  });
  if (!res.ok) return null;
  const d = res.data as Record<string, unknown>;
  const fields = (d.fields ?? d.extracted_fields ?? {}) as Record<string, string>;
  return {
    documentType,
    extractedName:     fields.name ?? fields.full_name ?? undefined,
    extractedDob:      fields.dob ?? fields.date_of_birth ?? undefined,
    extractedIdNumber: fields.id_number ?? fields.bvn ?? fields.nin ?? undefined,
    confidence:        Number(d.confidence ?? d.overall_confidence ?? 0),
    fraudIndicators:   Array.isArray(d.fraud_indicators) ? (d.fraud_indicators as string[]) : [],
    raw: res.data,
  };
}

// ─── Compliance KYC Record Storage ───────────────────────────────────────────

export interface ComplianceRecord {
  id: string;
  customerId: string;
  status: string;
}

/** Store a completed KYC session in the compliance-kyc service */
export async function storeComplianceRecord(payload: {
  customerId: string;
  fullName?: string;
  idType?: string;
  idNumber?: string;
  livenessScore?: number;
  documentConfidence?: number;
}): Promise<ComplianceRecord | null> {
  const res = await kycFetch(`${COMPLIANCE_KYC_URL}/api/v1/kyc/records`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer_id: payload.customerId,
      full_name: payload.fullName,
      id_type: payload.idType,
      id_number: payload.idNumber,
      liveness_score: payload.livenessScore,
      document_confidence: payload.documentConfidence,
      status: "pending_review",
    }),
  });
  if (!res.ok) return null;
  const d = res.data as Record<string, unknown>;
  return {
    id: String(d.id ?? ""),
    customerId: String(d.customer_id ?? payload.customerId),
    status: String(d.status ?? "pending_review"),
  };
}
