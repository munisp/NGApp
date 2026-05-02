#!/usr/bin/env python3
"""
Payment Switch API Test Suite
Tests all 5 core API endpoints and reports status codes and latency.

Usage:
    python3 test_payment_switch_api.py
    python3 test_payment_switch_api.py --host http://localhost
    python3 test_payment_switch_api.py --verbose
"""

import sys
import json
import time
import argparse
from datetime import datetime
from typing import Dict, Any, Tuple
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

# ANSI color codes for terminal output
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_header(text: str):
    """Print a formatted header."""
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'=' * 80}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{text.center(80)}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'=' * 80}{Colors.ENDC}\n")

def print_test(test_name: str, test_num: int):
    """Print test name."""
    print(f"{Colors.OKCYAN}{Colors.BOLD}Test {test_num}: {test_name}{Colors.ENDC}")
    print(f"{Colors.OKCYAN}{'-' * 80}{Colors.ENDC}")

def print_success(message: str):
    """Print success message."""
    print(f"{Colors.OKGREEN}✓ {message}{Colors.ENDC}")

def print_error(message: str):
    """Print error message."""
    print(f"{Colors.FAIL}✗ {message}{Colors.ENDC}")

def print_warning(message: str):
    """Print warning message."""
    print(f"{Colors.WARNING}⚠ {message}{Colors.ENDC}")

def print_info(key: str, value: Any):
    """Print info key-value pair."""
    print(f"{Colors.OKBLUE}{key}:{Colors.ENDC} {value}")

def make_request(
    url: str,
    method: str = 'GET',
    data: Dict[str, Any] = None,
    headers: Dict[str, str] = None
) -> Tuple[int, Dict[str, Any], float]:
    """
    Make HTTP request and return status code, response data, and latency.
    
    Args:
        url: The URL to request
        method: HTTP method (GET, POST, etc.)
        data: Request body data (will be JSON encoded)
        headers: Request headers
        
    Returns:
        Tuple of (status_code, response_data, latency_ms)
    """
    if headers is None:
        headers = {}
    
    # Set default headers
    if 'Content-Type' not in headers:
        headers['Content-Type'] = 'application/json'
    if 'Accept' not in headers:
        headers['Accept'] = 'application/json'
    
    # Prepare request body
    request_body = None
    if data is not None:
        request_body = json.dumps(data).encode('utf-8')
    
    # Create request
    req = Request(url, data=request_body, headers=headers, method=method)
    
    # Make request and measure latency
    start_time = time.time()
    try:
        with urlopen(req, timeout=10) as response:
            latency_ms = (time.time() - start_time) * 1000
            status_code = response.getcode()
            response_data = json.loads(response.read().decode('utf-8'))
            return status_code, response_data, latency_ms
    except HTTPError as e:
        latency_ms = (time.time() - start_time) * 1000
        try:
            response_data = json.loads(e.read().decode('utf-8'))
        except:
            response_data = {'error': str(e)}
        return e.code, response_data, latency_ms
    except URLError as e:
        latency_ms = (time.time() - start_time) * 1000
        return 0, {'error': f'Connection failed: {str(e)}'}, latency_ms
    except Exception as e:
        latency_ms = (time.time() - start_time) * 1000
        return 0, {'error': str(e)}, latency_ms

def test_health_check(base_url: str, verbose: bool = False) -> Dict[str, Any]:
    """Test 1: Health Check - Payment Gateway"""
    print_test("Health Check - Payment Gateway", 1)
    
    url = f"{base_url}/api/v1/payments/health"
    print_info("URL", url)
    print_info("Method", "GET")
    
    status_code, response, latency = make_request(url, method='GET')
    
    print_info("Status Code", status_code)
    print_info("Latency", f"{latency:.2f} ms")
    
    if verbose:
        print_info("Response", json.dumps(response, indent=2))
    
    # Validate response
    success = status_code == 200
    if success:
        print_success("Health check passed")
    else:
        print_error(f"Health check failed: {response.get('error', 'Unknown error')}")
    
    return {
        'test': 'Health Check',
        'url': url,
        'method': 'GET',
        'status_code': status_code,
        'latency_ms': latency,
        'success': success,
        'response': response
    }

