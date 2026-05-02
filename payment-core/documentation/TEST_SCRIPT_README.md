# Payment Switch API Test Script

## Overview

`test_payment_switch_api.py` is a comprehensive Python script that tests all 5 core API endpoints of the Next-Generation Payment Switch platform. It measures HTTP status codes, latency, and validates responses.

## Features

✅ **5 Core API Tests**
- Health Check (Payment Gateway)
- Initiate Payment (P2P Transfer)
- Check Fraud Score
- Check Payment Status
- Create Settlement Window

✅ **Detailed Metrics**
- HTTP status codes
- Response latency (milliseconds)
- Success/failure validation
- Request/response logging (verbose mode)

✅ **Color-Coded Output**
- Green: Success
- Red: Failure
- Yellow: Warning
- Blue: Information

✅ **Summary Statistics**
- Total tests run
- Pass/fail count
- Success rate percentage
- Average/min/max latency

✅ **JSON Export**
- Save results to file
- Timestamp included
- Full request/response data

## Requirements

- Python 3.6+
- No external dependencies (uses standard library only)
- Access to Payment Switch API gateway

## Installation

No installation required! The script uses only Python standard library.

```bash
# Make executable
chmod +x test_payment_switch_api.py
```

## Usage

### Basic Usage

```bash
# Test against localhost (default)
python3 test_payment_switch_api.py
```

### Custom Host

```bash
# Test against custom host
python3 test_payment_switch_api.py --host http://api.example.com
```

### Verbose Mode

```bash
# Show full request/response bodies
python3 test_payment_switch_api.py --verbose
```

### Custom Output File

```bash
# Save results to custom file
python3 test_payment_switch_api.py --output my_results.json
```

### Combined Options

```bash
# All options together
python3 test_payment_switch_api.py \
  --host http://localhost \
  --verbose \
  --output test_results_20241103.json
```

## Command-Line Options

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--host` | - | `http://localhost` | Base URL of API gateway |
| `--verbose` | `-v` | `False` | Print request/response bodies |
| `--output` | `-o` | `test_results.json` | Output file for results |
| `--help` | `-h` | - | Show help message |

## Output Example

### Console Output

```
================================================================================
                     PAYMENT SWITCH API TEST SUITE                      
================================================================================

Base URL: http://localhost
Timestamp: 2024-11-03 19:00:00 UTC
Verbose: Disabled

████████████████████████████████████████████████████████████████████████████████
Test 1: Health Check - Payment Gateway
────────────────────────────────────────────────────────────────────────────────
URL: http://localhost/api/v1/payments/health
Method: GET
Status Code: 200
Latency: 45.23 ms
✓ Health check passed

████████████████████████████████████████████████████████████████████████████████
Test 2: Initiate Payment (P2P Transfer)
────────────────────────────────────────────────────────────────────────────────
URL: http://localhost/api/v1/payments/initiate
Method: POST
Status Code: 200
Latency: 123.45 ms
✓ Payment initiated: txn_20241103190000_abc123

████████████████████████████████████████████████████████████████████████████────
Test 3: Check Fraud Score
────────────────────────────────────────────────────────────────────────────────
URL: http://localhost/api/v1/fraud/score
Method: POST
Status Code: 200
Latency: 67.89 ms
✓ Fraud score: 0.15 | Risk: LOW | Recommendation: APPROVE

████████████████████████████████████████████████████████████████████████████────
Test 4: Check Payment Status
────────────────────────────────────────────────────────────────────────────────
URL: http://localhost/api/v1/payments/status
Method: POST
Status Code: 200
Latency: 34.56 ms
✓ Payment status: COMPLETED

████████████████████████████████████████████████████████████████████████████────
Test 5: Create Settlement Window
────────────────────────────────────────────────────────────────────────────────
URL: http://localhost/api/v1/settlement/windows/create
Method: POST
Status Code: 200
Latency: 89.12 ms
✓ Settlement window created: sw_20241103_001 | Status: OPEN

================================================================================
                              TEST SUMMARY                              
================================================================================

Test Name                      Status Code     Latency (ms)    Result    
──────────────────────────────────────────────────────────────────────────
Health Check                   200             45.23           ✓ PASS
Initiate Payment               200             123.45          ✓ PASS
Fraud Score Check              200             67.89           ✓ PASS
Payment Status Check           200             34.56           ✓ PASS
Create Settlement Window       200             89.12           ✓ PASS
──────────────────────────────────────────────────────────────────────────

Overall Statistics:
  Total Tests:     5
  Passed:          5
  Failed:          0
  Success Rate:    100.0%

Latency Statistics:
  Average:         72.05 ms
  Minimum:         34.56 ms
  Maximum:         123.45 ms
  Total:           360.25 ms

✓ ALL TESTS PASSED

Results saved to: test_results.json
```

### JSON Output (test_results.json)

```json
{
  "timestamp": "2024-11-03T19:00:00.000000",
  "total_tests": 5,
  "passed": 5,
  "failed": 0,
  "results": [
    {
      "test": "Health Check",
      "url": "http://localhost/api/v1/payments/health",
      "method": "GET",
      "status_code": 200,
      "latency_ms": 45.23,
      "success": true,
      "response": {
        "status": "healthy",
        "service": "payment-gateway",
        "version": "1.0.0"
      }
    },
    {
      "test": "Initiate Payment",
      "url": "http://localhost/api/v1/payments/initiate",
      "method": "POST",
      "status_code": 200,
      "latency_ms": 123.45,
      "success": true,
      "transaction_id": "txn_20241103190000_abc123",
      "response": {
        "transaction_id": "txn_20241103190000_abc123",
        "status": "PENDING",
        "workflow_id": "wf_payment_abc123"
      }
    }
  ]
}
```

