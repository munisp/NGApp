#!/usr/bin/env python3
"""
Contract Tests for Payment Switch API
Validates API response shapes match TypeScript types
"""

import json
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Any, Optional, List, Set
from enum import Enum

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class FieldType(Enum):
    STRING = "string"
    NUMBER = "number"
    BOOLEAN = "boolean"
    ARRAY = "array"
    OBJECT = "object"
    NULL = "null"
    ANY = "any"


@dataclass
class FieldContract:
    name: str
    field_type: FieldType
    required: bool = True
    nullable: bool = False
    array_item_type: Optional[FieldType] = None
    nested_contract: Optional['TypeContract'] = None


@dataclass
class TypeContract:
    name: str
    fields: List[FieldContract]
    description: str = ""


@dataclass
class ContractViolation:
    path: str
    expected: str
    actual: str
    message: str


# API Response Contracts (matching TypeScript types in admin-dashboard)
NOC_METRICS_CONTRACT = TypeContract(
    name="NOCMetrics",
    description="NOC Dashboard metrics response",
    fields=[
        FieldContract("tps", FieldType.OBJECT, nested_contract=TypeContract(
            name="MetricValue",
            fields=[
                FieldContract("label", FieldType.STRING),
                FieldContract("value", FieldType.ANY),
                FieldContract("trend", FieldType.STRING, required=False),
                FieldContract("change", FieldType.NUMBER, required=False),
            ]
        )),
        FieldContract("success_rate", FieldType.OBJECT),
        FieldContract("avg_latency", FieldType.OBJECT),
        FieldContract("daily_volume", FieldType.OBJECT),
        FieldContract("source", FieldType.STRING, required=False),
    ]
)

FRAUD_METRICS_CONTRACT = TypeContract(
    name="FraudMetrics",
    description="Fraud Dashboard metrics response",
    fields=[
        FieldContract("total_alerts", FieldType.OBJECT),
        FieldContract("critical_alerts", FieldType.OBJECT),
        FieldContract("blocked_amount", FieldType.OBJECT),
        FieldContract("detection_rate", FieldType.OBJECT),
        FieldContract("source", FieldType.STRING, required=False),
    ]
)

SETTLEMENT_METRICS_CONTRACT = TypeContract(
    name="SettlementMetrics",
    description="Settlement Console metrics response",
    fields=[
        FieldContract("pending_settlements", FieldType.OBJECT),
        FieldContract("completed_today", FieldType.OBJECT),
        FieldContract("total_volume", FieldType.OBJECT),
        FieldContract("avg_settlement_time", FieldType.OBJECT),
        FieldContract("source", FieldType.STRING, required=False),
    ]
)

PARTICIPANT_METRICS_CONTRACT = TypeContract(
    name="ParticipantMetrics",
    description="Participant Portal metrics response",
    fields=[
        FieldContract("active_participants", FieldType.OBJECT),
        FieldContract("total_transactions", FieldType.OBJECT),
        FieldContract("avg_response_time", FieldType.OBJECT),
        FieldContract("uptime", FieldType.OBJECT),
        FieldContract("source", FieldType.STRING, required=False),
    ]
)

TRANSACTION_CONTRACT = TypeContract(
    name="Transaction",
    description="Transaction object",
    fields=[
        FieldContract("transaction_id", FieldType.STRING),
        FieldContract("payer_id", FieldType.STRING),
        FieldContract("payee_id", FieldType.STRING),
        FieldContract("amount", FieldType.NUMBER),
        FieldContract("currency", FieldType.STRING),
        FieldContract("status", FieldType.STRING),
        FieldContract("timestamp", FieldType.STRING),
        FieldContract("latency_ms", FieldType.NUMBER, required=False),
    ]
)

FRAUD_ALERT_CONTRACT = TypeContract(
    name="FraudAlert",
    description="Fraud alert object",
    fields=[
        FieldContract("alert_id", FieldType.STRING),
        FieldContract("transaction_id", FieldType.STRING),
        FieldContract("alert_type", FieldType.STRING),
        FieldContract("severity", FieldType.STRING),
        FieldContract("status", FieldType.STRING),
        FieldContract("risk_score", FieldType.NUMBER),
        FieldContract("timestamp", FieldType.STRING),
    ]
)

SETTLEMENT_CONTRACT = TypeContract(
    name="Settlement",
    description="Settlement object",
    fields=[
        FieldContract("settlement_id", FieldType.STRING),
        FieldContract("window_id", FieldType.STRING),
        FieldContract("status", FieldType.STRING),
        FieldContract("total_transactions", FieldType.NUMBER),
        FieldContract("total_amount", FieldType.NUMBER),
        FieldContract("participant_count", FieldType.NUMBER),
    ]
)

