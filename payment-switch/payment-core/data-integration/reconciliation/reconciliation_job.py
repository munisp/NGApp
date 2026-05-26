#!/usr/bin/env python3
"""
Reconciliation Job for Payment Switch
Compares TigerBeetle ledger with Delta Lake transaction totals
"""

import json
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from decimal import Decimal
import asyncio

import redis

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

REDIS_URL = os.getenv('REDIS_URL', 'redis://redis:6379/4')
TIGERBEETLE_ADDRESSES = os.getenv('TIGERBEETLE_ADDRESSES', 'tigerbeetle:3000')
DELTA_BASE_PATH = os.getenv('DELTA_BASE_PATH', 's3a://lakehouse/delta')
RECONCILIATION_THRESHOLD_PCT = float(os.getenv('RECONCILIATION_THRESHOLD_PCT', '0.001'))


@dataclass
class AccountBalance:
    account_id: str
    participant_id: str
    participant_name: str
    debits_pending: int
    debits_posted: int
    credits_pending: int
    credits_posted: int
    balance: int
    currency: str


@dataclass
class ReconciliationResult:
    account_id: str
    participant_id: str
    tigerbeetle_balance: int
    delta_lake_balance: int
    discrepancy: int
    discrepancy_pct: float
    status: str  # MATCHED, DISCREPANCY, CRITICAL
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ReconciliationReport:
    report_id: str
    generated_at: str
    period_start: str
    period_end: str
    total_accounts: int
    matched: int
    discrepancies: int
    critical: int
    total_tigerbeetle_balance: int
    total_delta_lake_balance: int
    total_discrepancy: int
    results: List[ReconciliationResult]
    status: str  # HEALTHY, WARNING, CRITICAL


class TigerBeetleClient:
    """Client for querying TigerBeetle ledger"""
    
    def __init__(self, addresses: str = TIGERBEETLE_ADDRESSES):
        self.addresses = addresses.split(',')
        self._client = None
    
    async def connect(self):
        """Connect to TigerBeetle cluster"""
        try:
            # In production, use actual TigerBeetle client
            # import tigerbeetle
            # self._client = tigerbeetle.Client(self.addresses)
            logger.info(f"Connected to TigerBeetle at {self.addresses}")
        except Exception as e:
            logger.error(f"Failed to connect to TigerBeetle: {e}")
            raise
    
    async def get_all_account_balances(self) -> List[AccountBalance]:
        """Get all account balances from TigerBeetle"""
        # In production, query TigerBeetle for all accounts
        # For now, return simulated data
        
        accounts = [
            AccountBalance(
                account_id="1001",
                participant_id="firstbank",
                participant_name="First Bank of Nigeria",
                debits_pending=0,
                debits_posted=5234567890,
                credits_pending=0,
                credits_posted=5111111111,
                balance=123456779,
                currency="NGN"
            ),
            AccountBalance(
                account_id="1002",
                participant_id="gtbank",
                participant_name="Guaranty Trust Bank",
                debits_pending=0,
                debits_posted=4567890123,
                credits_pending=0,
                credits_posted=4469124691,
                balance=98765432,
                currency="NGN"
            ),
            AccountBalance(
                account_id="1003",
                participant_id="mtn-momo",
                participant_name="MTN Mobile Money",
                debits_pending=0,
                debits_posted=2345678901,
                credits_pending=0,
                credits_posted=2291357803,
                balance=54321098,
                currency="NGN"
            ),
            AccountBalance(
                account_id="1004",
                participant_id="zenith",
                participant_name="Zenith Bank",
                debits_pending=0,
                debits_posted=3456789012,
                credits_pending=0,
                credits_posted=3419753087,
                balance=37035925,
                currency="NGN"
            ),
        ]
        
        return accounts
    
    async def get_account_balance(self, account_id: str) -> Optional[AccountBalance]:
        """Get balance for a specific account"""
        accounts = await self.get_all_account_balances()
        for account in accounts:
            if account.account_id == account_id:
                return account
        return None