def test_initiate_payment(base_url: str, verbose: bool = False) -> Dict[str, Any]:
    """Test 2: Initiate Payment (Positive Case)"""
    print_test("Initiate Payment (P2P Transfer) - Positive Case", 2)
    
    url = f"{base_url}/api/v1/payments/initiate"
    print_info("URL", url)
    print_info("Method", "POST")
    
    # Generate unique transaction reference
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    
    payload = {
        "source": {
            "type": "MSISDN",
            "identifier": "+1234567890"
        },
        "destination": {
            "type": "MSISDN",
            "identifier": "+0987654321"
        },
        "amount": {
            "currency": "USD",
            "value": "100.00"
        },
        "transactionType": "P2P",
        "channel": "MOBILE",
        "metadata": {
            "description": "API Test Payment",
            "reference": f"TEST-{timestamp}"
        }
    }
    
    if verbose:
        print_info("Payload", json.dumps(payload, indent=2))
    
    status_code, response, latency = make_request(url, method='POST', data=payload)
    
    print_info("Status Code", status_code)
    print_info("Latency", f"{latency:.2f} ms")
    
    if verbose:
        print_info("Response", json.dumps(response, indent=2))
    
    # Validate response
    success = status_code == 200 and 'transaction_id' in response
    if success:
        print_success(f"Payment initiated: {response.get('transaction_id')}")
        transaction_id = response.get('transaction_id')
    else:
        print_error(f"Payment initiation failed: {response.get('error', 'Unknown error')}")
        transaction_id = None
    
    return {
        'test': 'Initiate Payment',
        'url': url,
        'method': 'POST',
        'status_code': status_code,
        'latency_ms': latency,
        'success': success,
        'response': response,
        'transaction_id': transaction_id
    }

def test_initiate_payment_negative(base_url: str, verbose: bool = False) -> Dict[str, Any]:
    """Test 3: Initiate Payment (Negative Case - Missing Required Fields)"""
    print_test("Initiate Payment - Negative Case (Missing Required Fields)", 3)
    
    url = f"{base_url}/api/v1/payments/initiate"
    print_info("URL", url)
    print_info("Method", "POST")
    print_info("Expected", "400 Bad Request")
    
    # Payload with missing required fields (no destination, no amount)
    payload = {
        "source": {
            "type": "MSISDN",
            "identifier": "+1234567890"
        },
        "transactionType": "P2P",
        "channel": "MOBILE"
        # Missing: destination, amount
    }
    
    if verbose:
        print_info("Payload", json.dumps(payload, indent=2))
        print_info("Note", "Missing 'destination' and 'amount' fields")
    
    status_code, response, latency = make_request(url, method='POST', data=payload)
    
    print_info("Status Code", status_code)
    print_info("Latency", f"{latency:.2f} ms")
    
    if verbose:
        print_info("Response", json.dumps(response, indent=2))
    
    # Validate response - expect 400 Bad Request
    success = status_code == 400
    if success:
        error_msg = response.get('error', response.get('message', 'Unknown error'))
        print_success(f"Validation error correctly returned: {error_msg}")
        if 'details' in response:
            print_info("Validation Details", json.dumps(response['details'], indent=2))
    elif status_code == 200:
        print_error("Payment should have been rejected but was accepted!")
    else:
        print_error(f"Unexpected status code: {status_code} (expected 400)")
    
    return {
        'test': 'Initiate Payment - Negative Case',
        'url': url,
        'method': 'POST',
        'status_code': status_code,
        'latency_ms': latency,
        'success': success,
        'response': response,
        'expected_status': 400
    }

