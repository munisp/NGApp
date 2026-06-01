"""
damage_analysis.py — War Damage Assessment AI Pipeline
=======================================================
Provides three analysis capabilities for post-conflict O&G infrastructure:

1. PaddleOCR text extraction  — reads text from damage images (labels, serial
   numbers, warning signs, GPS overlays, timestamps).

2. Ollama VLM classification  — uses a local vision-language model (LLaVA,
   MiniCPM-V, or BakLLaVA) to classify damage severity and asset type from
   satellite/drone imagery.

3. Ollama LLM report generation — uses a local LLM (llama3.2) to produce:
   - Structured damage assessment JSON
   - UN/OCHA Sitrep narrative
   - Repair cost BOM estimate

All Ollama calls fall back gracefully when the service is offline.

Environment variables:
  OLLAMA_BASE_URL       Ollama API base URL (default: http://ollama:11434)
  OLLAMA_VLM_MODEL      Vision model for image classification (default: llava)
  OLLAMA_MODEL          Text model for reports (default: llama3.2)
  PADDLE_DISABLE_CHECK  Set to '1' to skip PaddleOCR model source check
"""
from __future__ import annotations

import base64
import io
import json
import logging
import os
import re
import tempfile
from typing import Any

import httpx
import numpy as np

logger = logging.getLogger("og-ml-service.damage")

# ── Configuration ─────────────────────────────────────────────────────────────
OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
OLLAMA_VLM_MODEL: str = os.getenv("OLLAMA_VLM_MODEL", "llava")
OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "llama3.2")

# Disable PaddleOCR model source connectivity check in offline environments
os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")

# ── PaddleOCR probe ───────────────────────────────────────────────────────────
_paddle_ocr = None
_paddle_available = False

def _init_paddle():
    """Lazy-initialise PaddleOCR (downloads models on first call)."""
    global _paddle_ocr, _paddle_available
    if _paddle_available:
        return True
    try:
        from paddleocr import PaddleOCR  # type: ignore
        _paddle_ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
        _paddle_available = True
        logger.info("PaddleOCR initialised successfully")
        return True
    except Exception as exc:
        logger.warning("PaddleOCR not available: %s", exc)
        return False


# ── Pydantic models (inline to avoid circular imports) ───────────────────────
from pydantic import BaseModel, Field  # noqa: E402


class DamageImageAnalysisRequest(BaseModel):
    """Request to analyse a damage image."""
    image_url: str = Field(..., description="Public URL of the damage image")
    assessment_id: int = Field(..., description="Parent assessment ID")
    lat: float | None = Field(None, description="GPS latitude of the image")
    lng: float | None = Field(None, description="GPS longitude of the image")
    context: str | None = Field(None, description="Additional context (field name, asset description)")


class DamageClassification(BaseModel):
    severity: str = Field(..., description="DESTROYED|SEVERELY_DAMAGED|MODERATELY_DAMAGED|MINOR_DAMAGE|INTACT|UNKNOWN")
    confidence: float = Field(..., ge=0.0, le=1.0)
    asset_type: str = Field(..., description="WELLHEAD|PIPELINE|SEPARATOR|PUMP_STATION|STORAGE_TANK|CONTROL_ROOM|POWER_SUPPLY|ROAD_ACCESS|UNKNOWN")
    summary: str
    ocr_text: str = Field("", description="Text extracted from image by PaddleOCR")
    vlm_model: str = Field("", description="VLM model used for classification")


class DamageReportRequest(BaseModel):
    """Request to generate a structured damage assessment report."""
    assessment_id: int
    field_name: str
    country: str = "Iraq"
    assets: list[dict[str, Any]] = Field(default_factory=list)
    images_summary: list[dict[str, Any]] = Field(default_factory=list)
    context: str | None = None


class OCHAReportRequest(BaseModel):
    """Request to generate a UN/OCHA Sitrep narrative."""
    field_name: str
    country: str
    report_date: str
    total_assets: int
    destroyed: int
    severely_damaged: int
    moderately_damaged: int
    minor_damage: int
    intact: int
    estimated_production_loss_bpd: float = 0.0
    estimated_repair_cost_usd: float = 0.0
    access_status: str = "RESTRICTED"
    key_findings: list[str] = Field(default_factory=list)