class DeltaLakeClient:
    """Client for querying Delta Lake transaction data"""
    
    def __init__(self, base_path: str = DELTA_BASE_PATH):
        self.base_path = base_path
        self._spark = None
    
    async def connect(self):
        """Initialize Spark session for Delta Lake queries"""
        try:
            # In production, create Spark session
            # from pyspark.sql import SparkSession
            # self._spark = SparkSession.builder...
            logger.info(f"Connected to Delta Lake at {self.base_path}")
        except Exception as e:
            logger.error(f"Failed to connect to Delta Lake: {e}")
            raise
    
    async def get_account_transaction_totals(self, period_start: datetime, period_end: datetime) -> Dict[str, Dict[str, int]]:
        """Get transaction totals per account from Delta Lake"""
        # In production, query Delta Lake silver.transactions table
        # SELECT 
        #   participant_id,
        #   SUM(CASE WHEN direction = 'DEBIT' THEN amount ELSE 0 END) as total_debits,
        #   SUM(CASE WHEN direction = 'CREDIT' THEN amount ELSE 0 END) as total_credits
        # FROM silver.transactions
        # WHERE status = 'COMMITTED' AND timestamp BETWEEN ? AND ?
        # GROUP BY participant_id
        
        # Simulated data matching TigerBeetle
        return {
            "firstbank": {"debits": 5234567890, "credits": 5111111111, "balance": 123456779},
            "gtbank": {"debits": 4567890123, "credits": 4469124691, "balance": 98765432},
            "mtn-momo": {"debits": 2345678901, "credits": 2291357803, "balance": 54321098},
            "zenith": {"debits": 3456789012, "credits": 3419753087, "balance": 37035925},
        }
    
    async def get_transaction_count(self, period_start: datetime, period_end: datetime) -> int:
        """Get total transaction count for period"""
        # In production, query Delta Lake
        return 1234567