def test_initiate_payment_invalid_types(base_url: str, verbose: bool = False) -> Dict[str, Any]:
    """Test 4: Initiate Payment (Negative Case - Invalid Data Types)"""
    print_test("Initiate Payment - Negative Case (Invalid Data Types)", 4)
    
    url = f"{base_url}/api/v1/payments/initiate"
    print_info("URL", url)
    print_info("Method", "POST")
    print_info("Expected", "400 Bad Request")
    
    # Payload with invalid data type for amount (string instead of number)
    payload = {
        "source": {
            "type": "MSISDN",
            "identifier": "+1234567890"
        },
        "destination": {
            "type": "MSISDN",
            "identifier": "+0987654321"
        },
        "amount": {
            "currency": "USD",
            "value": "not_a_number"  # Invalid: string instead of numeric
        },
        "transactionType": "P2P",
        "channel": "MOBILE"
    }
    
    if verbose:
        print_info("Payload", json.dumps(payload, indent=2))
        print_info("Note", "Amount value is string 'not_a_number' instead of numeric")
    
    status_code, response, latency = make_request(url, method='POST', data=payload)
    
    print_info("Status Code", status_code)
    print_info("Latency", f"{latency:.2f} ms")
    
    if verbose:
        print_info("Response", json.dumps(response, indent=2))
    
    # Validate response - expect 400 Bad Request
    success = status_code == 400
    if success:
        error_msg = response.get('error', response.get('message', 'Unknown error'))
        print_success(f"Type validation error correctly returned: {error_msg}")
        if 'details' in response:
            print_info("Validation Details", json.dumps(response['details'], indent=2))
    elif status_code == 200:
        print_error("Payment should have been rejected due to invalid data type!")
    else:
        print_error(f"Unexpected status code: {status_code} (expected 400)")
    
    return {
        'test': 'Initiate Payment - Invalid Data Types',
        'url': url,
        'method': 'POST',
        'status_code': status_code,
        'latency_ms': latency,
        'success': success,
        'response': response,
        'expected_status': 400,
        'test_type': 'type_validation'
    }

def test_fraud_score(base_url: str, transaction_id: str = None, verbose: bool = False) -> Dict[str, Any]:
    """Test 5: Check Fraud Score"""
    print_test("Check Fraud Score", 5)
    
    url = f"{base_url}/api/v1/fraud/score"
    print_info("URL", url)
    print_info("Method", "POST")
    
    # Use provided transaction_id or generate a test one
    if transaction_id is None:
        transaction_id = f"txn_test_{int(time.time())}"
    
    payload = {
        "transaction_id": transaction_id,
        "payer_id": "user_12345",
        "payee_id": "user_67890",
        "amount": 100.00,
        "currency": "USD",
        "channel": "MOBILE",
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "metadata": {
            "device_id": "device_test_001",
            "ip_address": "192.168.1.100",
            "location": {
                "latitude": 40.7128,
                "longitude": -74.0060
            }
        }
    }
    
    if verbose:
        print_info("Payload", json.dumps(payload, indent=2))
    
    status_code, response, latency = make_request(url, method='POST', data=payload)
    
    print_info("Status Code", status_code)
    print_info("Latency", f"{latency:.2f} ms")
    
    if verbose:
        print_info("Response", json.dumps(response, indent=2))
    
    # Validate response
    success = status_code == 200 and 'fraud_score' in response
    if success:
        fraud_score = response.get('fraud_score', 0)
        risk_level = response.get('risk_level', 'UNKNOWN')
        recommendation = response.get('recommendation', 'UNKNOWN')
        print_success(f"Fraud score: {fraud_score:.2f} | Risk: {risk_level} | Recommendation: {recommendation}")
    else:
        print_error(f"Fraud check failed: {response.get('error', 'Unknown error')}")
    
    return {
        'test': 'Fraud Score Check',
        'url': url,
        'method': 'POST',
        'status_code': status_code,
        'latency_ms': latency,
        'success': success,
        'response': response
    }

