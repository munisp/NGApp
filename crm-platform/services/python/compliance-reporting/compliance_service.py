"""
Compliance Reporting Service — NDPR, CBN, PCI-DSS, and AML/KYC compliance
monitoring, automated report generation, and regulatory filing support.
"""

import json
import uuid
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field, asdict

class ComplianceFramework(str, Enum):
    NDPR = "ndpr"           # Nigeria Data Protection Regulation
    CBN = "cbn"             # Central Bank of Nigeria guidelines
    PCI_DSS = "pci_dss"     # Payment Card Industry Data Security Standard
    AML_CFT = "aml_cft"     # Anti-Money Laundering / Counter-Financing of Terrorism
    KYC = "kyc"             # Know Your Customer
    SOX = "sox"             # Sarbanes-Oxley (for listed entities)
    ISO_27001 = "iso_27001" # Information Security Management
    NIST = "nist"           # NIST Cybersecurity Framework

class ComplianceStatus(str, Enum):
    COMPLIANT = "compliant"
    PARTIALLY_COMPLIANT = "partially_compliant"
    NON_COMPLIANT = "non_compliant"
    NOT_ASSESSED = "not_assessed"
    REMEDIATION = "remediation"

class RiskLevel(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"

@dataclass
class ComplianceControl:
    id: str
    framework: ComplianceFramework
    control_id: str
    title: str
    description: str
    status: ComplianceStatus
    risk_level: RiskLevel
    evidence: List[str] = field(default_factory=list)
    remediation: str = ""
    owner: str = ""
    due_date: Optional[str] = None
    last_assessed: Optional[str] = None
    automated: bool = False

@dataclass
class ComplianceReport:
    id: str
    tenant_id: str
    framework: ComplianceFramework
    title: str
    period_start: str
    period_end: str
    generated_at: str
    overall_status: ComplianceStatus
    overall_score: float
    total_controls: int
    compliant_controls: int
    non_compliant_controls: int
    partially_compliant_controls: int
    controls: List[ComplianceControl]
    findings: List[Dict[str, Any]]
    recommendations: List[str]
    executive_summary: str

@dataclass
class AMLTransaction:
    id: str
    tenant_id: str
    transaction_id: str
    customer_id: str
    amount: float
    currency: str
    transaction_type: str
    risk_score: float
    is_suspicious: bool
    sar_filed: bool
    flags: List[str]
    timestamp: str

@dataclass
class KYCRecord:
    id: str
    tenant_id: str
    customer_id: str
    customer_name: str
    bvn_verified: bool
    nin_verified: bool
    address_verified: bool
    pep_screened: bool
    sanctions_screened: bool
    risk_category: str
    kyc_level: int  # 1=basic, 2=standard, 3=enhanced
    last_review: str
    next_review: str
    status: str

class ComplianceService:
    def __init__(self):
        self.controls = {}
        self.reports = {}
        self.aml_transactions = {}
        self.kyc_records = {}
        self._seed_controls()
        self._seed_aml_data()
        self._seed_kyc_data()

    def _seed_controls(self):
        frameworks = {
            ComplianceFramework.NDPR: [
                ("NDPR-1.1", "Data Protection Officer", "Designated DPO for data protection oversight", ComplianceStatus.COMPLIANT),
                ("NDPR-1.2", "Privacy Impact Assessment", "Conduct PIA for new data processing activities", ComplianceStatus.COMPLIANT),
                ("NDPR-2.1", "Consent Management", "Obtain explicit consent for data collection", ComplianceStatus.COMPLIANT),
                ("NDPR-2.2", "Data Subject Rights", "Enable data access, rectification, and erasure requests", ComplianceStatus.PARTIALLY_COMPLIANT),
                ("NDPR-3.1", "Data Breach Notification", "72-hour breach notification to NITDA", ComplianceStatus.COMPLIANT),
                ("NDPR-3.2", "Cross-Border Data Transfer", "Adequate protection for international transfers", ComplianceStatus.COMPLIANT),
                ("NDPR-4.1", "Data Retention Policy", "Defined retention periods per data category", ComplianceStatus.COMPLIANT),
                ("NDPR-4.2", "Data Disposal", "Secure disposal of data beyond retention period", ComplianceStatus.PARTIALLY_COMPLIANT),
            ],
            ComplianceFramework.CBN: [
                ("CBN-1.1", "Capital Adequacy", "Minimum capital requirements maintained", ComplianceStatus.COMPLIANT),
                ("CBN-1.2", "Liquidity Ratio", "Minimum 30% liquidity ratio", ComplianceStatus.COMPLIANT),
                ("CBN-2.1", "KYC Level 1", "Basic KYC for all customers", ComplianceStatus.COMPLIANT),
                ("CBN-2.2", "KYC Level 3", "Enhanced due diligence for high-risk customers", ComplianceStatus.COMPLIANT),
                ("CBN-3.1", "Transaction Reporting", "CTR filing for transactions > NGN 5M", ComplianceStatus.COMPLIANT),
                ("CBN-3.2", "SAR Filing", "Suspicious Activity Reports within 24 hours", ComplianceStatus.COMPLIANT),
                ("CBN-4.1", "Agent Banking Guidelines", "Agent network compliance per CBN circular", ComplianceStatus.COMPLIANT),
                ("CBN-4.2", "Mobile Money Regulations", "Mobile money service compliance", ComplianceStatus.COMPLIANT),
                ("CBN-5.1", "IT Risk Management", "IT risk framework per CBN guidelines", ComplianceStatus.COMPLIANT),
                ("CBN-5.2", "Cybersecurity Framework", "CBN cybersecurity compliance", ComplianceStatus.PARTIALLY_COMPLIANT),
            ],
            ComplianceFramework.PCI_DSS: [
                ("PCI-1.1", "Network Segmentation", "Cardholder data environment segmented", ComplianceStatus.COMPLIANT),
                ("PCI-2.1", "Encryption at Rest", "AES-256 encryption for stored card data", ComplianceStatus.COMPLIANT),
                ("PCI-2.2", "Encryption in Transit", "TLS 1.3 for all card data transmission", ComplianceStatus.COMPLIANT),
                ("PCI-3.1", "Access Control", "Least privilege access to card data", ComplianceStatus.COMPLIANT),
                ("PCI-4.1", "Vulnerability Scanning", "Quarterly ASV scans", ComplianceStatus.COMPLIANT),
                ("PCI-4.2", "Penetration Testing", "Annual pen test by QSA", ComplianceStatus.PARTIALLY_COMPLIANT),
                ("PCI-5.1", "Logging & Monitoring", "All access to card data logged", ComplianceStatus.COMPLIANT),
                ("PCI-6.1", "Incident Response", "IR plan tested annually", ComplianceStatus.COMPLIANT),
            ],
            ComplianceFramework.AML_CFT: [
                ("AML-1.1", "AML Policy", "Board-approved AML/CFT policy", ComplianceStatus.COMPLIANT),
                ("AML-1.2", "MLRO Designation", "Money Laundering Reporting Officer appointed", ComplianceStatus.COMPLIANT),
                ("AML-2.1", "Transaction Monitoring", "Real-time transaction screening", ComplianceStatus.COMPLIANT),
                ("AML-2.2", "Sanctions Screening", "OFAC, EU, UN sanctions list screening", ComplianceStatus.COMPLIANT),
                ("AML-3.1", "STR Filing", "Suspicious Transaction Reports to NFIU", ComplianceStatus.COMPLIANT),
                ("AML-3.2", "CTR Filing", "Currency Transaction Reports for > NGN 5M", ComplianceStatus.COMPLIANT),
                ("AML-4.1", "Staff Training", "Annual AML/CFT training for all staff", ComplianceStatus.COMPLIANT),
                ("AML-4.2", "Risk Assessment", "Annual ML/TF risk assessment", ComplianceStatus.COMPLIANT),
            ],
        }

        for framework, controls in frameworks.items():
            for ctrl_id, title, desc, status in controls:
                control = ComplianceControl(
                    id=str(uuid.uuid4())[:8],
                    framework=framework,
                    control_id=ctrl_id,
                    title=title,
                    description=desc,
                    status=status,
                    risk_level=RiskLevel.LOW if status == ComplianceStatus.COMPLIANT else RiskLevel.MEDIUM,
                    evidence=[f"Evidence-{ctrl_id}-001", f"Evidence-{ctrl_id}-002"],
                    owner="compliance-team",
                    last_assessed=datetime.utcnow().isoformat(),
                    automated=True,
                )
                key = f"{framework.value}:{ctrl_id}"
                self.controls[key] = control

    def _seed_aml_data(self):
        tenants = ["tenant-acme-bank", "tenant-quickcash", "tenant-swiftremit", "tenant-nextgen-mfb"]
        for tenant_id in tenants:
            txns = []
            for i in range(20):
                is_suspicious = i % 7 == 0
                txn = AMLTransaction(
                    id=str(uuid.uuid4())[:8],
                    tenant_id=tenant_id,
                    transaction_id=f"txn-{tenant_id[-4:]}-{i:04d}",
                    customer_id=f"cust-{i:04d}",
                    amount=float(50000 + i * 12500),
                    currency="NGN",
                    transaction_type=["transfer", "cash_deposit", "withdrawal", "remittance"][i % 4],
                    risk_score=0.85 if is_suspicious else 0.15 + (i % 10) * 0.05,
                    is_suspicious=is_suspicious,
                    sar_filed=is_suspicious and i % 2 == 0,
                    flags=["high_value", "unusual_pattern"] if is_suspicious else [],
                    timestamp=datetime.utcnow().isoformat(),
                )
                txns.append(txn)
            self.aml_transactions[tenant_id] = txns

    def _seed_kyc_data(self):
        tenants_data = {
            "tenant-acme-bank": [
                ("Adebayo Okonkwo", True, True, True, True, True, "low", 3, "compliant"),
                ("Fatima Ibrahim", True, True, True, True, True, "low", 3, "compliant"),
                ("Chinedu Eze", True, False, True, True, True, "medium", 2, "pending_review"),
                ("Amina Mohammed", True, True, False, False, True, "high", 1, "under_review"),
                ("Olumide Adeyemi", True, True, True, True, True, "low", 3, "compliant"),
            ],
            "tenant-nextgen-mfb": [
                ("Musa Bello", True, False, True, True, True, "medium", 2, "compliant"),
                ("Ngozi Okwu", True, True, True, True, True, "low", 3, "compliant"),
            ],
        }
        for tenant_id, customers in tenants_data.items():
            records = []
            for i, (name, bvn, nin, addr, pep, sanctions, risk, level, status) in enumerate(customers):
                records.append(KYCRecord(
                    id=str(uuid.uuid4())[:8], tenant_id=tenant_id,
                    customer_id=f"cust-{i:04d}", customer_name=name,
                    bvn_verified=bvn, nin_verified=nin, address_verified=addr,
                    pep_screened=pep, sanctions_screened=sanctions,
                    risk_category=risk, kyc_level=level,
                    last_review=datetime.utcnow().isoformat(),
                    next_review=(datetime.utcnow() + timedelta(days=365)).isoformat(),
                    status=status,
                ))
            self.kyc_records[tenant_id] = records

    def generate_compliance_report(self, tenant_id: str, framework: ComplianceFramework) -> ComplianceReport:
        framework_controls = [c for c in self.controls.values() if c.framework == framework]
        compliant = sum(1 for c in framework_controls if c.status == ComplianceStatus.COMPLIANT)
        non_compliant = sum(1 for c in framework_controls if c.status == ComplianceStatus.NON_COMPLIANT)
        partial = sum(1 for c in framework_controls if c.status == ComplianceStatus.PARTIALLY_COMPLIANT)
        total = len(framework_controls)
        score = (compliant + partial * 0.5) / total * 100 if total > 0 else 0

        overall = ComplianceStatus.COMPLIANT if score >= 90 else (
            ComplianceStatus.PARTIALLY_COMPLIANT if score >= 70 else ComplianceStatus.NON_COMPLIANT
        )

        findings = []
        for c in framework_controls:
            if c.status != ComplianceStatus.COMPLIANT:
                findings.append({
                    "control_id": c.control_id,
                    "title": c.title,
                    "status": c.status.value,
                    "risk_level": c.risk_level.value,
                    "remediation": c.remediation or "Implement corrective measures per control requirements",
                })

        report = ComplianceReport(
            id=str(uuid.uuid4())[:8], tenant_id=tenant_id, framework=framework,
            title=f"{framework.value.upper()} Compliance Report",
            period_start=(datetime.utcnow() - timedelta(days=90)).isoformat(),
            period_end=datetime.utcnow().isoformat(),
            generated_at=datetime.utcnow().isoformat(),
            overall_status=overall, overall_score=round(score, 1),
            total_controls=total, compliant_controls=compliant,
            non_compliant_controls=non_compliant, partially_compliant_controls=partial,
            controls=framework_controls, findings=findings,
            recommendations=[
                f"Address {len(findings)} outstanding findings",
                "Schedule quarterly compliance reviews",
                "Update evidence documentation",
                "Conduct staff training on {framework.value.upper()} requirements",
            ],
            executive_summary=f"The organization demonstrates {overall.value.replace('_', ' ')} "
                f"with {framework.value.upper()} requirements. Score: {score:.1f}%. "
                f"{compliant}/{total} controls fully implemented.",
        )
        self.reports[report.id] = report
        return report

    def get_aml_dashboard(self, tenant_id: str) -> Dict[str, Any]:
        txns = self.aml_transactions.get(tenant_id, [])
        suspicious = [t for t in txns if t.is_suspicious]
        sars_filed = [t for t in suspicious if t.sar_filed]
        total_amount = sum(t.amount for t in txns)
        return {
            "tenant_id": tenant_id,
            "total_transactions": len(txns),
            "total_amount": total_amount,
            "suspicious_transactions": len(suspicious),
            "sar_filed": len(sars_filed),
            "avg_risk_score": sum(t.risk_score for t in txns) / len(txns) if txns else 0,
            "high_risk_count": sum(1 for t in txns if t.risk_score > 0.7),
            "transactions": [asdict(t) for t in txns[:10]],
        }

    def get_kyc_dashboard(self, tenant_id: str) -> Dict[str, Any]:
        records = self.kyc_records.get(tenant_id, [])
        return {
            "tenant_id": tenant_id,
            "total_customers": len(records),
            "bvn_verified": sum(1 for r in records if r.bvn_verified),
            "nin_verified": sum(1 for r in records if r.nin_verified),
            "pep_screened": sum(1 for r in records if r.pep_screened),
            "sanctions_screened": sum(1 for r in records if r.sanctions_screened),
            "by_risk": {
                "low": sum(1 for r in records if r.risk_category == "low"),
                "medium": sum(1 for r in records if r.risk_category == "medium"),
                "high": sum(1 for r in records if r.risk_category == "high"),
            },
            "by_kyc_level": {
                "level_1": sum(1 for r in records if r.kyc_level == 1),
                "level_2": sum(1 for r in records if r.kyc_level == 2),
                "level_3": sum(1 for r in records if r.kyc_level == 3),
            },
            "records": [asdict(r) for r in records],
        }

    def get_overall_compliance_score(self, tenant_id: str) -> Dict[str, Any]:
        scores = {}
        for fw in ComplianceFramework:
            controls = [c for c in self.controls.values() if c.framework == fw]
            if controls:
                compliant = sum(1 for c in controls if c.status == ComplianceStatus.COMPLIANT)
                partial = sum(1 for c in controls if c.status == ComplianceStatus.PARTIALLY_COMPLIANT)
                scores[fw.value] = round((compliant + partial * 0.5) / len(controls) * 100, 1)
        avg_score = sum(scores.values()) / len(scores) if scores else 0
        return {
            "tenant_id": tenant_id,
            "overall_score": round(avg_score, 1),
            "framework_scores": scores,
            "status": "compliant" if avg_score >= 90 else "partially_compliant" if avg_score >= 70 else "non_compliant",
            "assessed_at": datetime.utcnow().isoformat(),
        }


# FastAPI application
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Compliance Reporting Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

service = ComplianceService()

@app.get("/health")
def health():
    return {"status": "healthy", "service": "compliance-reporting"}

@app.get("/api/v1/compliance/score")
def get_score(tenant_id: str = "tenant-acme-bank"):
    return service.get_overall_compliance_score(tenant_id)

@app.get("/api/v1/compliance/report/{framework}")
def get_report(framework: str, tenant_id: str = "tenant-acme-bank"):
    fw = ComplianceFramework(framework)
    report = service.generate_compliance_report(tenant_id, fw)
    return asdict(report)

@app.get("/api/v1/compliance/controls")
def list_controls(framework: Optional[str] = None):
    controls = list(service.controls.values())
    if framework:
        controls = [c for c in controls if c.framework.value == framework]
    return [asdict(c) for c in controls]

@app.get("/api/v1/compliance/aml")
def get_aml(tenant_id: str = "tenant-acme-bank"):
    return service.get_aml_dashboard(tenant_id)

@app.get("/api/v1/compliance/kyc")
def get_kyc(tenant_id: str = "tenant-acme-bank"):
    return service.get_kyc_dashboard(tenant_id)

@app.get("/api/v1/compliance/frameworks")
def list_frameworks():
    return [{"id": fw.value, "name": fw.name} for fw in ComplianceFramework]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8086)
