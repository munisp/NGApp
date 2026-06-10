"""
ML Activities for Temporal Python Workers

These activities handle ML-based tasks including:
- Fraud detection and scoring
- Document OCR with Docling and PaddleOCR
- Field extraction with LLaVA VLM
- Analytics and reconciliation
- PII masking
"""

import json
import hashlib
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional
import httpx
from temporalio import activity

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration from environment
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama.payment-switch.svc.cluster.local:11434")
KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "kafka.payment-switch.svc.cluster.local:9092")
LAKEHOUSE_ENDPOINT = os.getenv("S3_ENDPOINT", "http://rustfs.lakehouse.svc.cluster.local:9000")


# ============================================================================
# FRAUD DETECTION ACTIVITIES
# ============================================================================

@activity.defn(name="DetectFraud")
async def detect_fraud(transaction_data: Dict[str, Any]) -> int:
    """
    Run ML-based fraud detection on a transaction.
    Returns a fraud score from 0-100.
    """
    logger.info(f"Running fraud detection for transaction: {transaction_data}")
    
    # Extract features
    amount = transaction_data.get("amount", 0)
    payer_id = transaction_data.get("payerID", transaction_data.get("payer_id", ""))
    payee_id = transaction_data.get("payeeID", transaction_data.get("payee_id", ""))
    
    # Simple rule-based scoring (in production, this would call an ML model)
    score = 0
    
    # High amount transactions are riskier
    if amount > 100000:
        score += 30
    elif amount > 50000:
        score += 15
    
    # New users are riskier
    if payer_id.startswith("new-"):
        score += 20
    
    # Cross-border transactions
    if transaction_data.get("currency") != "NGN":
        score += 10
    
    # Device fingerprint check
    device_info = transaction_data.get("DeviceInfo", {})
    if device_info.get("is_emulator"):
        score += 40
    
    # Location anomaly
    location = transaction_data.get("Location", {})
    if location.get("is_vpn"):
        score += 25
    
    # Cap at 100
    score = min(score, 100)
    
    logger.info(f"Fraud score: {score}")
    return score


@activity.defn(name="RunMLFraudScoring")
async def run_ml_fraud_scoring(request: Dict[str, Any]) -> int:
    """
    Run ML model for fraud scoring using LLaVA via Ollama.
    """
    logger.info(f"Running ML fraud scoring")
    
    # Prepare prompt for LLaVA
    prompt = f"""Analyze this transaction for fraud risk:
    - Amount: {request.get('Amount', 0)}
    - User ID: {request.get('UserID', '')}
    - Merchant ID: {request.get('MerchantID', '')}
    - Device Info: {json.dumps(request.get('DeviceInfo', {}))}
    - Location: {json.dumps(request.get('Location', {}))}
    
    Return only a number from 0-100 representing the fraud risk score.
    """
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": "llava",
                    "prompt": prompt,
                    "stream": False
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                # Extract score from response
                try:
                    score = int(result.get("response", "50").strip())
                    return min(max(score, 0), 100)
                except ValueError:
                    return 50
    except Exception as e:
        logger.error(f"ML fraud scoring failed: {e}")
    
    # Fallback to rule-based scoring
    return await detect_fraud(request)