def test_payment_status(base_url: str, transaction_id: str = None, verbose: bool = False) -> Dict[str, Any]:
    """Test 6: Check Payment Status"""
    print_test("Check Payment Status", 6)
    
    url = f"{base_url}/api/v1/payments/status"
    print_info("URL", url)
    print_info("Method", "POST")
    
    # Use provided transaction_id or generate a test one
    if transaction_id is None:
        transaction_id = f"txn_test_{int(time.time())}"
    
    payload = {
        "transaction_id": transaction_id
    }
    
    if verbose:
        print_info("Payload", json.dumps(payload, indent=2))
    
    status_code, response, latency = make_request(url, method='POST', data=payload)
    
    print_info("Status Code", status_code)
    print_info("Latency", f"{latency:.2f} ms")
    
    if verbose:
        print_info("Response", json.dumps(response, indent=2))
    
    # Validate response (accept 200 or 404 as valid)
    success = status_code in [200, 404]
    if status_code == 200:
        payment_status = response.get('status', 'UNKNOWN')
        print_success(f"Payment status: {payment_status}")
    elif status_code == 404:
        print_warning(f"Transaction not found: {transaction_id}")
    else:
        print_error(f"Status check failed: {response.get('error', 'Unknown error')}")
    
    return {
        'test': 'Payment Status Check',
        'url': url,
        'method': 'POST',
        'status_code': status_code,
        'latency_ms': latency,
        'success': success,
        'response': response
    }

def test_settlement_window(base_url: str, verbose: bool = False) -> Dict[str, Any]:
    """Test 7: Create Settlement Window"""
    print_test("Create Settlement Window", 7)
    
    url = f"{base_url}/api/v1/settlement/windows/create"
    print_info("URL", url)
    print_info("Method", "POST")
    
    # Generate settlement window for today
    now = datetime.utcnow()
    start_time = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end_time = now.replace(hour=23, minute=59, second=59, microsecond=0)
    
    payload = {
        "start_time": start_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "end_time": end_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "settlement_model": "DEFERRED_NET",
        "currency": "USD",
        "participants": [
            "dfsp_001",
            "dfsp_002",
            "dfsp_003"
        ]
    }
    
    if verbose:
        print_info("Payload", json.dumps(payload, indent=2))
    
    status_code, response, latency = make_request(url, method='POST', data=payload)
    
    print_info("Status Code", status_code)
    print_info("Latency", f"{latency:.2f} ms")
    
    if verbose:
        print_info("Response", json.dumps(response, indent=2))
    
    # Validate response
    success = status_code == 200 and 'window_id' in response
    if success:
        window_id = response.get('window_id')
        window_status = response.get('status', 'UNKNOWN')
        print_success(f"Settlement window created: {window_id} | Status: {window_status}")
    else:
        print_error(f"Settlement window creation failed: {response.get('error', 'Unknown error')}")
    
    return {
        'test': 'Create Settlement Window',
        'url': url,
        'method': 'POST',
        'status_code': status_code,
        'latency_ms': latency,
        'success': success,
        'response': response
    }

def print_summary(results: list):
    """Print test summary."""
    print_header("TEST SUMMARY")
    
    total_tests = len(results)
    passed_tests = sum(1 for r in results if r['success'])
    failed_tests = total_tests - passed_tests
    
    # Calculate statistics
    total_latency = sum(r['latency_ms'] for r in results)
    avg_latency = total_latency / total_tests if total_tests > 0 else 0
    min_latency = min(r['latency_ms'] for r in results) if results else 0
    max_latency = max(r['latency_ms'] for r in results) if results else 0
    
    # Print summary table
    print(f"{'Test Name':<30} {'Status Code':<15} {'Latency (ms)':<15} {'Result':<10}")
    print(f"{'-' * 70}")
    
    for result in results:
        test_name = result['test']
        status_code = result['status_code']
        latency = f"{result['latency_ms']:.2f}"
        success = "✓ PASS" if result['success'] else "✗ FAIL"
        
        # Color code the result
        if result['success']:
            result_str = f"{Colors.OKGREEN}{success}{Colors.ENDC}"
        else:
            result_str = f"{Colors.FAIL}{success}{Colors.ENDC}"
        
        print(f"{test_name:<30} {status_code:<15} {latency:<15} {result_str}")
    
    print(f"{'-' * 70}")
    print(f"\n{Colors.BOLD}Overall Statistics:{Colors.ENDC}")
    print(f"  Total Tests:     {total_tests}")
    print(f"  Passed:          {Colors.OKGREEN}{passed_tests}{Colors.ENDC}")
    print(f"  Failed:          {Colors.FAIL}{failed_tests}{Colors.ENDC}")
    print(f"  Success Rate:    {(passed_tests/total_tests*100):.1f}%")
    print(f"\n{Colors.BOLD}Latency Statistics:{Colors.ENDC}")
    print(f"  Average:         {avg_latency:.2f} ms")
    print(f"  Minimum:         {min_latency:.2f} ms")
    print(f"  Maximum:         {max_latency:.2f} ms")
    print(f"  Total:           {total_latency:.2f} ms")
    
    # Overall result
    print()
    if failed_tests == 0:
        print(f"{Colors.OKGREEN}{Colors.BOLD}✓ ALL TESTS PASSED{Colors.ENDC}")
    else:
        print(f"{Colors.FAIL}{Colors.BOLD}✗ {failed_tests} TEST(S) FAILED{Colors.ENDC}")
    
    return passed_tests == total_tests