class RepairCostRequest(BaseModel):
    """Request to estimate repair cost for a damaged asset."""
    asset_type: str
    damage_severity: str
    location_country: str = "Iraq"
    additional_context: str | None = None


class RepairCostEstimate(BaseModel):
    labor_days: float
    labor_cost_usd: float
    material_cost_usd: float
    mobilization_cost_usd: float
    contingency_pct: float = 15.0
    total_cost_usd: float
    basis_of_estimate: str
    confidence: str = "MEDIUM"


# ── PaddleOCR text extraction ─────────────────────────────────────────────────

async def extract_text_from_image(image_url: str) -> str:
    """Download image and run PaddleOCR to extract any visible text."""
    if not _init_paddle():
        return ""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(image_url)
            resp.raise_for_status()
            image_bytes = resp.content

        # Write to temp file (PaddleOCR needs a file path or numpy array)
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp.write(image_bytes)
            tmp_path = tmp.name

        result = _paddle_ocr.ocr(tmp_path, cls=True)
        os.unlink(tmp_path)

        if not result or not result[0]:
            return ""

        # Flatten all detected text lines
        lines = []
        for line in result[0]:
            if line and len(line) >= 2:
                text, confidence = line[1][0], line[1][1]
                if confidence > 0.6:
                    lines.append(text)
        return " | ".join(lines)
    except Exception as exc:
        logger.warning("PaddleOCR extraction failed: %s", exc)
        return ""


# ── Ollama VLM image classification ──────────────────────────────────────────

async def classify_damage_with_vlm(image_url: str, ocr_text: str = "", context: str = "") -> DamageClassification:
    """
    Use local Ollama VLM (LLaVA/MiniCPM-V) to classify damage severity and
    asset type from a satellite or drone image.
    Falls back to rule-based heuristics if Ollama is offline.
    """
    # Download image and convert to base64 for Ollama
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            img_resp = await client.get(image_url)
            img_resp.raise_for_status()
            image_b64 = base64.b64encode(img_resp.content).decode("utf-8")
    except Exception as exc:
        logger.warning("Failed to download image for VLM: %s", exc)
        return _fallback_classification("Image download failed")

    prompt = f"""You are an expert oil & gas infrastructure damage assessment AI.
Analyse this satellite/drone image of oil & gas infrastructure damaged by conflict.

{f'OCR text extracted from image: {ocr_text}' if ocr_text else ''}
{f'Additional context: {context}' if context else ''}

Respond ONLY with a valid JSON object. No markdown, no explanation, just JSON:
{{
  "severity": "<one of: DESTROYED, SEVERELY_DAMAGED, MODERATELY_DAMAGED, MINOR_DAMAGE, INTACT, UNKNOWN>",
  "confidence": <float 0.0-1.0>,
  "asset_type": "<one of: WELLHEAD, PIPELINE, SEPARATOR, PUMP_STATION, STORAGE_TANK, CONTROL_ROOM, POWER_SUPPLY, ROAD_ACCESS, UNKNOWN>",
  "summary": "<2-3 sentences describing the visible damage, structural integrity, and any safety hazards>"
}}"""

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": OLLAMA_VLM_MODEL,
                    "prompt": prompt,
                    "images": [image_b64],
                    "stream": False,
                    "options": {"temperature": 0.1, "num_predict": 512},
                },
            )
            response.raise_for_status()
            raw_text: str = response.json().get("response", "")

        # Extract JSON from response (handle markdown code blocks)
        json_match = re.search(r'\{[^{}]*\}', raw_text, re.DOTALL)
        if not json_match:
            raise ValueError(f"No JSON found in VLM response: {raw_text[:200]}")

        parsed = json.loads(json_match.group())
        return DamageClassification(
            severity=parsed.get("severity", "UNKNOWN"),
            confidence=float(parsed.get("confidence", 0.7)),
            asset_type=parsed.get("asset_type", "UNKNOWN"),
            summary=parsed.get("summary", "VLM analysis complete."),
            ocr_text=ocr_text,
            vlm_model=f"ollama/{OLLAMA_VLM_MODEL}",
        )
    except Exception as exc:
        logger.warning("VLM classification failed (%s), using fallback", exc)
        return _fallback_classification(str(exc), ocr_text=ocr_text)