PARTICIPANT_CONTRACT = TypeContract(
    name="Participant",
    description="Participant object",
    fields=[
        FieldContract("participant_id", FieldType.STRING),
        FieldContract("name", FieldType.STRING),
        FieldContract("type", FieldType.STRING),
        FieldContract("status", FieldType.STRING),
        FieldContract("transaction_count", FieldType.NUMBER, required=False),
        FieldContract("success_rate", FieldType.NUMBER, required=False),
    ]
)

# All contracts
API_CONTRACTS: Dict[str, TypeContract] = {
    "/api/noc/metrics": NOC_METRICS_CONTRACT,
    "/api/fraud/metrics": FRAUD_METRICS_CONTRACT,
    "/api/settlement/metrics": SETTLEMENT_METRICS_CONTRACT,
    "/api/participants/metrics": PARTICIPANT_METRICS_CONTRACT,
    "/api/transactions": TypeContract(
        name="TransactionList",
        fields=[FieldContract("items", FieldType.ARRAY, array_item_type=FieldType.OBJECT)]
    ),
    "/api/fraud/alerts": TypeContract(
        name="FraudAlertList",
        fields=[FieldContract("items", FieldType.ARRAY, array_item_type=FieldType.OBJECT)]
    ),
    "/api/settlements": TypeContract(
        name="SettlementList",
        fields=[FieldContract("items", FieldType.ARRAY, array_item_type=FieldType.OBJECT)]
    ),
    "/api/participants": TypeContract(
        name="ParticipantList",
        fields=[FieldContract("items", FieldType.ARRAY, array_item_type=FieldType.OBJECT)]
    ),
}


class ContractValidator:
    """Validates API responses against contracts"""
    
    def __init__(self):
        self.contracts = API_CONTRACTS
    
    def validate(self, endpoint: str, response: Dict[str, Any]) -> List[ContractViolation]:
        """Validate response against contract for endpoint"""
        contract = self.contracts.get(endpoint)
        if not contract:
            return [ContractViolation(
                path=endpoint,
                expected="defined contract",
                actual="no contract",
                message=f"No contract defined for endpoint {endpoint}"
            )]
        
        return self._validate_object(response, contract, "")
    
    def _validate_object(self, data: Any, contract: TypeContract, path: str) -> List[ContractViolation]:
        """Validate object against contract"""
        violations = []
        
        if not isinstance(data, dict):
            violations.append(ContractViolation(
                path=path or "root",
                expected="object",
                actual=type(data).__name__,
                message=f"Expected object, got {type(data).__name__}"
            ))
            return violations
        
        # Check required fields
        for field in contract.fields:
            field_path = f"{path}.{field.name}" if path else field.name
            
            if field.name not in data:
                if field.required:
                    violations.append(ContractViolation(
                        path=field_path,
                        expected=f"required field of type {field.field_type.value}",
                        actual="missing",
                        message=f"Required field '{field.name}' is missing"
                    ))
                continue
            
            value = data[field.name]
            
            # Check nullable
            if value is None:
                if not field.nullable:
                    violations.append(ContractViolation(
                        path=field_path,
                        expected=f"non-null {field.field_type.value}",
                        actual="null",
                        message=f"Field '{field.name}' is null but not nullable"
                    ))
                continue
            
            # Validate type
            type_violations = self._validate_type(value, field, field_path)
            violations.extend(type_violations)
        
        return violations
    
    def _validate_type(self, value: Any, field: FieldContract, path: str) -> List[ContractViolation]:
        """Validate value type"""
        violations = []
        
        if field.field_type == FieldType.ANY:
            return violations
        
        if field.field_type == FieldType.STRING:
            if not isinstance(value, str):
                violations.append(ContractViolation(
                    path=path,
                    expected="string",
                    actual=type(value).__name__,
                    message=f"Expected string, got {type(value).__name__}"
                ))
        
        elif field.field_type == FieldType.NUMBER:
            if not isinstance(value, (int, float)):
                violations.append(ContractViolation(
                    path=path,
                    expected="number",
                    actual=type(value).__name__,
                    message=f"Expected number, got {type(value).__name__}"
                ))
        
        elif field.field_type == FieldType.BOOLEAN:
            if not isinstance(value, bool):
                violations.append(ContractViolation(
                    path=path,
                    expected="boolean",
                    actual=type(value).__name__,
                    message=f"Expected boolean, got {type(value).__name__}"
                ))
        
        elif field.field_type == FieldType.ARRAY:
            if not isinstance(value, list):
                violations.append(ContractViolation(
                    path=path,
                    expected="array",
                    actual=type(value).__name__,
                    message=f"Expected array, got {type(value).__name__}"
                ))
        
        elif field.field_type == FieldType.OBJECT:
            if not isinstance(value, dict):
                violations.append(ContractViolation(
                    path=path,
                    expected="object",
                    actual=type(value).__name__,
                    message=f"Expected object, got {type(value).__name__}"
                ))
            elif field.nested_contract:
                violations.extend(self._validate_object(value, field.nested_contract, path))
        
        return violations
    
    def validate_all_endpoints(self, responses: Dict[str, Dict[str, Any]]) -> Dict[str, List[ContractViolation]]:
        """Validate multiple endpoint responses"""
        results = {}
        for endpoint, response in responses.items():
            results[endpoint] = self.validate(endpoint, response)
        return results
    
    def generate_report(self, results: Dict[str, List[ContractViolation]]) -> Dict[str, Any]:
        """Generate validation report"""
        total_endpoints = len(results)
        passed = sum(1 for v in results.values() if len(v) == 0)
        failed = total_endpoints - passed
        
        all_violations = []
        for endpoint, violations in results.items():
            for v in violations:
                all_violations.append({
                    'endpoint': endpoint,
                    'path': v.path,
                    'expected': v.expected,
                    'actual': v.actual,
                    'message': v.message
                })
        
        return {
            'generated_at': datetime.utcnow().isoformat(),
            'summary': {
                'total_endpoints': total_endpoints,
                'passed': passed,
                'failed': failed,
                'pass_rate': passed / total_endpoints * 100 if total_endpoints > 0 else 0
            },
            'violations': all_violations
        }


