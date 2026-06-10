# End-to-End Payment Test Script

## Overview

This comprehensive Python script performs a complete end-to-end test of the Next-Generation Payment Switch platform by:

1. Submitting a payment request through the NGINX API Gateway
2. Checking the fraud detection score
3. Monitoring the payment status
4. Verifying the transaction record in PostgreSQL database
5. Generating a detailed test report

## Features

✅ **Complete Payment Flow Testing** - Tests the entire payment lifecycle  
✅ **Multi-Service Validation** - Validates NGINX, Payment Gateway, Fraud Detection, and PostgreSQL  
✅ **Automatic Retry Logic** - Retries status checks with configurable attempts  
✅ **Color-Coded Output** - Easy-to-read terminal output with status indicators  
✅ **Detailed Logging** - Verbose mode for debugging  
✅ **JSON Report Generation** - Saves test results to timestamped JSON file  
✅ **Database Verification** - Confirms transaction persistence in PostgreSQL  
✅ **Latency Measurement** - Tracks response times for all API calls  

## Requirements

### Python Dependencies

```bash
pip install requests psycopg2-binary colorama
```

### System Requirements

- Python 3.6+
- Access to NGINX API Gateway (default: http://localhost)
- Access to PostgreSQL database (default: localhost:5432)
- Running Docker Compose services

## Usage

### Basic Usage

```bash
python3 end_to_end_payment_test.py
```

### Custom API Gateway Host

```bash
python3 end_to_end_payment_test.py --host http://api.example.com
```

### Custom Database Configuration

```bash
python3 end_to_end_payment_test.py \
  --db-host 192.168.1.100 \
  --db-port 5432 \
  --db-name payment_switch \
  --db-user payment_user \
  --db-password payment_pass_2024
```

### Verbose Mode

```bash
python3 end_to_end_payment_test.py --verbose
```

### Complete Example

```bash
python3 end_to_end_payment_test.py \
  --host http://localhost \
  --db-host localhost \
  --verbose
```

## Command-Line Arguments

| Argument | Default | Description |
|----------|---------|-------------|
| `--host` | `http://localhost` | Base URL of the NGINX API Gateway |
| `--db-host` | `localhost` | PostgreSQL host |
| `--db-port` | `5432` | PostgreSQL port |
| `--db-name` | `payment_switch` | PostgreSQL database name |
| `--db-user` | `payment_user` | PostgreSQL username |
| `--db-password` | `payment_pass_2024` | PostgreSQL password |
| `--verbose` | `False` | Enable verbose output |

## Test Flow

### Step 1: Connectivity Tests

- **NGINX Connectivity**: Verifies NGINX is reachable
- **PostgreSQL Connectivity**: Verifies database connection

### Step 2: Payment Submission

Submits a test payment with:
- **Source**: +1234567890
- **Destination**: +0987654321
- **Amount**: $100.00 USD
- **Type**: P2P (Person-to-Person)
- **Channel**: MOBILE

### Step 3: Fraud Detection

Checks fraud score for the submitted transaction using the AI-powered fraud detection service.

### Step 4: Status Monitoring

Polls the payment status endpoint up to 5 times with 2-second intervals until a final status is reached:
- COMPLETED
- FAILED
- REJECTED

### Step 5: Database Verification

Queries the PostgreSQL `transactions` table to verify:
- Transaction exists
- Correct amount and currency
- Final status matches API response
- All fields populated correctly

## Output Example

```
================================================================================
END-TO-END PAYMENT TEST
================================================================================

[12:34:56] ℹ Testing NGINX connectivity...
[12:34:56] ✓ NGINX is reachable (status: 200)
[12:34:56] ℹ Testing PostgreSQL connectivity...
[12:34:56] ✓ PostgreSQL is reachable

[12:34:57] ℹ Submitting payment request...
[12:34:57] ✓ Payment submitted successfully (ID: txn_1699012497)

[12:34:58] ℹ Checking fraud score for transaction txn_1699012497...
[12:34:58] ✓ Fraud score: 0.15 (Risk: LOW)

[12:34:59] ℹ Checking payment status for transaction txn_1699012497...
[12:35:00] ✓ Payment status: COMPLETED (attempt 1/5)

[12:35:01] ℹ Verifying transaction txn_1699012497 in database...
[12:35:01] ✓ Transaction found in database (Status: COMPLETED, Amount: 100.00)

================================================================================
TEST SUMMARY
================================================================================

Total Tests:    6
Passed:         6
Failed:         0
Success Rate:   100.0%

Test Details:
  ✓ submit_payment                PASS      123.45ms
  ✓ check_fraud_score             PASS       67.89ms
  ✓ check_payment_status          PASS       34.56ms
  ✓ verify_in_database            PASS       12.34ms

[12:35:02] ℹ Results saved to: e2e_test_results_1699012502.json
```

## JSON Report Format

The script generates a timestamped JSON file with complete test results:

```json
{
  "start_time": "2024-11-03T12:34:56.123456",
  "tests": [
    {
      "test": "submit_payment",
      "status": "PASS",
      "latency_ms": 123.45,
      "transaction_id": "txn_1699012497",
      "response": {
        "transactionId": "txn_1699012497",
        "status": "PENDING"
      }
    },
    {
      "test": "check_fraud_score",
      "status": "PASS",
      "latency_ms": 67.89,
      "fraud_score": 0.15,
      "risk_level": "LOW"
    },
    {
      "test": "check_payment_status",
      "status": "PASS",
      "latency_ms": 34.56,
      "payment_status": "COMPLETED",
      "attempt": 1
    },
    {
      "test": "verify_in_database",
      "status": "PASS",
      "database_record": {
        "transaction_id": "txn_1699012497",
        "amount": 100.00,
        "currency": "USD",
        "status": "COMPLETED"
      }
    }
  ],
  "summary": {
    "total_tests": 6,
    "passed": 6,
    "failed": 0,
    "success_rate": 100.0,
    "end_time": "2024-11-03T12:35:02.789012"
  }
}
```

## Exit Codes

- **0**: All tests passed
- **1**: One or more tests failed

## Integration with CI/CD

### GitHub Actions

```yaml
- name: Run E2E Tests
  run: |
    python3 end_to_end_payment_test.py --host ${{ secrets.API_HOST }}
```

### Jenkins

```groovy
sh 'python3 end_to_end_payment_test.py --host ${API_HOST}'
```

### GitLab CI

```yaml
test:e2e:
  script:
    - python3 end_to_end_payment_test.py --host $API_HOST
```

## Troubleshooting

### Connection Refused

```
[ERROR] Failed to connect to NGINX: Connection refused
```

**Solution**: Ensure Docker Compose services are running:
```bash
docker-compose ps
docker-compose up -d
```

### Database Connection Failed

```
[ERROR] Failed to connect to PostgreSQL: could not connect to server
```

**Solution**: Check database credentials and ensure PostgreSQL is running:
```bash
docker-compose logs postgres
```

### Transaction Not Found

```
[ERROR] Transaction not found in database
```

**Solution**: 
1. Check if the payment was actually submitted
2. Verify database schema is initialized
3. Check service logs for errors

### Timeout Errors

```
[WARNING] Payment status check timed out after 5 attempts
```

**Solution**: Increase retry attempts or check service health:
```bash
docker-compose logs payment-gateway
```

## Advanced Usage

### Custom Test Data

Modify the `submit_payment()` method to use custom test data:

```python
payment_data = {
    "source": {"type": "MSISDN", "identifier": "+1111111111"},
    "destination": {"type": "MSISDN", "identifier": "+2222222222"},
    "amount": {"currency": "EUR", "value": 250.00},
    "transactionType": "P2B",
    "channel": "WEB"
}
```

### Multiple Test Runs

Run multiple tests in a loop:

```bash
for i in {1..10}; do
  echo "Test run $i"
  python3 end_to_end_payment_test.py
  sleep 5
done
```

### Load Testing

Use with Apache Bench or similar tools:

```bash
# Not recommended - use dedicated load testing tools instead
```

## Best Practices

1. **Run Before Deployment**: Always run E2E tests before deploying to production
2. **Monitor Results**: Track test results over time to identify regressions
3. **Automate**: Integrate into CI/CD pipeline for continuous validation
4. **Clean Up**: Regularly clean up test transactions from the database
5. **Verbose Mode**: Use `--verbose` when debugging failures

## Limitations

- Tests only P2P payments (not P2B, B2B, etc.)
- Uses fixed test data (not randomized)
- Does not test error scenarios (negative tests)
- Single transaction per run (not batch testing)

## Future Enhancements

- [ ] Support for multiple payment types
- [ ] Randomized test data generation
- [ ] Negative test scenarios
- [ ] Batch payment testing
- [ ] Performance benchmarking
- [ ] Detailed error analysis
- [ ] HTML report generation

## License

MIT License - Use freely for testing purposes.

## Support

For issues or questions, please contact the DevOps team or create an issue in the repository.