def _fallback_classification(reason: str, ocr_text: str = "") -> DamageClassification:
    """Rule-based fallback when VLM is unavailable."""
    # Simple heuristic: if OCR found certain keywords, infer severity
    text_lower = ocr_text.lower()
    severity = "UNKNOWN"
    confidence = 0.0
    if any(w in text_lower for w in ["destroyed", "collapsed", "total loss"]):
        severity, confidence = "DESTROYED", 0.5
    elif any(w in text_lower for w in ["damaged", "broken", "fire", "explosion"]):
        severity, confidence = "SEVERELY_DAMAGED", 0.4
    return DamageClassification(
        severity=severity,
        confidence=confidence,
        asset_type="UNKNOWN",
        summary=f"Automatic VLM classification unavailable ({reason}). Manual review required.",
        ocr_text=ocr_text,
        vlm_model="fallback/rule-based",
    )


# ── Ollama LLM structured damage report ──────────────────────────────────────

async def generate_damage_report(req: DamageReportRequest) -> dict[str, Any]:
    """
    Use local Ollama LLM to generate a structured damage assessment report
    from aggregated assessment data.
    """
    assets_summary = json.dumps(req.assets[:20], indent=2) if req.assets else "No asset data provided."
    images_summary = json.dumps(req.images_summary[:10], indent=2) if req.images_summary else "No image analysis data."

    prompt = f"""You are a senior oil & gas infrastructure damage assessment engineer.
Generate a structured damage assessment report for the following field.

Field: {req.field_name}
Country: {req.country}
{f'Context: {req.context}' if req.context else ''}

Asset damage data:
{assets_summary}

Image analysis results:
{images_summary}

Respond ONLY with a valid JSON object:
{{
  "executive_summary": "<3-4 sentence executive summary>",
  "total_production_loss_bpd": <estimated barrels per day lost>,
  "restoration_timeline_days": <estimated days to restore production>,
  "immediate_actions": ["<action 1>", "<action 2>", "<action 3>"],
  "safety_hazards": ["<hazard 1>", "<hazard 2>"],
  "estimated_total_repair_cost_usd": <total USD estimate>,
  "priority_assets": ["<asset 1>", "<asset 2>"],
  "environmental_risks": "<description of environmental risks>",
  "access_assessment": "<SAFE|RESTRICTED|DANGEROUS>",
  "confidence": <float 0.0-1.0>
}}"""

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.2, "num_predict": 1024},
                },
            )
            response.raise_for_status()
            raw_text: str = response.json().get("response", "")

        json_match = re.search(r'\{.*\}', raw_text, re.DOTALL)
        if not json_match:
            raise ValueError("No JSON in LLM response")
        return json.loads(json_match.group())
    except Exception as exc:
        logger.warning("Damage report generation failed: %s", exc)
        return _fallback_damage_report(req)


def _fallback_damage_report(req: DamageReportRequest) -> dict[str, Any]:
    destroyed = sum(1 for a in req.assets if a.get("classification") == "DESTROYED")
    severe = sum(1 for a in req.assets if a.get("classification") == "SEVERELY_DAMAGED")
    total = len(req.assets)
    return {
        "executive_summary": (
            f"Damage assessment for {req.field_name}, {req.country}. "
            f"{destroyed} assets destroyed, {severe} severely damaged out of {total} assessed. "
            "Full LLM analysis unavailable — rule-based estimate provided."
        ),
        "total_production_loss_bpd": destroyed * 500 + severe * 200,
        "restoration_timeline_days": destroyed * 90 + severe * 30,
        "immediate_actions": [
            "Conduct safety sweep for unexploded ordnance",
            "Isolate damaged wellheads to prevent hydrocarbon release",
            "Establish security perimeter around critical infrastructure",
        ],
        "safety_hazards": ["Hydrocarbon release risk", "Structural collapse risk"],
        "estimated_total_repair_cost_usd": destroyed * 2_000_000 + severe * 500_000,
        "priority_assets": [a.get("asset_id", "unknown") for a in req.assets[:3]],
        "environmental_risks": "Potential hydrocarbon spill and soil contamination.",
        "access_assessment": "RESTRICTED",
        "confidence": 0.4,
    }


# ── Ollama LLM OCHA Sitrep generation ────────────────────────────────────────

