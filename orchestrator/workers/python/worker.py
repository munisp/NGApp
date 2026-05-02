#!/usr/bin/env python3
"""
Temporal Python Worker for ML and Data Processing Activities
"""

import asyncio
import logging
import os
from dotenv import load_dotenv

from temporalio.client import Client
from temporalio.worker import Worker

from activities.fraud_detection import FraudDetectionActivities
from activities.ocr_processing import OCRProcessingActivities
from activities.analytics import AnalyticsActivities
from activities.compliance import ComplianceActivities
from activities.ml_activities import get_all_activities as get_ml_activities

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def main():
    """Main worker function"""
    
    # Configuration
    temporal_host = os.getenv("TEMPORAL_HOST", "localhost:7233")
    temporal_namespace = os.getenv("TEMPORAL_NAMESPACE", "default")
    task_queue = os.getenv("PYTHON_TASK_QUEUE", "python-workers")
    
    logger.info(f"Connecting to Temporal at {temporal_host}")
    
    # Create Temporal client
    client = await Client.connect(
        temporal_host,
        namespace=temporal_namespace,
    )
    
    # Initialize activity handlers
    fraud_activities = FraudDetectionActivities()
    ocr_activities = OCRProcessingActivities()
    analytics_activities = AnalyticsActivities()
    compliance_activities = ComplianceActivities()
    
    # Get ML activities for user journeys
    ml_activities = get_ml_activities()
    
    # Create worker
    worker = Worker(
        client,
        task_queue=task_queue,
        activities=[
            # Fraud detection activities
            fraud_activities.detect_fraud,
            fraud_activities.train_fraud_model,
            fraud_activities.evaluate_fraud_rules,
            
            # OCR processing activities
            ocr_activities.process_documents,
            ocr_activities.extract_text,
            ocr_activities.correct_ocr_errors,
            
            # Analytics activities
            analytics_activities.generate_report,
            analytics_activities.calculate_metrics,
            analytics_activities.aggregate_data,
            
            # Compliance activities
            compliance_activities.run_compliance_check,
            compliance_activities.validate_kyc,
            compliance_activities.check_sanctions,
            
            # ML activities for user journeys (Docling, PaddleOCR, LLaVA, etc.)
            *ml_activities,
        ],
    )
    
    logger.info(f"Starting Python worker on task queue: {task_queue}")
    
    # Run worker
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