## Test Descriptions

### Test 1: Health Check
- **Endpoint**: `GET /api/v1/payments/health`
- **Purpose**: Verify payment gateway is running
- **Expected**: 200 OK with health status
- **Validates**: Service availability, dependencies

### Test 2: Initiate Payment
- **Endpoint**: `POST /api/v1/payments/initiate`
- **Purpose**: Create a P2P payment transaction
- **Expected**: 200 OK with transaction ID
- **Validates**: Payment creation, workflow initiation
- **Data**: $100 USD transfer from +1234567890 to +0987654321

### Test 3: Check Fraud Score
- **Endpoint**: `POST /api/v1/fraud/score`
- **Purpose**: Get fraud risk score for transaction
- **Expected**: 200 OK with fraud score (0.0-1.0)
- **Validates**: Fraud detection service, ML model
- **Uses**: Transaction ID from Test 2

### Test 4: Check Payment Status
- **Endpoint**: `POST /api/v1/payments/status`
- **Purpose**: Query transaction status
- **Expected**: 200 OK with status, or 404 if not found
- **Validates**: Transaction tracking, status updates
- **Uses**: Transaction ID from Test 2

### Test 5: Create Settlement Window
- **Endpoint**: `POST /api/v1/settlement/windows/create`
- **Purpose**: Create settlement window for batch processing
- **Expected**: 200 OK with window ID
- **Validates**: Settlement service, window management
- **Data**: Today's window with 3 participants

## Error Handling

The script handles various error scenarios:

### Connection Errors
```
✗ Health check failed: Connection failed: [Errno 111] Connection refused
```

### HTTP Errors
```
✗ Payment initiation failed: validation_error
Status Code: 400
```

### Timeout Errors
```
✗ Fraud check failed: Request timeout after 10 seconds
```

### Rate Limiting
```
⚠ Too many requests. Please try again later.
Status Code: 429
```

## Exit Codes

- `0` - All tests passed
- `1` - One or more tests failed or error occurred

## Integration with CI/CD

### GitHub Actions

```yaml
- name: Test Payment Switch API
  run: |
    python3 test_payment_switch_api.py --host ${{ secrets.API_HOST }}
    
- name: Upload test results
  uses: actions/upload-artifact@v3
  with:
    name: test-results
    path: test_results.json
```

### Jenkins

```groovy
stage('API Tests') {
    steps {
        sh 'python3 test_payment_switch_api.py --host ${API_HOST}'
        archiveArtifacts artifacts: 'test_results.json'
    }
}
```

### GitLab CI

```yaml
test:
  script:
    - python3 test_payment_switch_api.py --host $API_HOST
  artifacts:
    paths:
      - test_results.json
```

## Performance Benchmarking

Run multiple times and compare results:

```bash
# Run 10 times and collect results
for i in {1..10}; do
  python3 test_payment_switch_api.py --output "results_$i.json"
  sleep 5
done

# Analyze average latency
jq '.results[].latency_ms' results_*.json | \
  awk '{sum+=$1; count++} END {print "Average:", sum/count, "ms"}'
```

## Troubleshooting

### Services Not Running

**Problem**: Connection refused errors

**Solution**:
```bash
# Check if services are running
docker-compose ps

# Start services if needed
docker-compose up -d

# Wait for services to be healthy
docker-compose ps | grep healthy
```

### Rate Limiting

**Problem**: 429 Too Many Requests

**Solution**:
```bash
# Add delay between test runs
python3 test_payment_switch_api.py
sleep 10
python3 test_payment_switch_api.py
```

### Verbose Debugging

**Problem**: Need more details about failures

**Solution**:
```bash
# Run with verbose flag
python3 test_payment_switch_api.py --verbose

# Or redirect to file
python3 test_payment_switch_api.py --verbose > test_output.log 2>&1
```

## Advanced Usage

### Custom Test Sequence

Modify the script to add custom tests:

```python
# Add your custom test
def test_custom_endpoint(base_url: str, verbose: bool = False):
    url = f"{base_url}/api/v1/custom/endpoint"
    status_code, response, latency = make_request(url, method='GET')
    # ... validation logic
    return result

# Add to main()
result = test_custom_endpoint(args.host, args.verbose)
results.append(result)
```

### Parallel Execution

Run tests in parallel (requires threading):

```python
from concurrent.futures import ThreadPoolExecutor

with ThreadPoolExecutor(max_workers=5) as executor:
    futures = [
        executor.submit(test_health_check, base_url),
        executor.submit(test_fraud_score, base_url),
        # ... other tests
    ]
    results = [f.result() for f in futures]
```

## Monitoring Integration

### Prometheus Metrics

Export results to Prometheus format:

```bash
# Convert JSON to Prometheus metrics
cat test_results.json | jq -r '
  .results[] | 
  "api_test_latency_ms{test=\"\(.test)\"} \(.latency_ms)\n" +
  "api_test_status_code{test=\"\(.test)\"} \(.status_code)"
' > metrics.prom
```

### Grafana Dashboard

Import test results into Grafana using JSON API.

## License

This script is part of the Next-Generation Payment Switch platform.

## Support

For issues or questions:
1. Check Docker services are running: `docker-compose ps`
2. Check API gateway logs: `docker-compose logs nginx`
3. Run with `--verbose` flag for debugging
4. Review `test_results.json` for detailed error messages

## Version History

- **v1.0** (2024-11-03): Initial release
  - 5 core API tests
  - Color-coded output
  - JSON export
  - Latency measurement
  - Comprehensive error handling