async def generate_ocha_sitrep(req: OCHAReportRequest) -> dict[str, Any]:
    """
    Generate a UN/OCHA-format Situation Report narrative using local Ollama LLM.
    """
    prompt = f"""You are a UN OCHA humanitarian affairs officer writing a Situation Report
for oil & gas infrastructure damage in a conflict-affected area.

SITUATION DATA:
- Field: {req.field_name}, {req.country}
- Report Date: {req.report_date}
- Total Assets Assessed: {req.total_assets}
- Destroyed: {req.destroyed}
- Severely Damaged: {req.severely_damaged}
- Moderately Damaged: {req.moderately_damaged}
- Minor Damage: {req.minor_damage}
- Intact: {req.intact}
- Estimated Production Loss: {req.estimated_production_loss_bpd:,.0f} bpd
- Estimated Repair Cost: USD {req.estimated_repair_cost_usd:,.0f}
- Access Status: {req.access_status}
- Key Findings: {'; '.join(req.key_findings) if req.key_findings else 'None reported'}

Write a professional OCHA Sitrep with these sections. Respond ONLY with JSON:
{{
  "sitrep_number": "SITREP-001",
  "classification": "UNCLASSIFIED",
  "situation_overview": "<2-3 paragraph situation overview>",
  "humanitarian_impact": "<impact on civilian population and energy security>",
  "response_actions": "<actions taken or planned by response teams>",
  "access_constraints": "<description of access and security constraints>",
  "funding_requirements": "<estimated funding requirements and sources>",
  "next_steps": ["<step 1>", "<step 2>", "<step 3>"],
  "contacts": {{
    "field_coordinator": "TBD",
    "reporting_officer": "OG-RMM Platform",
    "ocha_desk": "ocha-{req.country.lower().replace(' ', '-')}@un.org"
  }}
}}"""

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.3, "num_predict": 1500},
                },
            )
            response.raise_for_status()
            raw_text: str = response.json().get("response", "")

        json_match = re.search(r'\{.*\}', raw_text, re.DOTALL)
        if not json_match:
            raise ValueError("No JSON in LLM response")
        return json.loads(json_match.group())
    except Exception as exc:
        logger.warning("OCHA sitrep generation failed: %s", exc)
        return _fallback_ocha_sitrep(req)


def _fallback_ocha_sitrep(req: OCHAReportRequest) -> dict[str, Any]:
    damage_pct = round((req.destroyed + req.severely_damaged) / max(req.total_assets, 1) * 100, 1)
    return {
        "sitrep_number": "SITREP-001",
        "classification": "UNCLASSIFIED",
        "situation_overview": (
            f"As of {req.report_date}, damage assessment of {req.field_name} oil field in {req.country} "
            f"reveals {damage_pct}% of assessed assets are destroyed or severely damaged. "
            f"Estimated production loss of {req.estimated_production_loss_bpd:,.0f} bpd has been recorded. "
            f"Access to the site remains {req.access_status.lower()}."
        ),
        "humanitarian_impact": (
            f"The damage to {req.field_name} represents a significant disruption to national energy supply. "
            f"An estimated USD {req.estimated_repair_cost_usd:,.0f} is required for full restoration."
        ),
        "response_actions": "Initial damage assessment completed. Repair prioritisation underway.",
        "access_constraints": f"Site access is currently {req.access_status}. Security clearance required.",
        "funding_requirements": f"USD {req.estimated_repair_cost_usd:,.0f} required. Potential sources: World Bank, OPEC Fund, Islamic Development Bank.",
        "next_steps": [
            "Complete detailed engineering survey of all DESTROYED assets",
            "Mobilise emergency well control teams for wellhead isolation",
            "Submit funding request to international reconstruction partners",
        ],
        "contacts": {
            "field_coordinator": "TBD",
            "reporting_officer": "OG-RMM Platform",
            "ocha_desk": f"ocha-{req.country.lower().replace(' ', '-')}@un.org",
        },
    }


# ── Ollama LLM repair cost estimation ────────────────────────────────────────