def save_results(results: list, filename: str = 'test_results.json'):
    """Save test results to JSON file."""
    output = {
        'timestamp': datetime.utcnow().isoformat(),
        'total_tests': len(results),
        'passed': sum(1 for r in results if r['success']),
        'failed': sum(1 for r in results if not r['success']),
        'results': results
    }
    
    with open(filename, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"\n{Colors.OKBLUE}Results saved to: {filename}{Colors.ENDC}")

def main():
    """Main test execution."""
    parser = argparse.ArgumentParser(
        description='Test Payment Switch API endpoints',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  python3 test_payment_switch_api.py
  python3 test_payment_switch_api.py --host http://localhost
  python3 test_payment_switch_api.py --verbose
  python3 test_payment_switch_api.py --output results.json
        '''
    )
    parser.add_argument(
        '--host',
        default='http://localhost',
        help='Base URL of the API gateway (default: http://localhost)'
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Print verbose output including request/response bodies'
    )
    parser.add_argument(
        '--output', '-o',
        default='test_results.json',
        help='Output file for test results (default: test_results.json)'
    )
    
    args = parser.parse_args()
    
    print_header("PAYMENT SWITCH API TEST SUITE")
    print_info("Base URL", args.host)
    print_info("Timestamp", datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"))
    print_info("Verbose", "Enabled" if args.verbose else "Disabled")
    
    results = []
    transaction_id = None
    
    try:
        # Test 1: Health Check
        result = test_health_check(args.host, args.verbose)
        results.append(result)
        print()
        time.sleep(0.5)  # Small delay between tests
        
        # Test 2: Initiate Payment (Positive)
        result = test_initiate_payment(args.host, args.verbose)
        results.append(result)
        transaction_id = result.get('transaction_id')
        print()
        time.sleep(0.5)
        
        # Test 3: Initiate Payment (Negative - Missing Fields)
        result = test_initiate_payment_negative(args.host, args.verbose)
        results.append(result)
        print()
        time.sleep(0.5)
        
        # Test 4: Initiate Payment (Negative - Invalid Data Types)
        result = test_initiate_payment_invalid_types(args.host, args.verbose)
        results.append(result)
        print()
        time.sleep(0.5)
        
        # Test 5: Check Fraud Score
        result = test_fraud_score(args.host, transaction_id, args.verbose)
        results.append(result)
        print()
        time.sleep(0.5)
        
        # Test 6: Check Payment Status
        result = test_payment_status(args.host, transaction_id, args.verbose)
        results.append(result)
        print()
        time.sleep(0.5)
        
        # Test 7: Create Settlement Window
        result = test_settlement_window(args.host, args.verbose)
        results.append(result)
        print()
        
    except KeyboardInterrupt:
        print(f"\n\n{Colors.WARNING}Tests interrupted by user{Colors.ENDC}")
        return 1
    except Exception as e:
        print(f"\n\n{Colors.FAIL}Unexpected error: {str(e)}{Colors.ENDC}")
        return 1
    
    # Print summary
    all_passed = print_summary(results)
    
    # Save results
    save_results(results, args.output)
    
    # Return exit code
    return 0 if all_passed else 1

if __name__ == '__main__':
    sys.exit(main())