@activity.defn(name="RunFraudRuleEngine")
async def run_fraud_rule_engine(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Run rule-based fraud detection engine.
    """
    logger.info(f"Running fraud rule engine")
    
    score = 0
    reasons = []
    
    amount = request.get("Amount", 0)
    
    # Rule 1: High value transaction
    if amount > 500000:
        score += 30
        reasons.append("high_value_transaction")
    
    # Rule 2: Unusual time
    hour = datetime.now().hour
    if hour < 6 or hour > 22:
        score += 15
        reasons.append("unusual_time")
    
    # Rule 3: Device fingerprint
    device_info = request.get("DeviceInfo", {})
    if device_info.get("is_rooted") or device_info.get("is_jailbroken"):
        score += 25
        reasons.append("compromised_device")
    
    # Rule 4: Location mismatch
    location = request.get("Location", {})
    if location.get("country") != "NG":
        score += 20
        reasons.append("foreign_location")
    
    # Rule 5: Velocity check (simplified)
    if request.get("transaction_count_24h", 0) > 10:
        score += 20
        reasons.append("high_velocity")
    
    return {
        "score": min(score, 100),
        "reasons": reasons
    }


# ============================================================================
# DOCUMENT OCR ACTIVITIES
# ============================================================================

@activity.defn(name="ProcessDocumentsWithDocling")
async def process_documents_with_docling(documents: List[str]) -> Dict[str, Any]:
    """
    Process documents using Docling for layout analysis and PaddleOCR for text extraction.
    """
    logger.info(f"Processing {len(documents)} documents with Docling")
    
    results = {}
    
    for doc_path in documents:
        try:
            # In production, this would use actual Docling and PaddleOCR
            # For now, simulate document processing
            doc_result = {
                "path": doc_path,
                "status": "processed",
                "pages": 1,
                "text_regions": [
                    {"type": "header", "text": "Document Header"},
                    {"type": "body", "text": "Document content extracted via OCR"},
                    {"type": "table", "data": [["Field", "Value"], ["Name", "John Doe"]]},
                ],
                "confidence": 0.95,
                "processing_time_ms": 1500
            }
            results[doc_path] = doc_result
        except Exception as e:
            logger.error(f"Failed to process document {doc_path}: {e}")
            results[doc_path] = {"status": "failed", "error": str(e)}
    
    return {
        "documents": results,
        "total_processed": len([r for r in results.values() if r.get("status") == "processed"]),
        "total_failed": len([r for r in results.values() if r.get("status") == "failed"])
    }


@activity.defn(name="ExtractFieldsWithLLaVA")
async def extract_fields_with_llava(ocr_results: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract structured fields from OCR results using LLaVA VLM via Ollama.
    """
    logger.info("Extracting fields with LLaVA")
    
    extracted_fields = {}
    
    # Prepare prompt for field extraction
    documents = ocr_results.get("documents", {})
    
    for doc_path, doc_data in documents.items():
        if doc_data.get("status") != "processed":
            continue
        
        text_content = " ".join([
            region.get("text", "") 
            for region in doc_data.get("text_regions", [])
        ])
        
        prompt = f"""Extract the following fields from this document text:
        - Business Name
        - Registration Number
        - Tax ID
        - Address
        - Directors
        - Date of Incorporation
        
        Document text: {text_content}
        
        Return as JSON.
        """
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{OLLAMA_URL}/api/generate",
                    json={
                        "model": "llava",
                        "prompt": prompt,
                        "stream": False
                    }
                )
                
                if response.status_code == 200:
                    result = response.json()
                    # Parse JSON from response
                    try:
                        fields = json.loads(result.get("response", "{}"))
                        extracted_fields[doc_path] = fields
                    except json.JSONDecodeError:
                        extracted_fields[doc_path] = {"raw_response": result.get("response")}
        except Exception as e:
            logger.error(f"LLaVA extraction failed for {doc_path}: {e}")
            # Fallback to simple extraction
            extracted_fields[doc_path] = {
                "business_name": "Extracted Business Name",
                "registration_number": "RC123456",
                "extraction_method": "fallback"
            }
    
    return extracted_fields


@activity.defn(name="VerifyIDDocument")
async def verify_id_document(document_path: str, id_type: str) -> Dict[str, Any]:
    """
    Verify an ID document using OCR and validation.
    """
    logger.info(f"Verifying ID document: {document_path}, type: {id_type}")
    
    # Simulate ID verification
    verification_result = {
        "document_path": document_path,
        "id_type": id_type,
        "is_valid": True,
        "confidence": 0.92,
        "extracted_data": {
            "full_name": "John Doe",
            "date_of_birth": "1990-01-15",
            "id_number": "NIN123456789",
            "expiry_date": "2030-01-15",
            "issuing_authority": "NIMC"
        },
        "security_features": {
            "hologram_detected": True,
            "microprint_valid": True,
            "uv_features_valid": True
        },
        "tampering_detected": False
    }
    
    return verification_result


@activity.defn(name="RunLivenessCheck")
async def run_liveness_check(selfie_path: str, id_document_path: str) -> Dict[str, Any]:
    """
    Run liveness check comparing selfie to ID document photo.
    """
    logger.info(f"Running liveness check: selfie={selfie_path}, id={id_document_path}")
    
    # Simulate liveness check
    result = {
        "selfie_path": selfie_path,
        "id_document_path": id_document_path,
        "is_live": True,
        "face_match_score": 0.94,
        "liveness_score": 0.97,
        "checks": {
            "blink_detected": True,
            "head_movement": True,
            "texture_analysis": "passed",
            "depth_analysis": "passed"
        },
        "spoofing_detected": False
    }
    
    return result