# Reference cost table (USD) — used as fallback and LLM context
_REFERENCE_COSTS: dict[str, dict[str, dict[str, float]]] = {
    "WELLHEAD": {
        "DESTROYED":          {"labor_days": 45, "labor_rate": 1200, "materials": 850_000, "mobilization": 120_000},
        "SEVERELY_DAMAGED":   {"labor_days": 25, "labor_rate": 1200, "materials": 350_000, "mobilization": 80_000},
        "MODERATELY_DAMAGED": {"labor_days": 12, "labor_rate": 1000, "materials": 120_000, "mobilization": 45_000},
        "MINOR_DAMAGE":       {"labor_days": 4,  "labor_rate": 900,  "materials": 25_000,  "mobilization": 15_000},
    },
    "PIPELINE": {
        "DESTROYED":          {"labor_days": 60, "labor_rate": 1100, "materials": 1_200_000, "mobilization": 150_000},
        "SEVERELY_DAMAGED":   {"labor_days": 30, "labor_rate": 1100, "materials": 450_000,   "mobilization": 90_000},
        "MODERATELY_DAMAGED": {"labor_days": 14, "labor_rate": 950,  "materials": 180_000,   "mobilization": 55_000},
        "MINOR_DAMAGE":       {"labor_days": 5,  "labor_rate": 850,  "materials": 40_000,    "mobilization": 20_000},
    },
    "SEPARATOR": {
        "DESTROYED":          {"labor_days": 50, "labor_rate": 1300, "materials": 2_500_000, "mobilization": 180_000},
        "SEVERELY_DAMAGED":   {"labor_days": 28, "labor_rate": 1300, "materials": 800_000,   "mobilization": 100_000},
        "MODERATELY_DAMAGED": {"labor_days": 10, "labor_rate": 1100, "materials": 250_000,   "mobilization": 60_000},
        "MINOR_DAMAGE":       {"labor_days": 3,  "labor_rate": 1000, "materials": 50_000,    "mobilization": 20_000},
    },
    "PUMP_STATION": {
        "DESTROYED":          {"labor_days": 40, "labor_rate": 1200, "materials": 1_800_000, "mobilization": 140_000},
        "SEVERELY_DAMAGED":   {"labor_days": 22, "labor_rate": 1200, "materials": 600_000,   "mobilization": 85_000},
        "MODERATELY_DAMAGED": {"labor_days": 10, "labor_rate": 1000, "materials": 200_000,   "mobilization": 50_000},
        "MINOR_DAMAGE":       {"labor_days": 3,  "labor_rate": 900,  "materials": 45_000,    "mobilization": 18_000},
    },
    "STORAGE_TANK": {
        "DESTROYED":          {"labor_days": 35, "labor_rate": 1100, "materials": 1_500_000, "mobilization": 120_000},
        "SEVERELY_DAMAGED":   {"labor_days": 20, "labor_rate": 1100, "materials": 500_000,   "mobilization": 75_000},
        "MODERATELY_DAMAGED": {"labor_days": 8,  "labor_rate": 950,  "materials": 150_000,   "mobilization": 40_000},
        "MINOR_DAMAGE":       {"labor_days": 2,  "labor_rate": 850,  "materials": 30_000,    "mobilization": 12_000},
    },
    "CONTROL_ROOM": {
        "DESTROYED":          {"labor_days": 30, "labor_rate": 1400, "materials": 3_000_000, "mobilization": 100_000},
        "SEVERELY_DAMAGED":   {"labor_days": 18, "labor_rate": 1400, "materials": 900_000,   "mobilization": 70_000},
        "MODERATELY_DAMAGED": {"labor_days": 8,  "labor_rate": 1200, "materials": 300_000,   "mobilization": 45_000},
        "MINOR_DAMAGE":       {"labor_days": 2,  "labor_rate": 1100, "materials": 60_000,    "mobilization": 15_000},
    },
    "POWER_SUPPLY": {
        "DESTROYED":          {"labor_days": 25, "labor_rate": 1200, "materials": 800_000,   "mobilization": 90_000},
        "SEVERELY_DAMAGED":   {"labor_days": 14, "labor_rate": 1200, "materials": 280_000,   "mobilization": 60_000},
        "MODERATELY_DAMAGED": {"labor_days": 6,  "labor_rate": 1000, "materials": 90_000,    "mobilization": 30_000},
        "MINOR_DAMAGE":       {"labor_days": 2,  "labor_rate": 900,  "materials": 20_000,    "mobilization": 10_000},
    },
    "ROAD_ACCESS": {
        "DESTROYED":          {"labor_days": 20, "labor_rate": 800,  "materials": 400_000,   "mobilization": 60_000},
        "SEVERELY_DAMAGED":   {"labor_days": 10, "labor_rate": 800,  "materials": 150_000,   "mobilization": 35_000},
        "MODERATELY_DAMAGED": {"labor_days": 4,  "labor_rate": 700,  "materials": 50_000,    "mobilization": 20_000},
        "MINOR_DAMAGE":       {"labor_days": 1,  "labor_rate": 650,  "materials": 10_000,    "mobilization": 8_000},
    },
}

