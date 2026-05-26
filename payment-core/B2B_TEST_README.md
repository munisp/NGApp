# B2B End-to-End Payment Test Script

This document provides a comprehensive guide to the B2B end-to-end payment test script (`b2b_end_to_end_test.py`), which simulates a complete Business-to-Business transaction flow through the Next-Generation Payment Switch platform.

## Overview

The script performs a full end-to-end test, including:
- **ERP Integration**: Simulates a payment initiated from an ERP system via the Unified API Gateway.
- **High-Value Transaction**: Submits a high-value B2B payment.
- **Corporate Fraud Detection**: Checks the transaction against corporate fraud models.
- **Workflow Orchestration**: Monitors the payment through the Temporal workflow engine.
- **Settlement Verification**: Confirms that the transaction is recorded for settlement.
- **Database Validation**: Verifies the final transaction status in the PostgreSQL database.

## Test Flow

1.  **Connectivity Test**: Verifies that NGINX and PostgreSQL are reachable.
2.  **Submit B2B Payment**: Submits a high-value B2B payment request to the `/api/v1/payments/initiate` endpoint.
3.  **Check Corporate Fraud Score**: Checks the fraud score for the transaction via the `/api/v1/fraud/score` endpoint.
4.  **Monitor Payment Status**: Polls the `/api/v1/payments/status` endpoint until the payment is completed or fails.
5.  **Verify Settlement Record**: Checks the `/api/v1/settlement/positions` endpoint to ensure the transaction is recorded for settlement.
6.  **Verify in Database**: Queries the `transactions` table in the PostgreSQL database to confirm the final status.

## Requirements

- Python 3.6+
- `requests` library
- `psycopg2-binary` library
- `colorama` library (optional, for color-coded output)

Install dependencies with:
```bash
pip install requests psycopg2-binary colorama
```

## Usage

### Basic Usage

```bash
python3 b2b_end_to_end_test.py
```

### Command-Line Arguments

- `--host`: Base URL of the payment switch (default: `http://localhost`)
- `--db-host`: PostgreSQL host (default: `localhost`)
- `--db-port`: PostgreSQL port (default: `5432`)
- `--db-name`: PostgreSQL database name (default: `paymentdb`)
- `--db-user`: PostgreSQL username (default: `payment_user`)
- `--db-password`: PostgreSQL password (default: `payment_pass_2024`)
- `--verbose`: Enable verbose output for debugging
- `--output`: Output file for JSON results (default: `b2b_test_results_<timestamp>.json`)

### Example with Custom Host

```bash
python3 b2b_end_to_end_test.py --host http://api.example.com
```

### Example with Verbose Output

```bash
python3 b2b_end_to_end_test.py --verbose
```

## Example Output

```
================================================================================
B2B END-TO-END PAYMENT TEST
================================================================================

[14:30:00] ℹ Testing NGINX connectivity...
[14:30:00] ✓ NGINX is reachable (status: 200)
[14:30:00] ℹ Testing PostgreSQL connectivity...
[14:30:00] ✓ PostgreSQL is reachable

[14:30:01] ℹ Submitting B2B payment request...
[14:30:01] ✓ B2B payment submitted successfully (ID: txn_b2b_1699012620)

[14:30:02] ℹ Checking corporate fraud score for transaction txn_b2b_1699012620...
[14:30:02] ✓ Fraud score: 0.05 (Risk: VERY LOW)

[14:30:03] ℹ Monitoring payment status for transaction txn_b2b_1699012620...
[14:30:04] ✓ Payment status: COMPLETED (attempt 1/10)

[14:30:05] ℹ Verifying settlement record for transaction txn_b2b_1699012620...
[14:30:05] ✓ Settlement record verified

[14:30:06] ℹ Verifying transaction txn_b2b_1699012620 in database...
[14:30:06] ✓ Transaction found in database (Status: COMPLETED, Amount: 50000.00)

================================================================================
TEST SUMMARY
================================================================================

Total Tests:    6
Passed:         6
Failed:         0
Success Rate:   100.0%
Duration:       6.12s

Test Details:
  ✓ submit_b2b_payment                PASS      123.45ms
  ✓ check_corporate_fraud_score       PASS       67.89ms
  ✓ monitor_payment_status            PASS       34.56ms
  ✓ verify_settlement_record          PASS       23.45ms
  ✓ verify_in_database                PASS       12.34ms

[14:30:07] ℹ Results saved to: b2b_test_results_1699012627.json
```

## JSON Report

The script generates a timestamped JSON file with detailed test results:

```json
{
  "test_type": "B2B End-to-End Payment Test",
  "start_time": "2024-11-03T14:30:00.123456",
  "end_time": "2024-11-03T14:30:06.243456",
  "duration_seconds": 6.12,
  "transaction_id": "txn_b2b_1699012620",
  "summary": {
    "total_tests": 6,
    "passed": 6,
    "failed": 0,
    "success_rate": 100.0
  },
  "tests": [
    {
      "test": "submit_b2b_payment",
      "status": "PASS",
      "latency_ms": 123.45,
      "transaction_id": "txn_b2b_1699012620",
      "amount": 50000.00,
      "response": {...}
    },
    ...
  ]
}
```

## CI/CD Integration

This script can be integrated into your CI/CD pipeline to automate B2B transaction testing.

### GitHub Actions

```yaml
- name: Run B2B E2E Tests
  run: |
    pip install requests psycopg2-binary colorama
    python3 b2b_end_to_end_test.py --host ${{ secrets.API_HOST }}
```

### Jenkins

```groovy
stage("B2B E2E Tests") {
    steps {
        sh "pip install requests psycopg2-binary colorama"
        sh "python3 b2b_end_to_end_test.py --host ${API_HOST}"
    }
}
```

## Troubleshooting

### Database Connection Failed

- **Cause**: PostgreSQL is not accessible or credentials are incorrect.
- **Solution**: Verify database host, port, and credentials. Ensure the database service is running.

### Payment Submission Failed

- **Cause**: The Payment Gateway is not running or is misconfigured.
- **Solution**: Check the Payment Gateway logs for errors. Use `--verbose` to see the API response.

### Test Timeout

- **Cause**: The payment is taking too long to process.
- **Solution**: Increase the `max_attempts` in the `monitor_payment_status` function or investigate performance bottlenecks in the workflow orchestrator.
