"""
Reporting Service
Generates financial and operational reports
"""

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime, timedelta
from enum import Enum
import uvicorn

app = FastAPI(title="Reporting Service")

class ReportType(str, Enum):
    TRANSACTION_SUMMARY = "transaction_summary"
    AGENT_PERFORMANCE = "agent_performance"
    COMMISSION_REPORT = "commission_report"
    FLOAT_UTILIZATION = "float_utilization"
    FRAUD_ANALYSIS = "fraud_analysis"
    RECONCILIATION = "reconciliation"

class ReportFormat(str, Enum):
    PDF = "pdf"
    EXCEL = "excel"
    CSV = "csv"
    JSON = "json"

class ReportRequest(BaseModel):
    reportType: ReportType
    startDate: str
    endDate: str
    format: ReportFormat = ReportFormat.JSON
    filters: Optional[Dict] = {}

class ReportResponse(BaseModel):
    reportId: str
    reportType: str
    status: str
    generatedAt: str
    downloadUrl: Optional[str] = None
    data: Optional[Dict] = None

# In-memory report storage
reports: Dict[str, Dict] = {}

@app.post("/reports/generate")
async def generate_report(request: ReportRequest):
    """Generate a new report"""
    
    report_id = f"RPT-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    
    # Generate report data based on type
    report_data = {}
    
    if request.reportType == ReportType.TRANSACTION_SUMMARY:
        report_data = {
            "totalTransactions": 15234,
            "totalVolume": 45678900,
            "successRate": 98.5,
            "avgTransactionValue": 2998.5,
            "byChannel": {
                "mobile": 12000,
                "web": 2000,
                "ussd": 1234
            }
        }
    
    elif request.reportType == ReportType.AGENT_PERFORMANCE:
        report_data = {
            "totalAgents": 1250,
            "activeAgents": 1100,
            "topPerformers": [
                {"agentId": "AGT-001", "transactions": 450, "volume": 1350000},
                {"agentId": "AGT-002", "transactions": 420, "volume": 1260000},
                {"agentId": "AGT-003", "transactions": 390, "volume": 1170000}
            ],
            "avgTransactionsPerAgent": 12.3
        }
    
    elif request.reportType == ReportType.COMMISSION_REPORT:
        report_data = {
            "totalCommission": 456789,
            "paidCommission": 400000,
            "pendingCommission": 56789,
            "byAgent": [
                {"agentId": "AGT-001", "commission": 15000, "status": "paid"},
                {"agentId": "AGT-002", "commission": 14000, "status": "paid"}
            ]
        }
    
    elif request.reportType == ReportType.FLOAT_UTILIZATION:
        report_data = {
            "totalFloat": 50000000,
            "utilizedFloat": 35000000,
            "availableFloat": 15000000,
            "utilizationRate": 70.0,
            "byAgent": [
                {"agentId": "AGT-001", "allocated": 100000, "utilized": 75000},
                {"agentId": "AGT-002", "allocated": 100000, "utilized": 80000}
            ]
        }
    
    elif request.reportType == ReportType.FRAUD_ANALYSIS:
        report_data = {
            "totalAlerts": 45,
            "confirmedFraud": 12,
            "falsePositives": 33,
            "blockedAmount": 567890,
            "topPatterns": [
                {"pattern": "velocity_fraud", "count": 15},
                {"pattern": "location_mismatch", "count": 10}
            ]
        }
    
    elif request.reportType == ReportType.RECONCILIATION:
        report_data = {
            "totalRecords": 15234,
            "matched": 15200,
            "unmatched": 34,
            "discrepancyAmount": 12345,
            "reconciliationRate": 99.78
        }
    
    # Store report
    reports[report_id] = {
        "reportId": report_id,
        "reportType": request.reportType,
        "startDate": request.startDate,
        "endDate": request.endDate,
        "format": request.format,
        "status": "completed",
        "generatedAt": datetime.utcnow().isoformat(),
        "data": report_data
    }
    
    download_url = f"/reports/{report_id}/download" if request.format != ReportFormat.JSON else None
    
    return ReportResponse(
        reportId=report_id,
        reportType=request.reportType,
        status="completed",
        generatedAt=reports[report_id]["generatedAt"],
        downloadUrl=download_url,
        data=report_data if request.format == ReportFormat.JSON else None
    )

@app.get("/reports/{report_id}")
async def get_report(report_id: str):
    """Get report details"""
    
    if report_id not in reports:
        raise HTTPException(status_code=404, detail="Report not found")
    
    report = reports[report_id]
    
    return ReportResponse(
        reportId=report["reportId"],
        reportType=report["reportType"],
        status=report["status"],
        generatedAt=report["generatedAt"],
        data=report["data"]
    )

@app.get("/reports")
async def list_reports(
    report_type: Optional[ReportType] = None,
    start_date: Optional[str] = None,
    limit: int = Query(10, le=100)
):
    """List reports with filters"""
    
    filtered_reports = list(reports.values())
    
    if report_type:
        filtered_reports = [r for r in filtered_reports if r["reportType"] == report_type]
    
    if start_date:
        filtered_reports = [r for r in filtered_reports if r["startDate"] >= start_date]
    
    return {
        "reports": filtered_reports[:limit],
        "total": len(filtered_reports)
    }

@app.delete("/reports/{report_id}")
async def delete_report(report_id: str):
    """Delete a report"""
    
    if report_id not in reports:
        raise HTTPException(status_code=404, detail="Report not found")
    
    del reports[report_id]
    
    return {"status": "deleted"}

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "reporting-service"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
