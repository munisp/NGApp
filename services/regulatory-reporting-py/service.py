"""54Bank Regulatory Reporting Service (Python)

Implements CBN/NDIC regulatory compliance reporting:
  - CBN statutory returns generation
  - NDIC deposit insurance reports
  - AML/CFT suspicious transaction reports (STR)
  - Currency transaction reports (CTR)
  - Capital adequacy ratio calculations
  - Liquidity ratio monitoring
  - IFRS 9 expected credit loss (ECL) provisioning

Middleware: Kafka, Redis, Temporal, Postgres, OpenSearch, Lakehouse, Permify
"""

import json
import sys
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "middleware-py"))
from middleware import (
    Bundle, gen_id, now_iso, default_tenant, record_audit,
    parse_json_body, respond_json,
)

bundle = Bundle()
reports: dict[str, dict] = {}
str_filings: list[dict] = []  # Suspicious Transaction Reports
ctr_filings: list[dict] = []  # Currency Transaction Reports

REPORT_TYPES = [
    "cbn_statutory_return", "ndic_deposit_insurance", "aml_str",
    "aml_ctr", "capital_adequacy", "liquidity_ratio",
    "ifrs9_ecl", "forex_exposure", "credit_concentration",
]


def compute_capital_adequacy(tier1_capital: float, tier2_capital: float, rwa: float) -> dict:
    """Calculate CAR per Basel III / CBN prudential guidelines."""
    total_capital = tier1_capital + tier2_capital
    car = (total_capital / rwa * 100) if rwa > 0 else 0
    cet1_ratio = (tier1_capital / rwa * 100) if rwa > 0 else 0
    return {
        "tier1Capital": tier1_capital,
        "tier2Capital": tier2_capital,
        "totalCapital": total_capital,
        "riskWeightedAssets": rwa,
        "capitalAdequacyRatio": round(car, 2),
        "cet1Ratio": round(cet1_ratio, 2),
        "minimumCAR": 15.0,  # CBN minimum for systemically important banks
        "compliant": car >= 15.0,
    }


def compute_liquidity_ratio(liquid_assets: float, total_deposits: float) -> dict:
    """CBN minimum liquidity ratio is 30%."""
    ratio = (liquid_assets / total_deposits * 100) if total_deposits > 0 else 0
    return {
        "liquidAssets": liquid_assets,
        "totalDeposits": total_deposits,
        "liquidityRatio": round(ratio, 2),
        "minimumRequired": 30.0,
        "compliant": ratio >= 30.0,
    }


def compute_ecl_provision(exposure: float, pd: float, lgd: float, stage: int) -> dict:
    """IFRS 9 Expected Credit Loss calculation."""
    if stage == 1:
        ecl = exposure * pd * lgd  # 12-month ECL
    elif stage == 2:
        ecl = exposure * pd * lgd * 3  # Lifetime ECL (simplified)
    else:
        ecl = exposure * lgd  # Stage 3: credit-impaired
    return {
        "exposure": exposure,
        "probabilityOfDefault": pd,
        "lossGivenDefault": lgd,
        "stage": stage,
        "eclAmount": round(ecl, 2),
        "provisionRate": round((ecl / exposure * 100) if exposure > 0 else 0, 2),
    }