_DEFAULT_COSTS = {"labor_days": 20, "labor_rate": 1000, "materials": 500_000, "mobilization": 80_000}


async def estimate_repair_cost(req: RepairCostRequest) -> RepairCostEstimate:
    """
    Estimate repair cost using Ollama LLM with reference cost table as context.
    Falls back to reference table lookup if Ollama is unavailable.
    """
    ref = _REFERENCE_COSTS.get(req.asset_type, {}).get(req.damage_severity, _DEFAULT_COSTS)
    ref_cost_json = json.dumps(ref, indent=2)

    prompt = f"""You are a senior oil & gas cost estimator specialising in post-conflict infrastructure repair.

Asset type: {req.asset_type}
Damage severity: {req.damage_severity}
Location: {req.location_country}
{f'Additional context: {req.additional_context}' if req.additional_context else ''}

Reference cost data for this asset/severity combination:
{ref_cost_json}

Adjust the estimate for {req.location_country} (consider local labour rates, import costs, security surcharges).
Respond ONLY with JSON:
{{
  "labor_days": <float>,
  "labor_cost_usd": <float>,
  "material_cost_usd": <float>,
  "mobilization_cost_usd": <float>,
  "contingency_pct": <float, typically 15-25 for conflict zones>,
  "total_cost_usd": <float>,
  "basis_of_estimate": "<2-3 sentence explanation>",
  "confidence": "<LOW|MEDIUM|HIGH>"
}}"""

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.1, "num_predict": 512},
                },
            )
            response.raise_for_status()
            raw_text: str = response.json().get("response", "")

        json_match = re.search(r'\{[^{}]*\}', raw_text, re.DOTALL)
        if not json_match:
            raise ValueError("No JSON in LLM response")
        parsed = json.loads(json_match.group())

        labor_cost = float(parsed.get("labor_cost_usd", ref["labor_days"] * ref["labor_rate"]))
        material_cost = float(parsed.get("material_cost_usd", ref["materials"]))
        mob_cost = float(parsed.get("mobilization_cost_usd", ref["mobilization"]))
        contingency = float(parsed.get("contingency_pct", 15.0))
        subtotal = labor_cost + material_cost + mob_cost
        total = subtotal * (1 + contingency / 100)

        return RepairCostEstimate(
            labor_days=float(parsed.get("labor_days", ref["labor_days"])),
            labor_cost_usd=labor_cost,
            material_cost_usd=material_cost,
            mobilization_cost_usd=mob_cost,
            contingency_pct=contingency,
            total_cost_usd=float(parsed.get("total_cost_usd", total)),
            basis_of_estimate=parsed.get("basis_of_estimate", "Ollama LLM estimate based on reference cost table."),
            confidence=parsed.get("confidence", "MEDIUM"),
        )
    except Exception as exc:
        logger.warning("Ollama cost estimation failed (%s), using reference table", exc)
        return _reference_cost_estimate(req, ref)


def _reference_cost_estimate(req: RepairCostRequest, ref: dict) -> RepairCostEstimate:
    labor_cost = ref["labor_days"] * ref["labor_rate"]
    material_cost = ref["materials"]
    mob_cost = ref["mobilization"]
    contingency = 20.0  # Higher contingency for conflict zones
    subtotal = labor_cost + material_cost + mob_cost
    total = subtotal * (1 + contingency / 100)
    return RepairCostEstimate(
        labor_days=ref["labor_days"],
        labor_cost_usd=labor_cost,
        material_cost_usd=material_cost,
        mobilization_cost_usd=mob_cost,
        contingency_pct=contingency,
        total_cost_usd=total,
        basis_of_estimate=(
            f"Reference cost estimate for {req.asset_type} ({req.damage_severity}) in {req.location_country}. "
            "Based on regional O&G repair cost benchmarks with 20% conflict-zone contingency. "
            "Ollama LLM unavailable — deterministic estimate used."
        ),
        confidence="LOW",
    )
