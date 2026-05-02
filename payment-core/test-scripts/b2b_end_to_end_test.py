#!/usr/bin/env python3
"""
B2B End-to-End Payment Test Script

This script simulates a complete Business-to-Business (B2B) payment flow through
the Next-Generation Payment Switch platform, including:
- ERP integration via Unified API Gateway
- High-value transaction processing
- Corporate fraud detection
- Workflow orchestration
- Settlement processing
- Integration adapter communication
- Final status verification in PostgreSQL

Author: Manus AI
Version: 1.0
"""

import json
import time
import argparse
import sys
from datetime import datetime
from typing import Dict, Any, Optional, List

try:
    import requests
except ImportError:
    print("Error: requests library not found. Install with: pip install requests")
    sys.exit(1)

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("Error: psycopg2 library not found. Install with: pip install psycopg2-binary")
    sys.exit(1)

try:
    from colorama import init, Fore, Style
    init(autoreset=True)
    COLORS_AVAILABLE = True
except ImportError:
    COLORS_AVAILABLE = False


class Colors:
    """ANSI color codes for terminal output"""
    if COLORS_AVAILABLE:
        SUCCESS = Fore.GREEN
        ERROR = Fore.RED
        WARNING = Fore.YELLOW
        INFO = Fore.CYAN
        RESET = Style.RESET_ALL
    else:
        SUCCESS = ERROR = WARNING = INFO = RESET = ""


