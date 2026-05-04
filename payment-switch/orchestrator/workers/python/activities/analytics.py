"""
Analytics and Reporting Activities
Queries real data from Lakehouse (Delta Lake) for analytics
"""

import logging
import os
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

from temporalio import activity

logger = logging.getLogger(__name__)


class LakehouseClient:
    """Client for querying Lakehouse analytics data"""
    
    _instance: Optional['LakehouseClient'] = None
    
    def __init__(self):
        self.query_service = None
        self._initialized = False
    
    @classmethod
    def get_instance(cls) -> 'LakehouseClient':
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    def _ensure_initialized(self):
        if self._initialized:
            return
        try:
            from payment_core.data_integration.lakehouse_query.lakehouse_query_service import get_query_service
            self.query_service = get_query_service()
            self._initialized = True
        except ImportError:
            logger.warning("Lakehouse query service not available, using fallback")
            self.query_service = None
            self._initialized = True
    
    def get_transaction_analytics(self, start_date: str, end_date: str, filters: Optional[Dict] = None) -> Dict[str, Any]:
        self._ensure_initialized()
        if self.query_service:
            return self.query_service.get_transaction_analytics(start_date, end_date, filters)
        return self._fallback_transaction_analytics()
    
    def get_merchant_metrics(self, merchant_id: str, start_date: str, end_date: str) -> Dict[str, Any]:
        self._ensure_initialized()
        if self.query_service:
            return self.query_service.get_merchant_metrics(merchant_id, start_date, end_date)
        return self._fallback_merchant_metrics(merchant_id)
    
    def get_fraud_analytics(self, start_date: str, end_date: str) -> Dict[str, Any]:
        self._ensure_initialized()
        if self.query_service:
            return self.query_service.get_fraud_analytics(start_date, end_date)
        return self._fallback_fraud_analytics()
    
    def get_settlement_analytics(self, start_date: str, end_date: str, provider: Optional[str] = None) -> Dict[str, Any]:
        self._ensure_initialized()
        if self.query_service:
            return self.query_service.get_settlement_analytics(start_date, end_date, provider)
        return self._fallback_settlement_analytics()
    
    def _fallback_transaction_analytics(self) -> Dict[str, Any]:
        return {
            "total_transactions": 0,
            "total_volume": 0,
            "average_transaction_value": 0,
            "success_rate": 0,
            "fraud_rate": 0,
            "payment_methods": {},
            "source": "fallback"
        }
    
    def _fallback_merchant_metrics(self, merchant_id: str) -> Dict[str, Any]:
        return {
            "merchant_id": merchant_id,
            "total_transactions": 0,
            "total_revenue": 0,
            "average_transaction_value": 0,
            "success_rate": 0,
            "refund_rate": 0,
            "unique_customers": 0,
            "source": "fallback"
        }
    
    def _fallback_fraud_analytics(self) -> Dict[str, Any]:
        return {
            "total_scored": 0,
            "average_fraud_score": 0,
            "block_rate": 0,
            "review_rate": 0,
            "allow_rate": 0,
            "source": "fallback"
        }
    
    def _fallback_settlement_analytics(self) -> Dict[str, Any]:
        return {
            "total_settlements": 0,
            "total_settled_amount": 0,
            "average_latency_seconds": 0,
            "success_rate": 0,
            "source": "fallback"
        }


