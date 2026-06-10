#!/usr/bin/env python3
"""
Kafka to PostgreSQL Sync Service
Consumes TigerBeetle CDC events from Kafka and applies them to PostgreSQL
"""

import asyncio
import json
import logging
import os
from typing import Dict, Any, List
from datetime import datetime

from kafka import KafkaConsumer
from kafka.errors import KafkaError
import psycopg2
from psycopg2.extras import execute_batch
from psycopg2.pool import ThreadedConnectionPool

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class KafkaPostgresSyncService:
    """
    Syncs TigerBeetle changes from Kafka to PostgreSQL
    
    This service ensures that PostgreSQL maintains a near real-time replica
    of the TigerBeetle ledger data.
    """
    
    def __init__(
        self,
        kafka_bootstrap_servers: str,
        kafka_topics: List[str],
        kafka_group_id: str,
        postgres_dsn: str,
        batch_size: int = 100,
        batch_timeout: float = 1.0
    ):
        self.kafka_bootstrap_servers = kafka_bootstrap_servers
        self.kafka_topics = kafka_topics
        self.kafka_group_id = kafka_group_id
        self.postgres_dsn = postgres_dsn
        self.batch_size = batch_size
        self.batch_timeout = batch_timeout
        
        # Clients
        self.kafka_consumer: KafkaConsumer = None
        self.pg_pool: ThreadedConnectionPool = None
        
        # Metrics
        self.events_processed = 0
        self.events_failed = 0
        self.batches_committed = 0
        
    def initialize(self):
        """Initialize connections"""
        logger.info("Initializing Kafka to PostgreSQL Sync Service...")
        
        # Initialize Kafka consumer
        try:
            self.kafka_consumer = KafkaConsumer(
                *self.kafka_topics,
                bootstrap_servers=self.kafka_bootstrap_servers,
                group_id=self.kafka_group_id,
                value_deserializer=lambda m: json.loads(m.decode('utf-8')),
                key_deserializer=lambda k: k.decode('utf-8') if k else None,
                enable_auto_commit=False,  # Manual commit for exactly-once semantics
                max_poll_records=self.batch_size,
                auto_offset_reset='earliest'
            )
            logger.info(f"Connected to Kafka: {self.kafka_bootstrap_servers}")
        except Exception as e:
            logger.error(f"Failed to connect to Kafka: {e}")
            raise
        
        # Initialize PostgreSQL connection pool
        try:
            self.pg_pool = ThreadedConnectionPool(
                minconn=2,
                maxconn=10,
                dsn=self.postgres_dsn
            )
            logger.info("Connected to PostgreSQL")
        except Exception as e:
            logger.error(f"Failed to connect to PostgreSQL: {e}")
            raise
        
        # Ensure tables exist
        self.create_tables()
        
        logger.info("Sync service initialized successfully")
    
    def create_tables(self):
        """Create PostgreSQL tables if they don't exist"""
        conn = self.pg_pool.getconn()
        try:
            with conn.cursor() as cur:
                # Accounts table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS tigerbeetle_accounts (
                        id BIGINT PRIMARY KEY,
                        debits_pending BIGINT NOT NULL DEFAULT 0,
                        debits_posted BIGINT NOT NULL DEFAULT 0,
                        credits_pending BIGINT NOT NULL DEFAULT 0,
                        credits_posted BIGINT NOT NULL DEFAULT 0,
                        user_data_128 NUMERIC(39) NOT NULL DEFAULT 0,
                        user_data_64 BIGINT NOT NULL DEFAULT 0,
                        user_data_32 INTEGER NOT NULL DEFAULT 0,
                        reserved INTEGER NOT NULL DEFAULT 0,
                        ledger INTEGER NOT NULL,
                        code SMALLINT NOT NULL,
                        flags SMALLINT NOT NULL DEFAULT 0,
                        timestamp BIGINT NOT NULL,
                        synced_at TIMESTAMP NOT NULL DEFAULT NOW(),
                        CONSTRAINT balance_check CHECK (
                            debits_posted + credits_pending >= credits_posted + debits_pending
                        )
                    )
                """)
                
                # Transfers table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS tigerbeetle_transfers (
                        id BIGINT PRIMARY KEY,
                        debit_account_id BIGINT NOT NULL,
                        credit_account_id BIGINT NOT NULL,
                        amount BIGINT NOT NULL,
                        pending_id BIGINT NOT NULL DEFAULT 0,
                        user_data_128 NUMERIC(39) NOT NULL DEFAULT 0,
                        user_data_64 BIGINT NOT NULL DEFAULT 0,
                        user_data_32 INTEGER NOT NULL DEFAULT 0,
                        timeout INTEGER NOT NULL DEFAULT 0,
                        ledger INTEGER NOT NULL,
                        code SMALLINT NOT NULL,
                        flags SMALLINT NOT NULL DEFAULT 0,
                        timestamp BIGINT NOT NULL,
                        synced_at TIMESTAMP NOT NULL DEFAULT NOW(),
                        FOREIGN KEY (debit_account_id) REFERENCES tigerbeetle_accounts(id),
                        FOREIGN KEY (credit_account_id) REFERENCES tigerbeetle_accounts(id)
                    )
                """)
                
                # Create indexes
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_accounts_ledger 
                    ON tigerbeetle_accounts(ledger)
                """)
                
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_accounts_timestamp 
                    ON tigerbeetle_accounts(timestamp DESC)
                """)
                
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_transfers_debit_account 
                    ON tigerbeetle_transfers(debit_account_id)
                """)
                
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_transfers_credit_account 
                    ON tigerbeetle_transfers(credit_account_id)
                """)
                
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_transfers_timestamp 
                    ON tigerbeetle_transfers(timestamp DESC)
                """)
                
                conn.commit()
                logger.info("PostgreSQL tables created/verified")
                
        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to create tables: {e}")
            raise
        finally:
            self.pg_pool.putconn(conn)
    
    def process_account_event(self, event: Dict[str, Any], conn):
        """Process an account change event"""
        try:
            data = event['data']
            change_type = event['change_type']
            
            with conn.cursor() as cur:
                if change_type == 'account_created':
                    # Insert new account
                    cur.execute("""
                        INSERT INTO tigerbeetle_accounts (
                            id, debits_pending, debits_posted, credits_pending, credits_posted,
                            user_data_128, user_data_64, user_data_32, reserved,
                            ledger, code, flags, timestamp
                        ) VALUES (
                            %(id)s, %(debits_pending)s, %(debits_posted)s, 
                            %(credits_pending)s, %(credits_posted)s,
                            %(user_data_128)s, %(user_data_64)s, %(user_data_32)s, %(reserved)s,
                            %(ledger)s, %(code)s, %(flags)s, %(timestamp)s
                        )
                        ON CONFLICT (id) DO UPDATE SET
                            debits_pending = EXCLUDED.debits_pending,
                            debits_posted = EXCLUDED.debits_posted,
                            credits_pending = EXCLUDED.credits_pending,
                            credits_posted = EXCLUDED.credits_posted,
                            timestamp = EXCLUDED.timestamp,
                            synced_at = NOW()
                    """, data)
                
                elif change_type == 'account_updated':
                    # Update existing account
                    cur.execute("""
                        UPDATE tigerbeetle_accounts SET
                            debits_pending = %(debits_pending)s,
                            debits_posted = %(debits_posted)s,
                            credits_pending = %(credits_pending)s,
                            credits_posted = %(credits_posted)s,
                            timestamp = %(timestamp)s,
                            synced_at = NOW()
                        WHERE id = %(id)s
                    """, data)
                
        except Exception as e:
            logger.error(f"Failed to process account event: {e}")
            raise
    
    def process_transfer_event(self, event: Dict[str, Any], conn):
        """Process a transfer change event"""
        try:
            data = event['data']
            change_type = event['change_type']
            
            with conn.cursor() as cur:
                if change_type == 'transfer_created':
                    # Insert new transfer
                    cur.execute("""
                        INSERT INTO tigerbeetle_transfers (
                            id, debit_account_id, credit_account_id, amount, pending_id,
                            user_data_128, user_data_64, user_data_32, timeout,
                            ledger, code, flags, timestamp
                        ) VALUES (
                            %(id)s, %(debit_account_id)s, %(credit_account_id)s, 
                            %(amount)s, %(pending_id)s,
                            %(user_data_128)s, %(user_data_64)s, %(user_data_32)s, %(timeout)s,
                            %(ledger)s, %(code)s, %(flags)s, %(timestamp)s
                        )
                        ON CONFLICT (id) DO NOTHING
                    """, data)
                
        except Exception as e:
            logger.error(f"Failed to process transfer event: {e}")
            raise
    
    def process_batch(self, messages: List) -> int:
        """Process a batch of messages"""
        if not messages:
            return 0
        
        conn = self.pg_pool.getconn()
        processed = 0
        
        try:
            conn.autocommit = False
            
            for message in messages:
                event = message.value
                topic = message.topic
                
                try:
                    if 'accounts' in topic:
                        self.process_account_event(event, conn)
                    elif 'transfers' in topic:
                        self.process_transfer_event(event, conn)
                    
                    processed += 1
                    
                except Exception as e:
                    logger.error(f"Failed to process message: {e}")
                    self.events_failed += 1
                    # Continue processing other messages
            
            # Commit the batch
            conn.commit()
            self.batches_committed += 1
            
            # Commit Kafka offsets
            self.kafka_consumer.commit()
            
            logger.debug(f"Processed batch of {processed} events")
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to process batch: {e}")
            raise
        finally:
            self.pg_pool.putconn(conn)
        
        return processed
    
    def run(self):
        """Main sync loop"""
        logger.info("Starting sync loop...")
        
        try:
            batch = []
            last_commit_time = datetime.now()
            
            for message in self.kafka_consumer:
                batch.append(message)
                
                # Process batch if size reached or timeout elapsed
                should_process = (
                    len(batch) >= self.batch_size or
                    (datetime.now() - last_commit_time).total_seconds() >= self.batch_timeout
                )
                
                if should_process:
                    processed = self.process_batch(batch)
                    self.events_processed += processed
                    batch = []
                    last_commit_time = datetime.now()
                    
                    # Log metrics
                    if self.events_processed % 1000 == 0:
                        logger.info(
                            f"Sync Metrics: processed={self.events_processed}, "
                            f"failed={self.events_failed}, "
                            f"batches={self.batches_committed}"
                        )
            
        except KeyboardInterrupt:
            logger.info("Shutting down sync service...")
        except Exception as e:
            logger.error(f"Sync loop error: {e}", exc_info=True)
            raise
        finally:
            self.cleanup()
    
    def cleanup(self):
        """Cleanup resources"""
        logger.info("Cleaning up resources...")
        
        if self.kafka_consumer:
            self.kafka_consumer.close()
        
        if self.pg_pool:
            self.pg_pool.closeall()
        
        logger.info("Cleanup complete")


def main():
    """Main entry point"""
    # Configuration from environment variables
    kafka_bootstrap_servers = os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'kafka:9092')
    kafka_topics = os.getenv('KAFKA_TOPICS', 'tigerbeetle.accounts,tigerbeetle.transfers').split(',')
    kafka_group_id = os.getenv('KAFKA_GROUP_ID', 'tigerbeetle-postgres-sync')
    postgres_dsn = os.getenv('POSTGRES_DSN', 'postgresql://user:password@postgres:5432/payment_switch')
    
    # Create and run the sync service
    service = KafkaPostgresSyncService(
        kafka_bootstrap_servers=kafka_bootstrap_servers,
        kafka_topics=kafka_topics,
        kafka_group_id=kafka_group_id,
        postgres_dsn=postgres_dsn
    )
    
    service.initialize()
    service.run()


if __name__ == '__main__':
    main()
