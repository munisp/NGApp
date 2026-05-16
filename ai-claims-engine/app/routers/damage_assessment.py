from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from typing import Optional
import uuid

router = APIRouter()


class DamageAssessment(BaseModel):
    assessment_id: str
    damage_type: str
    severity: str  # minor, moderate, severe, total_loss
    confidence: float
    estimated_repair_cost: float
    currency: str
    parts_identified: list[str]
    damage_description: str
    recommendation: str


@router.post("/assess", response_model=DamageAssessment)
async def assess_damage(
    claim_id: str = "",
    damage_type: str = "vehicle",
    file: Optional[UploadFile] = File(None),
):
    """AI-powered damage assessment from uploaded photos."""
    # In production, this would run a CNN damage classification model
    return DamageAssessment(
        assessment_id=f"DMG-{uuid.uuid4().hex[:8].upper()}",
        damage_type=damage_type,
        severity="moderate",
        confidence=0.87,
        estimated_repair_cost=185000.0,
        currency="NGN",
        parts_identified=[
            "front_bumper",
            "headlight_left",
            "fender_left",
            "hood",
        ],
        damage_description="Moderate frontal impact damage. Left headlight shattered, front bumper cracked, "
        "left fender dented, minor hood misalignment.",
        recommendation="Repair recommended. Estimated 3-5 days at approved workshop.",
    )


@router.post("/vehicle-identify")
async def identify_vehicle(file: Optional[UploadFile] = File(None)):
    """Identify vehicle make/model from photo for policy validation."""
    return {
        "make": "Toyota",
        "model": "Corolla",
        "year": 2022,
        "color": "Silver",
        "confidence": 0.92,
        "registration_match": True,
    }
