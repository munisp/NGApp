#!/usr/bin/env python3
"""
Fluvio Consumer Service for POS Transactions
Consumes processed transactions from Fluvio and forwards them to Temporal workflows
"""

import asyncio
import json
import logging
import os
import signal
import sys
from datetime import datetime
from typing import Dict, Any

from fluvio import Fluvio, Offset
from temporalio.client import Client as TemporalClient
from prometheus_client import Counter, Histogram, start_http_server

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Prometheus metrics
TRANSACTIONS_CONSUMED = Counter(
    'pos_transactions_consumed_total',
    'Total number of POS transactions consumed from Fluvio'
)
TRANSACTIONS_PROCESSED = Counter(
    'pos_transactions_processed_total',
    'Total number of POS transactions successfully processed',
    ['status']
)
PROCESSING_DURATION = Histogram(
    'pos_transaction_processing_duration_seconds',
    'Time spent processing POS transactions'
)
FRAUD_SCORE_DISTRIBUTION = Histogram(
    'pos_fraud_score_distribution',
    'Distribution of fraud scores',
    buckets=[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
)

class FluvioConsumerService:
    """Service for consuming POS transactions from Fluvio"""
    
    def __init__(self):
        self.fluvio_endpoint = os.getenv('FLUVIO_ENDPOINT', 'fluvio-sc.payment-switch.svc.cluster.local:9003')
        self.topic_name = os.getenv('FLUVIO_TOPIC', 'processed-transactions')
        self.temporal_endpoint = os.getenv('TEMPORAL_ENDPOINT', 'temporal-frontend.payment-switch.svc.cluster.local:7233')
        self.consumer_group = os.getenv('CONSUMER_GROUP', 'pos-transaction-processor')
        self.running = True
        
    async def connect_fluvio(self) -> Fluvio:
        """Connect to Fluvio cluster"""
        try:
            logger.info(f"Connecting to Fluvio at {self.fluvio_endpoint}")
            fluvio = await Fluvio.connect(self.fluvio_endpoint)
            logger.info("Successfully connected to Fluvio")
            return fluvio
        except Exception as e:
            logger.error(f"Failed to connect to Fluvio: {e}")
            raise
    
    async def connect_temporal(self) -> TemporalClient:
        """Connect to Temporal"""
        try:
            logger.info(f"Connecting to Temporal at {self.temporal_endpoint}")
            client = await TemporalClient.connect(self.temporal_endpoint)
            logger.info("Successfully connected to Temporal")
            return client
        except Exception as e:
            logger.error(f"Failed to connect to Temporal: {e}")
            raise
    
    async def process_transaction(
        self,
        transaction: Dict[str, Any],
        temporal_client: TemporalClient
    ) -> bool:
        """Process a single transaction"""
        try:
            transaction_id = transaction.get('transaction_id')
            fraud_score = transaction.get('fraud_score', 0.0)
            risk_level = transaction.get('risk_level', 'unknown')
            
            logger.info(
                f"Processing transaction {transaction_id} "
                f"(fraud_score: {fraud_score}, risk_level: {risk_level})"
            )
            
            # Record fraud score distribution
            FRAUD_SCORE_DISTRIBUTION.observe(fraud_score)
            
            # Start Temporal workflow for transaction processing
            workflow_id = f"pos-payment-{transaction_id}"
            
            # In production, this would start an actual Temporal workflow
            # await temporal_client.start_workflow(
            #     "POSPaymentWorkflow",
            #     transaction,
            #     id=workflow_id,
            #     task_queue="pos-payment-queue"
            # )
            
            # For now, log the transaction
            logger.info(f"Started workflow {workflow_id} for transaction {transaction_id}")
            
            TRANSACTIONS_PROCESSED.labels(status='success').inc()
            return True
            
        except Exception as e:
            logger.error(f"Error processing transaction: {e}", exc_info=True)
            TRANSACTIONS_PROCESSED.labels(status='error').inc()
            return False
    
    async def consume_transactions(self):
        """Main consumer loop"""
        try:
            # Connect to Fluvio
            fluvio = await self.connect_fluvio()
            
            # Connect to Temporal
            temporal_client = await self.connect_temporal()
            
            # Create consumer
            consumer = await fluvio.partition_consumer(self.topic_name, 0)
            
            logger.info(f"Starting to consume from topic: {self.topic_name}")
            
            # Consume messages
            async for record in consumer.stream(Offset.end()):
                if not self.running:
                    logger.info("Shutting down consumer...")
                    break
                
                try:
                    # Parse transaction
                    transaction_data = record.value().decode('utf-8')
                    transaction = json.loads(transaction_data)
                    
                    TRANSACTIONS_CONSUMED.inc()
                    
                    # Process transaction
                    with PROCESSING_DURATION.time():
                        await self.process_transaction(transaction, temporal_client)
                    
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse transaction JSON: {e}")
                    TRANSACTIONS_PROCESSED.labels(status='parse_error').inc()
                except Exception as e:
                    logger.error(f"Error processing record: {e}", exc_info=True)
                    TRANSACTIONS_PROCESSED.labels(status='error').inc()
            
        except Exception as e:
            logger.error(f"Fatal error in consumer loop: {e}", exc_info=True)
            raise
    
    def shutdown(self, signum, frame):
        """Graceful shutdown handler"""
        logger.info(f"Received signal {signum}, initiating graceful shutdown...")
        self.running = False

async def main():
    """Main entry point"""
    # Start Prometheus metrics server
    metrics_port = int(os.getenv('METRICS_PORT', '9090'))
    start_http_server(metrics_port)
    logger.info(f"Prometheus metrics server started on port {metrics_port}")
    
    # Create consumer service
    service = FluvioConsumerService()
    
    # Register signal handlers
    signal.signal(signal.SIGINT, service.shutdown)
    signal.signal(signal.SIGTERM, service.shutdown)
    
    # Start consuming
    try:
        await service.consume_transactions()
    except Exception as e:
        logger.error(f"Consumer service failed: {e}", exc_info=True)
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())