def generate_typescript_types(contracts: Dict[str, TypeContract]) -> str:
    """Generate TypeScript type definitions from contracts"""
    lines = [
        "// Auto-generated TypeScript types from API contracts",
        "// Do not edit manually - regenerate using contract_tests.py",
        "",
    ]
    
    generated_types: Set[str] = set()
    
    def generate_type(contract: TypeContract) -> str:
        if contract.name in generated_types:
            return ""
        generated_types.add(contract.name)
        
        type_lines = [f"export interface {contract.name} {{"]
        
        for field in contract.fields:
            optional = "?" if not field.required else ""
            nullable = " | null" if field.nullable else ""
            
            if field.field_type == FieldType.STRING:
                ts_type = "string"
            elif field.field_type == FieldType.NUMBER:
                ts_type = "number"
            elif field.field_type == FieldType.BOOLEAN:
                ts_type = "boolean"
            elif field.field_type == FieldType.ARRAY:
                if field.array_item_type == FieldType.OBJECT and field.nested_contract:
                    ts_type = f"{field.nested_contract.name}[]"
                else:
                    ts_type = "any[]"
            elif field.field_type == FieldType.OBJECT:
                if field.nested_contract:
                    ts_type = field.nested_contract.name
                else:
                    ts_type = "Record<string, any>"
            else:
                ts_type = "any"
            
            type_lines.append(f"  {field.name}{optional}: {ts_type}{nullable};")
        
        type_lines.append("}")
        return "\n".join(type_lines)
    
    # Generate nested types first
    for contract in contracts.values():
        for field in contract.fields:
            if field.nested_contract:
                nested = generate_type(field.nested_contract)
                if nested:
                    lines.append(nested)
                    lines.append("")
    
    # Generate main types
    for contract in contracts.values():
        type_def = generate_type(contract)
        if type_def:
            lines.append(type_def)
            lines.append("")
    
    return "\n".join(lines)


# Test runner
async def run_contract_tests(base_url: str = "http://localhost:8080") -> Dict[str, Any]:
    """Run contract tests against API"""
    import aiohttp
    
    validator = ContractValidator()
    responses = {}
    
    async with aiohttp.ClientSession() as session:
        for endpoint in API_CONTRACTS.keys():
            try:
                async with session.get(f"{base_url}{endpoint}") as resp:
                    if resp.status == 200:
                        responses[endpoint] = await resp.json()
                    else:
                        responses[endpoint] = {"error": f"HTTP {resp.status}"}
            except Exception as e:
                responses[endpoint] = {"error": str(e)}
    
    results = validator.validate_all_endpoints(responses)
    return validator.generate_report(results)


if __name__ == "__main__":
    import asyncio
    
    # Generate TypeScript types
    ts_types = generate_typescript_types(API_CONTRACTS)
    print("Generated TypeScript Types:")
    print(ts_types)
    
    # Run tests if API is available
    # report = asyncio.run(run_contract_tests())
    # print(json.dumps(report, indent=2))
