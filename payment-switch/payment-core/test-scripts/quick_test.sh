#!/bin/bash
# Quick test script for Payment Switch API

echo "=========================================="
echo "Payment Switch API - Quick Test"
echo "=========================================="
echo ""

# Check if services are running
echo "Checking if Docker services are running..."
if command -v docker-compose &> /dev/null; then
    docker-compose ps 2>/dev/null || echo "⚠ Docker Compose not available or services not running"
else
    echo "⚠ Docker not available in this environment"
fi

echo ""
echo "Running API tests..."
echo ""

# Run the test script
python3 test_payment_switch_api.py "$@"

exit_code=$?

echo ""
if [ $exit_code -eq 0 ]; then
    echo "✓ All tests completed successfully!"
else
    echo "✗ Some tests failed. Check output above for details."
fi

exit $exit_code