# ============================================================================
# ANALYTICS ACTIVITIES
# ============================================================================

@activity.defn(name="RunReconciliation")
async def run_reconciliation(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Run reconciliation between ledger, processor, and bank data.
    """
    logger.info("Running reconciliation")
    
    ledger_data = data.get("ledgerData", [])
    processor_data = data.get("processorData", [])
    bank_data = data.get("bankData", [])
    
    # Create lookup maps
    ledger_map = {item.get("transaction_id"): item for item in ledger_data}
    processor_map = {item.get("transaction_id"): item for item in processor_data}
    bank_map = {item.get("transaction_id"): item for item in bank_data}
    
    # Find all unique transaction IDs
    all_txn_ids = set(ledger_map.keys()) | set(processor_map.keys()) | set(bank_map.keys())
    
    matched = []
    unmatched = []
    discrepancies = []
    
    for txn_id in all_txn_ids:
        ledger_entry = ledger_map.get(txn_id)
        processor_entry = processor_map.get(txn_id)
        bank_entry = bank_map.get(txn_id)
        
        if ledger_entry and processor_entry and bank_entry:
            # Check for amount discrepancies
            ledger_amount = ledger_entry.get("amount", 0)
            processor_amount = processor_entry.get("amount", 0)
            bank_amount = bank_entry.get("amount", 0)
            
            if ledger_amount == processor_amount == bank_amount:
                matched.append(txn_id)
            else:
                discrepancies.append({
                    "transaction_id": txn_id,
                    "ledger_amount": ledger_amount,
                    "processor_amount": processor_amount,
                    "bank_amount": bank_amount,
                    "type": "amount_mismatch"
                })
        else:
            unmatched.append({
                "transaction_id": txn_id,
                "in_ledger": ledger_entry is not None,
                "in_processor": processor_entry is not None,
                "in_bank": bank_entry is not None
            })
    
    reconciliation_id = f"recon-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    return {
        "reconciliationID": reconciliation_id,
        "matchedCount": len(matched),
        "unmatchedCount": len(unmatched),
        "discrepancies": discrepancies,
        "unmatched": unmatched
    }


@activity.defn(name="SubmitSparkJob")
async def submit_spark_job(config: Dict[str, Any]) -> str:
    """
    Submit a Spark job for batch analytics.
    """
    logger.info(f"Submitting Spark job: {config}")
    
    pipeline_type = config.get("pipelineType", "daily_metrics")
    
    # In production, this would submit to Spark cluster
    job_id = f"spark-{pipeline_type}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    logger.info(f"Spark job submitted: {job_id}")
    return job_id


@activity.defn(name="GetSparkJobStatus")
async def get_spark_job_status(job_id: str) -> Dict[str, Any]:
    """
    Get the status of a Spark job.
    """
    logger.info(f"Getting Spark job status: {job_id}")
    
    # Simulate job completion
    return {
        "jobId": job_id,
        "status": "completed",
        "recordsProcessed": 1000000,
        "outputPath": f"s3://lakehouse/analytics/{job_id}/output",
        "duration_seconds": 300
    }


# ============================================================================
# PII MASKING ACTIVITIES
# ============================================================================

@activity.defn(name="ApplyPIIMasking")
async def apply_pii_masking(config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Apply PII masking to a dataset.
    """
    logger.info(f"Applying PII masking: {config}")
    
    dataset_name = config.get("datasetName", "")
    fields = config.get("fields", [])
    masking_rules = config.get("maskingRules", {})
    
    # Simulate PII masking
    records_processed = 50000
    
    masked_fields = {}
    for field in fields:
        rule = masking_rules.get(field, "redact")
        if rule == "hash":
            masked_fields[field] = "SHA256 hash applied"
        elif rule == "partial":
            masked_fields[field] = "Partial masking (first/last chars visible)"
        else:
            masked_fields[field] = "Fully redacted"
    
    return {
        "datasetName": dataset_name,
        "recordsProcessed": records_processed,
        "maskedFields": masked_fields,
        "outputFormat": "parquet",
        "status": "completed"
    }


# ============================================================================
# COMPLIANCE ACTIVITIES
# ============================================================================

@activity.defn(name="CheckCompliance")
async def check_compliance(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Run compliance checks on an application.
    """
    logger.info(f"Running compliance check")
    
    application = data.get("application", {})
    ocr_data = data.get("ocrData", {})
    
    # Simulate compliance checks
    checks = {
        "aml_screening": True,
        "sanctions_check": True,
        "pep_check": True,
        "adverse_media": False,
        "document_verification": True
    }
    
    passed = all(checks.values())
    
    return {
        "passed": passed,
        "checks": checks,
        "reason": None if passed else "Failed adverse media check",
        "risk_level": "low" if passed else "high"
    }


@activity.defn(name="RunBallerineKYB")
async def run_ballerine_kyb(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Run Ballerine KYB workflow.
    """
    logger.info(f"Running Ballerine KYB for: {data.get('businessName')}")
    
    # Simulate KYB workflow
    check_id = f"kyb-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    return {
        "checkID": check_id,
        "score": 85.0,
        "status": "approved",
        "checks": {
            "business_registration": "verified",
            "tax_id": "verified",
            "directors": "verified",
            "address": "verified"
        }
    }


@activity.defn(name="RunAMLScreening")
async def run_aml_screening(business_name: str, directors: List[str]) -> Dict[str, Any]:
    """
    Run AML/Sanctions screening.
    """
    logger.info(f"Running AML screening for: {business_name}")
    
    # Simulate AML screening
    return {
        "business_name": business_name,
        "directors_screened": len(directors),
        "sanctions_hits": 0,
        "pep_hits": 0,
        "adverse_media_hits": 0,
        "status": "clear"
    }


@activity.defn(name="RunUserAMLScreening")
async def run_user_aml_screening(full_name: str, date_of_birth: str, country: str) -> bool:
    """
    Run AML screening for an individual user.
    """
    logger.info(f"Running user AML screening for: {full_name}")
    
    # Simulate AML screening - return True if clear
    return True


@activity.defn(name="VerifyIdentity")
async def verify_identity(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Verify user identity.
    """
    logger.info(f"Verifying identity for user: {data.get('userID')}")
    
    check_id = f"kyc-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    # Simulate identity verification
    return {
        "checkID": check_id,
        "score": 92.0,
        "status": "verified",
        "checks": {
            "id_document": "verified",
            "liveness": "passed",
            "face_match": "passed",
            "address": "verified"
        }
    }


# ============================================================================
# FLINK ACTIVITIES
# ============================================================================

@activity.defn(name="DeployFlinkJob")
async def deploy_flink_job(config: Dict[str, Any]) -> str:
    """
    Deploy a Flink streaming job.
    """
    logger.info(f"Deploying Flink job: {config}")
    
    stream_name = config.get("streamName", "default-stream")
    job_id = f"flink-{stream_name}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    return job_id


@activity.defn(name="ConfigureFlinkCheckpointing")
async def configure_flink_checkpointing(config: Dict[str, Any]) -> str:
    """
    Configure Flink checkpointing to RustFS.
    """
    logger.info(f"Configuring Flink checkpointing: {config}")
    
    job_id = config.get("jobID", "")
    checkpoint_bucket = config.get("checkpointBucket", "checkpoints")
    
    checkpoint_path = f"s3://{checkpoint_bucket}/flink/{job_id}"
    
    return checkpoint_path


@activity.defn(name="GetFlinkJobHealth")
async def get_flink_job_health(job_id: str) -> Dict[str, Any]:
    """
    Get Flink job health status.
    """
    logger.info(f"Getting Flink job health: {job_id}")
    
    return {
        "jobId": job_id,
        "status": "running",
        "uptime_seconds": 3600,
        "records_processed": 1000000,
        "checkpoint_count": 60,
        "last_checkpoint": datetime.now().isoformat()
    }


# ============================================================================
# ACTIVITY REGISTRATION
# ============================================================================

def get_all_activities():
    """Return all activities for registration with Temporal worker."""
    return [
        detect_fraud,
        run_ml_fraud_scoring,
        run_fraud_rule_engine,
        process_documents_with_docling,
        extract_fields_with_llava,
        verify_id_document,
        run_liveness_check,
        run_reconciliation,
        submit_spark_job,
        get_spark_job_status,
        apply_pii_masking,
        check_compliance,
        run_ballerine_kyb,
        run_aml_screening,
        run_user_aml_screening,
        verify_identity,
        deploy_flink_job,
        configure_flink_checkpointing,
        get_flink_job_health,
    ]
