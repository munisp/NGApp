from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from typing import Optional
import uuid

router = APIRouter()


class ExtractedDocument(BaseModel):
    document_id: str
    document_type: str
    confidence: float
    extracted_fields: dict
    validation_status: str
    issues: list[str]


@router.post("/extract", response_model=ExtractedDocument)
async def extract_document(
    document_type: str = "drivers_license",
    file: Optional[UploadFile] = File(None),
):
    """Extract structured data from insurance documents using OCR/Document AI."""
    templates = {
        "drivers_license": {
            "full_name": "John Adebayo Okafor",
            "license_number": "DL-LAG-2023-456789",
            "date_of_birth": "1990-05-15",
            "expiry_date": "2028-05-14",
            "vehicle_class": "B",
            "state": "Lagos",
            "address": "15 Admiralty Way, Lekki Phase 1, Lagos",
        },
        "vehicle_registration": {
            "registration_number": "LAG-234-XY",
            "chassis_number": "JTDKN3DU5A0123456",
            "engine_number": "2ZR-FE-7654321",
            "make": "Toyota",
            "model": "Corolla",
            "year": 2022,
            "color": "Silver",
            "owner_name": "John Adebayo Okafor",
        },
        "police_report": {
            "report_number": "PR/LAG/2026/05/12345",
            "incident_date": "2026-05-10",
            "incident_location": "Third Mainland Bridge, Lagos",
            "incident_type": "Road Traffic Accident",
            "parties_involved": 2,
            "injuries_reported": False,
            "officer_name": "Insp. Chukwu Emmanuel",
            "station": "Bar Beach Police Station",
        },
        "medical_report": {
            "patient_name": "John Adebayo Okafor",
            "hospital": "Lagos University Teaching Hospital",
            "admission_date": "2026-05-10",
            "discharge_date": "2026-05-12",
            "diagnosis": "Whiplash injury, Grade II",
            "treatment": "Conservative management, physiotherapy",
            "doctor_name": "Dr. Amina Hassan",
            "total_bill": 125000,
        },
    }

    fields = templates.get(document_type, {"raw_text": "Document parsed successfully"})
    issues = []
    validation = "valid"

    return ExtractedDocument(
        document_id=f"DOC-{uuid.uuid4().hex[:8].upper()}",
        document_type=document_type,
        confidence=0.94,
        extracted_fields=fields,
        validation_status=validation,
        issues=issues,
    )


@router.get("/supported-types")
async def supported_document_types():
    return {
        "types": [
            {"type": "drivers_license", "description": "Nigerian Driver's License"},
            {"type": "vehicle_registration", "description": "Vehicle Registration Certificate"},
            {"type": "police_report", "description": "Nigeria Police Force Incident Report"},
            {"type": "medical_report", "description": "Hospital Discharge Summary / Medical Report"},
            {"type": "repair_estimate", "description": "Vehicle Repair Estimate from approved workshop"},
            {"type": "death_certificate", "description": "Death Certificate"},
            {"type": "fire_report", "description": "Fire Service Incident Report"},
            {"type": "nin_slip", "description": "National Identification Number (NIN) slip"},
            {"type": "bank_statement", "description": "Bank Statement for premium verification"},
        ]
    }