class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        respond_json(self, 204, "")

    def do_GET(self):
        path = self.path.split("?")[0]

        if path == "/healthz":
            respond_json(self, 200, {
                "status": "ok",
                "service": "regulatory-reporting-py",
                "timestamp": now_iso(),
                "middleware": ["Kafka", "Redis", "Temporal", "Postgres", "OpenSearch", "Lakehouse", "Permify"],
                "health": bundle.health_map(),
            })
        elif path == "/v1/regulatory/reports":
            respond_json(self, 200, {"items": list(reports.values()), "total": len(reports)})
        elif path.startswith("/v1/regulatory/reports/"):
            rid = path.replace("/v1/regulatory/reports/", "").split("/")[0]
            if rid in reports:
                respond_json(self, 200, reports[rid])
            else:
                respond_json(self, 404, {"message": "Report not found"})
        elif path == "/v1/regulatory/report-types":
            respond_json(self, 200, {"types": REPORT_TYPES})
        elif path == "/v1/regulatory/str-filings":
            respond_json(self, 200, {"items": str_filings, "total": len(str_filings)})
        elif path == "/v1/regulatory/ctr-filings":
            respond_json(self, 200, {"items": ctr_filings, "total": len(ctr_filings)})
        else:
            respond_json(self, 404, {"message": "Not found"})

    def do_POST(self):
        path = self.path.split("?")[0]
        body = parse_json_body(self)

        if path == "/v1/regulatory/reports":
            self._generate_report(body)
        elif path == "/v1/regulatory/str-filings":
            self._file_str(body)
        elif path == "/v1/regulatory/ctr-filings":
            self._file_ctr(body)
        elif path == "/v1/regulatory/capital-adequacy":
            self._calc_car(body)
        elif path == "/v1/regulatory/liquidity-ratio":
            self._calc_liquidity(body)
        elif path == "/v1/regulatory/ecl-provision":
            self._calc_ecl(body)
        elif path.startswith("/v1/regulatory/reports/"):
            parts = path.replace("/v1/regulatory/reports/", "").split("/")
            rid = parts[0]
            if rid not in reports:
                respond_json(self, 404, {"message": "Report not found"})
                return
            if len(parts) > 1 and parts[1] == "submit":
                self._submit_report(rid)
        else:
            respond_json(self, 404, {"message": "Not found"})

    def _generate_report(self, body: dict):
        report_type = body.get("reportType")
        if report_type not in REPORT_TYPES:
            respond_json(self, 400, {
                "message": f"Invalid reportType. Must be one of: {', '.join(REPORT_TYPES)}"
            })
            return

        report = {
            "id": gen_id("REG"),
            "tenantId": default_tenant(),
            "reportType": report_type,
            "period": body.get("period", datetime.now(timezone.utc).strftime("%Y-%m")),
            "status": "generated",
            "submittedTo": None,
            "submittedAt": None,
            "data": body.get("data", {}),
            "summary": self._generate_summary(report_type, body.get("data", {})),
            "createdAt": now_iso(),
            "updatedAt": now_iso(),
        }
        reports[report["id"]] = report
        bundle.kafka.publish("regulatory.report.generated", report["id"], report)
        bundle.lakehouse.publish("regulatory_reports", [report])
        respond_json(self, 201, report)

    def _generate_summary(self, report_type: str, data: dict) -> dict:
        if report_type == "capital_adequacy":
            return compute_capital_adequacy(
                data.get("tier1Capital", 50_000_000_000),
                data.get("tier2Capital", 10_000_000_000),
                data.get("riskWeightedAssets", 300_000_000_000),
            )
        elif report_type == "liquidity_ratio":
            return compute_liquidity_ratio(
                data.get("liquidAssets", 100_000_000_000),
                data.get("totalDeposits", 250_000_000_000),
            )
        return {"note": f"Summary for {report_type}"}

    def _submit_report(self, rid: str):
        report = reports[rid]
        if report["status"] != "generated":
            respond_json(self, 400, {"message": "Report must be in generated status"})
            return

        regulator = "CBN" if "cbn" in report["reportType"] else "NDIC" if "ndic" in report["reportType"] else "NFIU"
        report["status"] = "submitted"
        report["submittedTo"] = regulator
        report["submittedAt"] = now_iso()
        report["updatedAt"] = now_iso()
        bundle.kafka.publish("regulatory.report.submitted", rid, report)
        record_audit("regulatory-reporting", "report_submitted", rid, details={"regulator": regulator})
        respond_json(self, 200, report)

    def _file_str(self, body: dict):
        if not body.get("customerName") or not body.get("suspiciousActivity"):
            respond_json(self, 400, {"message": "customerName and suspiciousActivity required"})
            return

        filing = {
            "id": gen_id("STR"),
            "tenantId": default_tenant(),
            "customerName": body["customerName"],
            "customerId": body.get("customerId", ""),
            "accountNumber": body.get("accountNumber", ""),
            "suspiciousActivity": body["suspiciousActivity"],
            "transactionAmount": float(body.get("transactionAmount", 0)),
            "reportedBy": body.get("reportedBy", "compliance-officer"),
            "status": "filed",
            "filedAt": now_iso(),
        }
        str_filings.append(filing)
        bundle.kafka.publish("regulatory.str.filed", filing["id"], filing)
        record_audit("regulatory-reporting", "str_filed", filing["id"])
        respond_json(self, 201, filing)

    def _file_ctr(self, body: dict):
        amount = float(body.get("transactionAmount", 0))
        if amount < 5_000_000:
            respond_json(self, 400, {"message": "CTR required for transactions ≥ ₦5,000,000"})
            return

        filing = {
            "id": gen_id("CTR"),
            "tenantId": default_tenant(),
            "customerName": body.get("customerName", ""),
            "customerId": body.get("customerId", ""),
            "transactionType": body.get("transactionType", "cash"),
            "transactionAmount": amount,
            "currency": body.get("currency", "NGN"),
            "status": "filed",
            "filedAt": now_iso(),
        }
        ctr_filings.append(filing)
        bundle.kafka.publish("regulatory.ctr.filed", filing["id"], filing)
        respond_json(self, 201, filing)

    def _calc_car(self, body: dict):
        result = compute_capital_adequacy(
            float(body.get("tier1Capital", 0)),
            float(body.get("tier2Capital", 0)),
            float(body.get("riskWeightedAssets", 0)),
        )
        respond_json(self, 200, result)

    def _calc_liquidity(self, body: dict):
        result = compute_liquidity_ratio(
            float(body.get("liquidAssets", 0)),
            float(body.get("totalDeposits", 0)),
        )
        respond_json(self, 200, result)

    def _calc_ecl(self, body: dict):
        result = compute_ecl_provision(
            float(body.get("exposure", 0)),
            float(body.get("probabilityOfDefault", 0.05)),
            float(body.get("lossGivenDefault", 0.45)),
            int(body.get("stage", 1)),
        )
        respond_json(self, 200, result)

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8104"))
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"Regulatory Reporting service listening on :{port}")
    server.serve_forever()
