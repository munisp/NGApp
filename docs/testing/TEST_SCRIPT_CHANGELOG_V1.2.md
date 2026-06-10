# Test Script Changelog

## Version 1.2 (2024-11-03)

### Added
- **Negative Test Case for Invalid Data Types**
  - New test function: `test_initiate_payment_invalid_types()`
  - Tests type validation for amount field
  - Expects 400 Bad Request status code
  - Validates that string values are rejected for numeric fields

### Changes
- **Test Count**: Increased from 6 to 7 tests
- **Test Numbering**: Updated all test numbers
  - Test 1: Health Check (unchanged)
  - Test 2: Initiate Payment - Positive Case (unchanged)
  - Test 3: Initiate Payment - Missing Fields (unchanged)
  - Test 4: Initiate Payment - Invalid Data Types (NEW)
  - Test 5: Check Fraud Score (was Test 4)
  - Test 6: Check Payment Status (was Test 5)
  - Test 7: Create Settlement Window (was Test 6)

### Test Details

#### Test 4: Initiate Payment - Invalid Data Types

**Purpose**: Validate that the API properly rejects requests with invalid data types

**Request**:
```json
{
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
    "value": "not_a_number"
  },
  "transactionType": "P2P",
  "channel": "MOBILE"
}
```

**Invalid Field**:
- `amount.value` = `"not_a_number"` (string instead of numeric)

**Expected Response**:
- Status Code: `400 Bad Request`
- Response Body:
```json
{
  "error": "type_error",
  "message": "Invalid data type",
  "details": [
    {
      "field": "amount.value",
      "message": "Input should be a valid number, unable to parse string as a number",
      "type": "float_parsing"
    }
  ]
}
```

**Validation Logic**:
- ✅ PASS if status code is 400
- ✗ FAIL if status code is 200 (type validation bypassed)
- ✗ FAIL if status code is anything else

**Output**:
```
Test 4: Initiate Payment - Negative Case (Invalid Data Types)
────────────────────────────────────────────────────────────
URL: http://localhost/api/v1/payments/initiate
Method: POST
Expected: 400 Bad Request
Status Code: 400
Latency: 28.67 ms
✓ Type validation error correctly returned: type_error
```

### Rationale

**Why This Test Is Important**:

1. **Type Safety**: Ensures the API validates data types before processing
2. **Data Integrity**: Prevents type coercion bugs that could lead to incorrect calculations
3. **Security**: Prevents type confusion attacks
4. **API Robustness**: Validates the API handles malformed data gracefully
5. **Error Messages**: Ensures clear error messages for type mismatches

**What It Tests**:

- ✅ Type validation for numeric fields
- ✅ Proper HTTP status code (400 for type errors)
- ✅ Error response structure
- ✅ Field-specific error messages
- ✅ Prevention of type coercion

**Common Type Validation Scenarios**:

| Scenario | Input | Expected Result |
|----------|-------|-----------------|
| String for amount | `"not_a_number"` | 400 Bad Request |
| String for amount | `"100.00"` | May accept (string to float) or reject |
| Null for amount | `null` | 400 Bad Request |
| Object for amount | `{}` | 400 Bad Request |
| Array for amount | `[]` | 400 Bad Request |
| Boolean for amount | `true` | 400 Bad Request |

### Implementation Details

**Function Signature**:
```python
def test_initiate_payment_invalid_types(
    base_url: str, 
    verbose: bool = False
) -> Dict[str, Any]
```

**Return Value**:
```python
{
    'test': 'Initiate Payment - Invalid Data Types',
    'url': 'http://localhost/api/v1/payments/initiate',
    'method': 'POST',
    'status_code': 400,
    'latency_ms': 28.67,
    'success': True,  # True because we expected 400
    'response': {...},
    'expected_status': 400,
    'test_type': 'type_validation'
}
```

**Key Features**:
- Sends payload with string value for numeric field
- Validates status code is exactly 400
- Extracts and displays type validation error details
- Marks test as PASS if 400 is returned
- Marks test as FAIL if 200 is returned (critical bug)

### Coverage Enhancement

**Validation Coverage Matrix**:

| Test | Validates | Status Code |
|------|-----------|-------------|
| Test 2 (Positive) | Valid payment | 200 |
| Test 3 (Missing Fields) | Required field validation | 400 |
| Test 4 (Invalid Types) | Type validation | 400 |

**Total Negative Test Coverage**: 2 tests
- Missing required fields
- Invalid data types

### Performance Impact

**Minimal**:
- Added ~30ms to total test time
- One additional API call
- Total time: ~395ms → ~425ms

### Backward Compatibility

✅ **Fully Backward Compatible**
- All existing tests still work
- No breaking changes to CLI
- JSON output format unchanged
- Exit codes unchanged

---

## Version 1.1 (2024-11-03)

### Added
- **Negative Test Case for Missing Required Fields**
  - New test function: `test_initiate_payment_negative()`
  - Tests validation of required fields
  - Expects 400 Bad Request status code
  - Validates error response structure

### Changes
- **Test Count**: Increased from 5 to 6 tests
- **Test Numbering**: Updated all test numbers

---

## Version 1.0 (2024-11-03)

### Initial Release
- 5 core API tests
- Health check
- Initiate payment (positive case only)
- Fraud score check
- Payment status check
- Settlement window creation
- Color-coded output
- JSON export
- Latency measurement
- Comprehensive error handling

---

## Summary of Changes

| Version | Tests | Positive | Negative | Coverage |
|---------|-------|----------|----------|----------|
| 1.0 | 5 | 5 | 0 | Basic |
| 1.1 | 6 | 5 | 1 | + Missing fields |
| 1.2 | 7 | 5 | 2 | + Invalid types |

## Future Enhancements

**Additional Negative Tests to Consider**:

1. **Business Rule Violations**:
   - Amount exceeds transaction limit
   - Blacklisted account
   - Unsupported currency

2. **Edge Cases**:
   - Zero amount
   - Negative amount
   - Extremely large amount (overflow)

3. **Format Validation**:
   - Invalid phone number format
   - Invalid currency code (not ISO 4217)
   - Invalid transaction type

4. **Rate Limiting**:
   - Exceed rate limit (expect 429)
   - Burst limit exceeded

5. **Authentication/Authorization**:
   - Missing API key (expect 401)
   - Invalid API key (expect 403)
   - Insufficient permissions (expect 403)

## Migration Guide

**If You Have Existing Test Scripts**:

No changes needed! The script is backward compatible.

**If You Parse Test Results**:

Update your parser to handle 7 tests instead of 6:
```python
# Old (v1.1)
assert len(results['results']) == 6

# New (v1.2)
assert len(results['results']) == 7
```

## Testing Best Practices Demonstrated

✅ **Comprehensive Coverage**: Positive + multiple negative cases  
✅ **Type Safety**: Validates data type enforcement  
✅ **Clear Expectations**: Explicit expected status codes  
✅ **Detailed Errors**: Shows validation error details  
✅ **Security Focus**: Flags validation bypass vulnerabilities  
✅ **Maintainability**: Well-documented and easy to extend  

## Documentation Updates

**Files Updated**:
1. `test_payment_switch_api.py` - Main script (v1.2)
2. `TEST_SCRIPT_CHANGELOG_V1.2.md` - This file
3. `example_test_output_v1.2.txt` - Example output with 7 tests

**Files to Update** (if needed):
1. `TEST_SCRIPT_README.md` - Update test count from 6 to 7
2. CI/CD configurations - No changes needed (auto-detects test count)