class AnalyticsActivities:
    """Analytics and data processing activities - queries real Lakehouse data"""
    
    def __init__(self):
        self.lakehouse = LakehouseClient.get_instance()
    
    @activity.defn(name="GenerateReport")
    async def generate_report(self, report_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate analytics report from Lakehouse data
        
        Args:
            report_config: Report configuration
            
        Returns:
            Generated report data
        """
        logger.info(f"Generating report: {report_config.get('type')}")
        
        report_type = report_config.get('type', 'transaction_summary')
        start_date = report_config.get('start_date', (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d'))
        end_date = report_config.get('end_date', datetime.now().strftime('%Y-%m-%d'))
        merchant_id = report_config.get('merchant_id')
        
        if report_type == 'merchant_summary' and merchant_id:
            metrics = self.lakehouse.get_merchant_metrics(merchant_id, start_date, end_date)
        elif report_type == 'fraud_analysis':
            metrics = self.lakehouse.get_fraud_analytics(start_date, end_date)
        elif report_type == 'settlement_summary':
            provider = report_config.get('provider')
            metrics = self.lakehouse.get_settlement_analytics(start_date, end_date, provider)
        else:
            filters = report_config.get('filters')
            metrics = self.lakehouse.get_transaction_analytics(start_date, end_date, filters)
        
        report_data = {
            'type': report_type,
            'period': {
                'start': start_date,
                'end': end_date
            },
            'metrics': metrics,
            'generated_at': datetime.now().isoformat(),
            'data_source': metrics.get('source', 'lakehouse')
        }
        
        logger.info(f"Report generation complete, source: {report_data['data_source']}")
        return report_data
    
    @activity.defn(name="CalculateMetrics")
    async def calculate_metrics(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculate business metrics from Lakehouse
        
        Args:
            config: Metrics configuration
            
        Returns:
            Calculated metrics from Lakehouse
        """
        logger.info("Calculating metrics from Lakehouse")
        
        start_date = config.get('start_date', (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d'))
        end_date = config.get('end_date', datetime.now().strftime('%Y-%m-%d'))
        merchant_id = config.get('merchant_id')
        
        if merchant_id:
            lakehouse_metrics = self.lakehouse.get_merchant_metrics(merchant_id, start_date, end_date)
            metrics = {
                'total_transactions': lakehouse_metrics.get('total_transactions', 0),
                'total_revenue': lakehouse_metrics.get('total_revenue', 0),
                'success_rate': lakehouse_metrics.get('success_rate', 0),
                'average_transaction_value': lakehouse_metrics.get('average_transaction_value', 0),
                'refund_rate': lakehouse_metrics.get('refund_rate', 0),
                'unique_customers': lakehouse_metrics.get('unique_customers', 0),
                'source': lakehouse_metrics.get('source', 'lakehouse')
            }
        else:
            txn_analytics = self.lakehouse.get_transaction_analytics(start_date, end_date)
            fraud_analytics = self.lakehouse.get_fraud_analytics(start_date, end_date)
            
            metrics = {
                'total_transactions': txn_analytics.get('total_transactions', 0),
                'total_revenue': txn_analytics.get('total_volume', 0),
                'success_rate': txn_analytics.get('success_rate', 0),
                'average_transaction_value': txn_analytics.get('average_transaction_value', 0),
                'fraud_rate': fraud_analytics.get('block_rate', 0) + fraud_analytics.get('review_rate', 0),
                'payment_methods': txn_analytics.get('payment_methods', {}),
                'source': txn_analytics.get('source', 'lakehouse')
            }
        
        return metrics
    
    @activity.defn(name="AggregateData")
    async def aggregate_data(self, aggregation_config: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Aggregate transaction data from Lakehouse
        
        Args:
            aggregation_config: Aggregation configuration
            
        Returns:
            Aggregated data from Lakehouse
        """
        logger.info("Aggregating data from Lakehouse")
        
        days = aggregation_config.get('days', 30)
        merchant_id = aggregation_config.get('merchant_id')
        aggregated = []
        
        for i in range(days):
            date = datetime.now() - timedelta(days=i)
            date_str = date.strftime('%Y-%m-%d')
            
            if merchant_id:
                day_metrics = self.lakehouse.get_merchant_metrics(merchant_id, date_str, date_str)
            else:
                day_metrics = self.lakehouse.get_transaction_analytics(date_str, date_str)
            
            aggregated.append({
                'date': date_str,
                'transaction_count': day_metrics.get('total_transactions', 0),
                'revenue': day_metrics.get('total_revenue', day_metrics.get('total_volume', 0)),
                'success_rate': day_metrics.get('success_rate', 0),
                'source': day_metrics.get('source', 'lakehouse')
            })
        
        return aggregated
