# Makefile for Agent Banking Platform Testing

.PHONY: help test test-unit test-integration test-e2e test-performance test-load test-all coverage lint format clean

help:
	@echo "Agent Banking Platform - Test Commands"
	@echo ""
	@echo "make test-unit          - Run unit tests"
	@echo "make test-integration   - Run integration tests"
	@echo "make test-e2e           - Run end-to-end tests"
	@echo "make test-performance   - Run performance tests"
	@echo "make test-load          - Run load tests"
	@echo "make test-all           - Run all tests"
	@echo "make coverage           - Generate coverage report"
	@echo "make lint               - Run code linters"
	@echo "make format             - Format code"
	@echo "make clean              - Clean test artifacts"

# Install test dependencies
install-test:
	pip install -r tests/requirements-test.txt

# Run unit tests
test-unit:
	cd tests && pytest unit/ -v -m unit --cov=../backend --cov-report=html

# Run integration tests
test-integration:
	cd tests && pytest integration/ -v -m integration

# Run E2E tests
test-e2e:
	cd tests && pytest e2e/ -v -m e2e

# Run performance tests
test-performance:
	cd tests && pytest performance/ -v -m performance --benchmark-only

# Run load tests
test-load:
	cd tests/load && locust -f locustfile.py --headless -u 100 -r 10 -t 60s

# Run all tests
test-all: test-unit test-integration test-e2e test-performance
	@echo "All tests completed!"

# Generate coverage report
coverage:
	cd tests && pytest --cov=../backend --cov-report=html --cov-report=term-missing

# Run linters
lint:
	pylint backend/ --fail-under=8.0
	flake8 backend/ --max-line-length=120
	mypy backend/

# Format code
format:
	black backend/
	isort backend/

# Clean test artifacts
clean:
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	rm -rf tests/coverage/
	rm -rf tests/.pytest_cache/
	rm -rf .coverage

# Smoke tests (quick validation)
smoke:
	cd tests && pytest -v -m smoke --maxfail=1

# Regression tests
regression:
	cd tests && pytest -v -m regression
