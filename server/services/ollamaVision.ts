/**
 * Ollama/Qwen Vision Service for Drone Inspection AI Defect Detection
 *
 * Uses local Ollama with Qwen2.5-VL (vision-language model) for:
 * - Analyzing drone inspection images
 * - Detecting and classifying structural defects
 * - Generating severity scores and remediation recommendations
 *
 * Falls back to the built-in Manus LLM (invokeLLM) if Ollama is unavailable.
 *
 * Environment variables:
 *   OLLAMA_BASE_URL  — Ollama server URL (default: "http://localhost:11434")
 *   OLLAMA_MODEL     — Vision model to use (default: "qwen2.5vl:7b")
 *   OLLAMA_TIMEOUT   — Request timeout in ms (default: 120000)
 */

import axios from "axios";
import { invokeLLM, type Message } from "../_core/llm";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5vl:7b";
const OLLAMA_TIMEOUT = parseInt(process.env.OLLAMA_TIMEOUT ?? "120000", 10);

export type DefectCategory =
  | "crack"
  | "corrosion"
  | "deformation"
  | "coating_failure"
  | "weld_defect"
  | "joint_failure"
  | "erosion"
  | "fouling"
  | "clean"
  | "unknown";

export type DefectSeverity = "critical" | "high" | "medium" | "low" | "none";

export interface DefectAnalysis {
  category: DefectCategory;
  severity: DefectSeverity;
  confidence: number;           // 0–1
  location: string;             // e.g., "upper-left quadrant, near flange"
  description: string;          // detailed description of the defect
  recommendations: string[];    // ordered list of remediation actions
  estimatedRepairUrgency: "immediate" | "within_7_days" | "within_30_days" | "scheduled" | "none";
  safetyRisk: boolean;
  requiresShutdown: boolean;
  model: string;                // which model was used
  processingMs: number;
}

const DEFECT_ANALYSIS_PROMPT = `You are an expert oil & gas infrastructure inspection engineer with 20+ years of experience analyzing drone inspection images of wells, pipelines, FPSO vessels, and offshore platforms.

Analyze this drone inspection image and provide a structured defect assessment. Focus on:
1. Identifying any structural defects, corrosion, cracks, deformations, or coating failures
2. Assessing the severity and safety implications
3. Providing specific remediation recommendations

Respond ONLY with valid JSON matching this exact schema:
{
  "category": "crack|corrosion|deformation|coating_failure|weld_defect|joint_failure|erosion|fouling|clean|unknown",
  "severity": "critical|high|medium|low|none",
  "confidence": 0.0-1.0,
  "location": "description of where in the image the defect is located",
  "description": "detailed technical description of what you observe",
  "recommendations": ["action 1", "action 2", "action 3"],
  "estimatedRepairUrgency": "immediate|within_7_days|within_30_days|scheduled|none",
  "safetyRisk": true|false,
  "requiresShutdown": true|false
}

Be precise and conservative — when in doubt about severity, err on the side of caution.`;

/**
 * Check if Ollama is available and the vision model is loaded.
 */
export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const res = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, { timeout: 3000 });
    const models: Array<{ name: string }> = res.data?.models ?? [];
    return models.some(m => m.name.includes("qwen") || m.name.includes("llava") || m.name.includes("vision"));
  } catch {
    return false;
  }
}

/**
 * Pull the Qwen vision model if not already available.
 */
export async function pullOllamaModel(model = OLLAMA_MODEL): Promise<void> {
  await axios.post(`${OLLAMA_BASE_URL}/api/pull`, { name: model, stream: false }, { timeout: 300_000 });
}

/**
 * Analyze a drone inspection image using Ollama/Qwen vision.
 * Falls back to the built-in Manus LLM if Ollama is unavailable.
 */
export async function analyzeDroneImage(imageUrl: string): Promise<DefectAnalysis> {
  const startMs = Date.now();

  // Try Ollama first
  const ollamaAvailable = await isOllamaAvailable();

  if (ollamaAvailable) {
    return analyzeWithOllama(imageUrl, startMs);
  }

  // Fall back to built-in Manus LLM (supports image_url content)
  return analyzeWithManusLLM(imageUrl, startMs);
}