class B2BPaymentTest:
    """End-to-end test for B2B payment transactions"""
    
    def __init__(self, base_url: str, db_config: Dict[str, Any], verbose: bool = False):
        self.base_url = base_url.rstrip('/')
        self.db_config = db_config
        self.verbose = verbose
        self.test_results: List[Dict[str, Any]] = []
        self.transaction_id: Optional[str] = None
        self.start_time = datetime.now()
        
    def log(self, message: str, level: str = "INFO"):
        """Log a message with timestamp and color coding"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        
        if level == "SUCCESS":
            symbol = "✓"
            color = Colors.SUCCESS
        elif level == "ERROR":
            symbol = "✗"
            color = Colors.ERROR
        elif level == "WARNING":
            symbol = "⚠"
            color = Colors.WARNING
        else:
            symbol = "ℹ"
            color = Colors.INFO
            
        print(f"{color}[{timestamp}] {symbol} {message}{Colors.RESET}")
    
    def test_connectivity(self) -> bool:
        """Test connectivity to NGINX and PostgreSQL"""
        self.log("Testing NGINX connectivity...")
        
        try:
            response = requests.get(f"{self.base_url}/health", timeout=5)
            if response.status_code == 200:
                self.log("NGINX is reachable (status: 200)", "SUCCESS")
            else:
                self.log(f"NGINX returned status: {response.status_code}", "WARNING")
                return False
        except requests.exceptions.RequestException as e:
            self.log(f"Failed to connect to NGINX: {e}", "ERROR")
            return False
        
        self.log("Testing PostgreSQL connectivity...")
        
        try:
            conn = psycopg2.connect(**self.db_config)
            conn.close()
            self.log("PostgreSQL is reachable", "SUCCESS")
            return True
        except Exception as e:
            self.log(f"Failed to connect to PostgreSQL: {e}", "ERROR")
            return False
    
    def submit_b2b_payment(self) -> Optional[str]:
        """Submit a B2B payment request"""
        self.log("Submitting B2B payment request...")
        
        payload = {
            "source": {
                "type": "BUSINESS_ID",
                "identifier": "manufacturer_12345"
            },
            "destination": {
                "type": "BUSINESS_ID",
                "identifier": "supplier_67890"
            },
            "amount": {
                "currency": "USD",
                "value": 50000.00  # High-value B2B transaction
            },
            "transactionType": "B2B",
            "channel": "API",
            "metadata": {
                "invoiceNumber": "INV-2024-001",
                "purchaseOrder": "PO-2024-123",
                "erpSystem": "SAP",
                "paymentTerms": "NET30"
            }
        }
        
        start_time = time.time()
        
        try:
            response = requests.post(
                f"{self.base_url}/api/v1/payments/initiate",
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            
            latency_ms = (time.time() - start_time) * 1000
            
            if response.status_code in [200, 201]:
                data = response.json()
                transaction_id = data.get("transactionId")
                
                if transaction_id:
                    self.log(f"B2B payment submitted successfully (ID: {transaction_id})", "SUCCESS")
                    self.test_results.append({
                        "test": "submit_b2b_payment",
                        "status": "PASS",
                        "latency_ms": round(latency_ms, 2),
                        "transaction_id": transaction_id,
                        "amount": 50000.00,
                        "response": data
                    })
                    return transaction_id
                else:
                    self.log("Payment submitted but no transaction ID returned", "WARNING")
                    return None
            else:
                self.log(f"Payment submission failed (status: {response.status_code})", "ERROR")
                if self.verbose:
                    self.log(f"Response: {response.text}", "ERROR")
                self.test_results.append({
                    "test": "submit_b2b_payment",
                    "status": "FAIL",
                    "latency_ms": round(latency_ms, 2),
                    "error": response.text
                })
                return None
                
        except requests.exceptions.RequestException as e:
            self.log(f"Failed to submit payment: {e}", "ERROR")
            self.test_results.append({
                "test": "submit_b2b_payment",
                "status": "FAIL",
                "error": str(e)
            })
            return None
    
    def check_corporate_fraud_score(self, transaction_id: str) -> Optional[float]:
        """Check corporate fraud score for the B2B transaction"""
        self.log(f"Checking corporate fraud score for transaction {transaction_id}...")
        
        payload = {
            "transactionId": transaction_id,
            "transactionType": "B2B",
            "amount": 50000.00,
            "source": "manufacturer_12345",
            "destination": "supplier_67890"
        }
        
        start_time = time.time()
        
        try:
            response = requests.post(
                f"{self.base_url}/api/v1/fraud/score",
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            latency_ms = (time.time() - start_time) * 1000
            
            if response.status_code == 200:
                data = response.json()
                fraud_score = data.get("fraudScore", data.get("score"))
                risk_level = data.get("riskLevel", "UNKNOWN")
                
                self.log(f"Fraud score: {fraud_score} (Risk: {risk_level})", "SUCCESS")
                
                self.test_results.append({
                    "test": "check_corporate_fraud_score",
                    "status": "PASS",
                    "latency_ms": round(latency_ms, 2),
                    "fraud_score": fraud_score,
                    "risk_level": risk_level
                })
                
                return fraud_score
            else:
                self.log(f"Fraud check failed (status: {response.status_code})", "ERROR")
                self.test_results.append({
                    "test": "check_corporate_fraud_score",
                    "status": "FAIL",
                    "latency_ms": round(latency_ms, 2)
                })
                return None
                
        except requests.exceptions.RequestException as e:
            self.log(f"Failed to check fraud score: {e}", "ERROR")
            return None
    
    def monitor_payment_status(self, transaction_id: str, max_attempts: int = 10) -> Optional[str]:
        """Monitor payment status until completion or timeout"""
        self.log(f"Monitoring payment status for transaction {transaction_id}...")
        
        for attempt in range(1, max_attempts + 1):
            start_time = time.time()
            
            try:
                response = requests.post(
                    f"{self.base_url}/api/v1/payments/status",
                    json={"transactionId": transaction_id},
                    headers={"Content-Type": "application/json"},
                    timeout=10
                )
                
                latency_ms = (time.time() - start_time) * 1000
                
                if response.status_code == 200:
                    data = response.json()
                    status = data.get("status", "UNKNOWN")
                    
                    if status in ["COMPLETED", "SETTLED"]:
                        self.log(f"Payment status: {status} (attempt {attempt}/{max_attempts})", "SUCCESS")
                        self.test_results.append({
                            "test": "monitor_payment_status",
                            "status": "PASS",
                            "latency_ms": round(latency_ms, 2),
                            "payment_status": status,
                            "attempts": attempt
                        })
                        return status
                    elif status in ["FAILED", "REJECTED"]:
                        self.log(f"Payment failed with status: {status}", "ERROR")
                        self.test_results.append({
                            "test": "monitor_payment_status",
                            "status": "FAIL",
                            "payment_status": status
                        })
                        return status
                    else:
                        self.log(f"Payment status: {status} (attempt {attempt}/{max_attempts})", "INFO")
                        if attempt < max_attempts:
                            time.sleep(2)  # Wait 2 seconds before next attempt
                else:
                    self.log(f"Status check failed (status: {response.status_code})", "WARNING")
                    if attempt < max_attempts:
                        time.sleep(2)
                        
            except requests.exceptions.RequestException as e:
                self.log(f"Failed to check status: {e}", "ERROR")
                if attempt < max_attempts:
                    time.sleep(2)
        
        self.log("Payment status check timed out", "ERROR")
        self.test_results.append({
            "test": "monitor_payment_status",
            "status": "FAIL",
            "error": "Timeout"
        })
        return None
    
    def verify_settlement_record(self, transaction_id: str) -> bool:
        """Verify that the transaction is recorded for settlement"""
        self.log(f"Verifying settlement record for transaction {transaction_id}...")
        
        start_time = time.time()
        
        try:
            response = requests.post(
                f"{self.base_url}/api/v1/settlement/positions",
                json={"transactionId": transaction_id},
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            latency_ms = (time.time() - start_time) * 1000
            
            if response.status_code == 200:
                data = response.json()
                self.log("Settlement record verified", "SUCCESS")
                self.test_results.append({
                    "test": "verify_settlement_record",
                    "status": "PASS",
                    "latency_ms": round(latency_ms, 2),
                    "settlement_data": data
                })
                return True
            else:
                self.log(f"Settlement verification failed (status: {response.status_code})", "ERROR")
                self.test_results.append({
                    "test": "verify_settlement_record",
                    "status": "FAIL",
                    "latency_ms": round(latency_ms, 2)
                })
                return False
                
        except requests.exceptions.RequestException as e:
            self.log(f"Failed to verify settlement: {e}", "ERROR")
            return False
    
    def verify_in_database(self, transaction_id: str) -> bool:
        """Verify transaction in PostgreSQL database"""
        self.log(f"Verifying transaction {transaction_id} in database...")
        
        start_time = time.time()
        
        try:
            conn = psycopg2.connect(**self.db_config)
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Query the transactions table
            cursor.execute("""
                SELECT 
                    transaction_id,
                    transaction_type,
                    status,
                    amount,
                    currency,
                    source_identifier,
                    destination_identifier,
                    created_at,
                    updated_at
                FROM transactions
                WHERE transaction_id = %s
            """, (transaction_id,))
            
            record = cursor.fetchone()
            
            latency_ms = (time.time() - start_time) * 1000
            
            if record:
                self.log(f"Transaction found in database (Status: {record['status']}, Amount: {record['amount']})", "SUCCESS")
                self.test_results.append({
                    "test": "verify_in_database",
                    "status": "PASS",
                    "latency_ms": round(latency_ms, 2),
                    "database_record": dict(record)
                })
                
                cursor.close()
                conn.close()
                return True
            else:
                self.log("Transaction not found in database", "ERROR")
                self.test_results.append({
                    "test": "verify_in_database",
                    "status": "FAIL",
                    "latency_ms": round(latency_ms, 2),
                    "error": "Transaction not found"
                })
                
                cursor.close()
                conn.close()
                return False
                
        except Exception as e:
            self.log(f"Database verification failed: {e}", "ERROR")
            self.test_results.append({
                "test": "verify_in_database",
                "status": "FAIL",
                "error": str(e)
            })
            return False
    
    def run_complete_test(self) -> bool:
        """Run the complete B2B end-to-end test"""
        print("=" * 80)
        print(f"{Colors.INFO}B2B END-TO-END PAYMENT TEST{Colors.RESET}")
        print("=" * 80)
        print()
        
        # Step 1: Test connectivity
        if not self.test_connectivity():
            self.log("Connectivity test failed. Aborting.", "ERROR")
            return False
        
        print()
        
        # Step 2: Submit B2B payment
        self.transaction_id = self.submit_b2b_payment()
        if not self.transaction_id:
            self.log("Payment submission failed. Aborting.", "ERROR")
            return False
        
        print()
        
        # Step 3: Check corporate fraud score
        fraud_score = self.check_corporate_fraud_score(self.transaction_id)
        if fraud_score is None:
            self.log("Fraud check failed but continuing...", "WARNING")
        
        print()
        
        # Step 4: Monitor payment status
        payment_status = self.monitor_payment_status(self.transaction_id)
        if not payment_status or payment_status in ["FAILED", "REJECTED"]:
            self.log("Payment processing failed. Aborting.", "ERROR")
            return False
        
        print()
        
        # Step 5: Verify settlement record
        settlement_verified = self.verify_settlement_record(self.transaction_id)
        if not settlement_verified:
            self.log("Settlement verification failed but continuing...", "WARNING")
        
        print()
        
        # Step 6: Verify in database
        db_verified = self.verify_in_database(self.transaction_id)
        if not db_verified:
            self.log("Database verification failed.", "ERROR")
            return False
        
        return True
    
    def generate_report(self) -> Dict[str, Any]:
        """Generate test report"""
        end_time = datetime.now()
        duration = (end_time - self.start_time).total_seconds()
        
        total_tests = len(self.test_results)
        passed = sum(1 for t in self.test_results if t.get("status") == "PASS")
        failed = total_tests - passed
        success_rate = (passed / total_tests * 100) if total_tests > 0 else 0
        
        report = {
            "test_type": "B2B End-to-End Payment Test",
            "start_time": self.start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "duration_seconds": round(duration, 2),
            "transaction_id": self.transaction_id,
            "summary": {
                "total_tests": total_tests,
                "passed": passed,
                "failed": failed,
                "success_rate": round(success_rate, 1)
            },
            "tests": self.test_results
        }
        
        return report
    
    def print_summary(self, report: Dict[str, Any]):
        """Print test summary"""
        print()
        print("=" * 80)
        print(f"{Colors.INFO}TEST SUMMARY{Colors.RESET}")
        print("=" * 80)
        print()
        
        summary = report["summary"]
        
        print(f"Total Tests:    {summary['total_tests']}")
        print(f"Passed:         {Colors.SUCCESS}{summary['passed']}{Colors.RESET}")
        print(f"Failed:         {Colors.ERROR}{summary['failed']}{Colors.RESET}")
        print(f"Success Rate:   {summary['success_rate']}%")
        print(f"Duration:       {report['duration_seconds']}s")
        print()
        
        print("Test Details:")
        for test in report["tests"]:
            status_color = Colors.SUCCESS if test["status"] == "PASS" else Colors.ERROR
            status_symbol = "✓" if test["status"] == "PASS" else "✗"
            latency = test.get("latency_ms", 0)
            print(f"  {status_color}{status_symbol} {test['test']:<35} {test['status']:<6} {latency:>8.2f}ms{Colors.RESET}")


def main():
    parser = argparse.ArgumentParser(description="B2B End-to-End Payment Test")
    parser.add_argument("--host", default="http://localhost", help="Base URL of the payment switch")
    parser.add_argument("--db-host", default="localhost", help="PostgreSQL host")
    parser.add_argument("--db-port", type=int, default=5432, help="PostgreSQL port")
    parser.add_argument("--db-name", default="paymentdb", help="PostgreSQL database name")
    parser.add_argument("--db-user", default="payment_user", help="PostgreSQL username")
    parser.add_argument("--db-password", default="payment_pass_2024", help="PostgreSQL password")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose output")
    parser.add_argument("--output", help="Output file for JSON results")
    
    args = parser.parse_args()
    
    db_config = {
        "host": args.db_host,
        "port": args.db_port,
        "database": args.db_name,
        "user": args.db_user,
        "password": args.db_password
    }
    
    # Run test
    test = B2BPaymentTest(args.host, db_config, args.verbose)
    success = test.run_complete_test()
    
    # Generate report
    report = test.generate_report()
    test.print_summary(report)
    
    # Save report to file
    if args.output:
        output_file = args.output
    else:
        timestamp = int(time.time())
        output_file = f"b2b_test_results_{timestamp}.json"
    
    with open(output_file, 'w') as f:
        json.dump(report, f, indent=2)
    
    print()
    print(f"{Colors.INFO}Results saved to: {output_file}{Colors.RESET}")
    print()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