class ReconciliationJob:
    """Job for reconciling TigerBeetle with Delta Lake"""
    
    def __init__(
        self,
        redis_url: str = REDIS_URL,
        threshold_pct: float = RECONCILIATION_THRESHOLD_PCT
    ):
        self.redis_url = redis_url
        self.threshold_pct = threshold_pct
        self.redis_client: Optional[redis.Redis] = None
        self.tigerbeetle = TigerBeetleClient()
        self.delta_lake = DeltaLakeClient()
        self.prefix = "reconciliation:"
    
    async def initialize(self):
        """Initialize connections"""
        try:
            self.redis_client = redis.from_url(self.redis_url, decode_responses=True)
            self.redis_client.ping()
            await self.tigerbeetle.connect()
            await self.delta_lake.connect()
            logger.info("Reconciliation job initialized")
        except Exception as e:
            logger.error(f"Failed to initialize reconciliation job: {e}")
            raise
    
    async def run(self, period_start: Optional[datetime] = None, period_end: Optional[datetime] = None) -> ReconciliationReport:
        """Run reconciliation job"""
        if period_end is None:
            period_end = datetime.utcnow()
        if period_start is None:
            period_start = period_end - timedelta(hours=24)
        
        report_id = f"recon-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}"
        logger.info(f"Starting reconciliation job {report_id}")
        
        # Get TigerBeetle balances
        tb_accounts = await self.tigerbeetle.get_all_account_balances()
        
        # Get Delta Lake transaction totals
        dl_totals = await self.delta_lake.get_account_transaction_totals(period_start, period_end)
        
        # Compare and generate results
        results = []
        total_tb_balance = 0
        total_dl_balance = 0
        matched = 0
        discrepancies = 0
        critical = 0
        
        for account in tb_accounts:
            tb_balance = account.balance
            total_tb_balance += tb_balance
            
            dl_data = dl_totals.get(account.participant_id, {})
            dl_balance = dl_data.get('balance', 0)
            total_dl_balance += dl_balance
            
            discrepancy = abs(tb_balance - dl_balance)
            discrepancy_pct = (discrepancy / tb_balance * 100) if tb_balance > 0 else 0
            
            if discrepancy_pct < self.threshold_pct:
                status = "MATCHED"
                matched += 1
            elif discrepancy_pct < 1.0:
                status = "DISCREPANCY"
                discrepancies += 1
            else:
                status = "CRITICAL"
                critical += 1
            
            results.append(ReconciliationResult(
                account_id=account.account_id,
                participant_id=account.participant_id,
                tigerbeetle_balance=tb_balance,
                delta_lake_balance=dl_balance,
                discrepancy=discrepancy,
                discrepancy_pct=discrepancy_pct,
                status=status,
                details={
                    'participant_name': account.participant_name,
                    'currency': account.currency,
                    'tb_debits_posted': account.debits_posted,
                    'tb_credits_posted': account.credits_posted,
                    'dl_debits': dl_data.get('debits', 0),
                    'dl_credits': dl_data.get('credits', 0)
                }
            ))
        
        # Determine overall status
        if critical > 0:
            overall_status = "CRITICAL"
        elif discrepancies > 0:
            overall_status = "WARNING"
        else:
            overall_status = "HEALTHY"
        
        report = ReconciliationReport(
            report_id=report_id,
            generated_at=datetime.utcnow().isoformat(),
            period_start=period_start.isoformat(),
            period_end=period_end.isoformat(),
            total_accounts=len(tb_accounts),
            matched=matched,
            discrepancies=discrepancies,
            critical=critical,
            total_tigerbeetle_balance=total_tb_balance,
            total_delta_lake_balance=total_dl_balance,
            total_discrepancy=abs(total_tb_balance - total_dl_balance),
            results=results,
            status=overall_status
        )
        
        # Store report
        self._store_report(report)
        
        # Send alerts if critical
        if overall_status == "CRITICAL":
            await self._send_alert(report)
        
        logger.info(f"Reconciliation complete: {overall_status} - {matched} matched, {discrepancies} discrepancies, {critical} critical")
        
        return report
    
    def _store_report(self, report: ReconciliationReport):
        """Store report in Redis"""
        key = f"{self.prefix}report:{report.report_id}"
        
        report_data = {
            'report_id': report.report_id,
            'generated_at': report.generated_at,
            'period_start': report.period_start,
            'period_end': report.period_end,
            'total_accounts': report.total_accounts,
            'matched': report.matched,
            'discrepancies': report.discrepancies,
            'critical': report.critical,
            'total_tigerbeetle_balance': report.total_tigerbeetle_balance,
            'total_delta_lake_balance': report.total_delta_lake_balance,
            'total_discrepancy': report.total_discrepancy,
            'status': report.status,
            'results': [
                {
                    'account_id': r.account_id,
                    'participant_id': r.participant_id,
                    'tigerbeetle_balance': r.tigerbeetle_balance,
                    'delta_lake_balance': r.delta_lake_balance,
                    'discrepancy': r.discrepancy,
                    'discrepancy_pct': r.discrepancy_pct,
                    'status': r.status,
                    'details': r.details
                }
                for r in report.results
            ]
        }
        
        self.redis_client.setex(key, 86400 * 30, json.dumps(report_data))  # 30 days TTL
        self.redis_client.set(f"{self.prefix}latest", report.report_id)
    
    async def _send_alert(self, report: ReconciliationReport):
        """Send alert for critical discrepancies"""
        # In production, send to PagerDuty/OpsGenie/Slack
        logger.critical(f"RECONCILIATION ALERT: {report.critical} critical discrepancies found!")
        
        # Store alert
        alert = {
            'type': 'RECONCILIATION_CRITICAL',
            'report_id': report.report_id,
            'timestamp': datetime.utcnow().isoformat(),
            'critical_count': report.critical,
            'total_discrepancy': report.total_discrepancy
        }
        self.redis_client.lpush(f"{self.prefix}alerts", json.dumps(alert))
    
    def get_latest_report(self) -> Optional[Dict[str, Any]]:
        """Get the latest reconciliation report"""
        latest_id = self.redis_client.get(f"{self.prefix}latest")
        if not latest_id:
            return None
        
        report_data = self.redis_client.get(f"{self.prefix}report:{latest_id}")
        return json.loads(report_data) if report_data else None
    
    def get_report_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get reconciliation report history"""
        pattern = f"{self.prefix}report:*"
        keys = self.redis_client.keys(pattern)
        
        reports = []
        for key in sorted(keys, reverse=True)[:limit]:
            report_data = self.redis_client.get(key)
            if report_data:
                reports.append(json.loads(report_data))
        
        return reports


async def run_reconciliation():
    """Entry point for running reconciliation job"""
    job = ReconciliationJob()
    await job.initialize()
    report = await job.run()
    return report


if __name__ == "__main__":
    asyncio.run(run_reconciliation())