async function analyzeWithOllama(imageUrl: string, startMs: number): Promise<DefectAnalysis> {
  // Download image as base64 for Ollama
  let imageBase64: string;
  try {
    const imgRes = await axios.get(imageUrl, { responseType: "arraybuffer", timeout: 30_000 });
    imageBase64 = Buffer.from(imgRes.data).toString("base64");
  } catch {
    throw new Error(`Failed to fetch image from URL: ${imageUrl}`);
  }

  const res = await axios.post(
    `${OLLAMA_BASE_URL}/api/generate`,
    {
      model: OLLAMA_MODEL,
      prompt: DEFECT_ANALYSIS_PROMPT,
      images: [imageBase64],
      stream: false,
      options: {
        temperature: 0.1,  // low temperature for consistent structured output
        top_p: 0.9,
        num_predict: 1024,
      },
    },
    { timeout: OLLAMA_TIMEOUT }
  );

  const rawResponse: string = res.data?.response ?? "";
  return parseDefectResponse(rawResponse, OLLAMA_MODEL, startMs);
}

async function analyzeWithManusLLM(imageUrl: string, startMs: number): Promise<DefectAnalysis> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system" as const,
        content: "You are an expert oil & gas infrastructure inspection engineer. Always respond with valid JSON only.",
      } as Message,
      {
        role: "user" as const,
        content: [
          {
            type: "image_url" as const,
            image_url: { url: imageUrl, detail: "high" as const },
          },
          {
            type: "text" as const,
            text: DEFECT_ANALYSIS_PROMPT,
          },
        ],
      } as Message,
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "defect_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            category: { type: "string" },
            severity: { type: "string" },
            confidence: { type: "number" },
            location: { type: "string" },
            description: { type: "string" },
            recommendations: { type: "array", items: { type: "string" } },
            estimatedRepairUrgency: { type: "string" },
            safetyRisk: { type: "boolean" },
            requiresShutdown: { type: "boolean" },
          },
          required: ["category", "severity", "confidence", "location", "description", "recommendations", "estimatedRepairUrgency", "safetyRisk", "requiresShutdown"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = (typeof response.choices?.[0]?.message?.content === "string"
    ? response.choices[0].message.content
    : JSON.stringify(response.choices?.[0]?.message?.content ?? {})) ?? "{}";
  return parseDefectResponse(rawContent, "manus-llm-vision", startMs);
}

function parseDefectResponse(raw: string, model: string, startMs: number): DefectAnalysis {
  // Extract JSON from the response (handle markdown code blocks)
  const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/) ??
                    raw.match(/```\s*([\s\S]*?)\s*```/) ??
                    raw.match(/(\{[\s\S]*\})/);

  const jsonStr = jsonMatch?.[1] ?? raw;

  let parsed: Partial<DefectAnalysis>;
  try {
    parsed = JSON.parse(jsonStr.trim());
  } catch {
    // If parsing fails, return a safe default
    parsed = {
      category: "unknown",
      severity: "medium",
      confidence: 0.3,
      location: "Unable to determine",
      description: "Image analysis failed — manual inspection required",
      recommendations: ["Schedule manual inspection", "Do not rely on automated assessment"],
      estimatedRepairUrgency: "within_7_days",
      safetyRisk: true,
      requiresShutdown: false,
    };
  }

  return {
    category: (parsed.category as DefectCategory) ?? "unknown",
    severity: (parsed.severity as DefectSeverity) ?? "medium",
    confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.5)),
    location: parsed.location ?? "Unknown",
    description: parsed.description ?? "No description available",
    recommendations: parsed.recommendations ?? ["Manual inspection required"],
    estimatedRepairUrgency: parsed.estimatedRepairUrgency ?? "within_30_days",
    safetyRisk: parsed.safetyRisk ?? false,
    requiresShutdown: parsed.requiresShutdown ?? false,
    model,
    processingMs: Date.now() - startMs,
  };
}

/**
 * Batch analyze multiple drone inspection images.
 * Processes up to 5 images concurrently.
 */
export async function batchAnalyzeDroneImages(
  imageUrls: string[]
): Promise<Array<DefectAnalysis & { imageUrl: string; error?: string }>> {
  const CONCURRENCY = 5;
  const results: Array<DefectAnalysis & { imageUrl: string; error?: string }> = [];

  for (let i = 0; i < imageUrls.length; i += CONCURRENCY) {
    const batch = imageUrls.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map(url => analyzeDroneImage(url))
    );

    for (let j = 0; j < batch.length; j++) {
      const result = batchResults[j];
      if (result.status === "fulfilled") {
        results.push({ ...result.value, imageUrl: batch[j] });
      } else {
        results.push({
          category: "unknown",
          severity: "medium",
          confidence: 0,
          location: "Error",
          description: "Analysis failed",
          recommendations: ["Manual inspection required"],
          estimatedRepairUrgency: "within_7_days",
          safetyRisk: true,
          requiresShutdown: false,
          model: "error",
          processingMs: 0,
          imageUrl: batch[j],
          error: result.reason?.message ?? "Unknown error",
        });
      }
    }
  }

  return results;
}
