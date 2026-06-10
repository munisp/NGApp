#!/bin/bash

# Snyk Dependency Scanning Script
# Scans all payment switch services for dependency vulnerabilities

set -e

# Configuration
OUTPUT_DIR="./snyk-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SEVERITY_THRESHOLD="high"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Services to scan
SERVICES=(
    "payment-gateway"
    "fraud-detection-service"
    "settlement-service"
    "offline-payments-service"
    "fraud-detection"
    "notification-service"
    "batch-processing-service"
    "qr-code-service"
    "social-graph-service"
    "pos-service"
    "p2p-service"
    "subscription-service"
    "invoicing-service"
    "erp-integration-service"
    "approval-workflow-service"
    "payroll-service"
    "corporate-onboarding-service"
    "advanced-analytics-service"
)

# Check if Snyk is installed
if ! command -v snyk &> /dev/null; then
    echo "Installing Snyk CLI..."
    npm install -g snyk
fi

# Authenticate Snyk (requires SNYK_TOKEN environment variable)
if [ -z "$SNYK_TOKEN" ]; then
    echo "Warning: SNYK_TOKEN not set. Please set it to authenticate."
    echo "export SNYK_TOKEN=your-snyk-token"
    exit 1
fi

snyk auth "$SNYK_TOKEN"

# Scan each service
echo "Starting dependency scans..."
for service in "${SERVICES[@]}"; do
    SERVICE_DIR="./services/$service"
    
    if [ ! -d "$SERVICE_DIR" ]; then
        echo "Warning: $SERVICE_DIR not found, skipping..."
        continue
    fi
    
    echo "Scanning $service..."
    
    # Scan Python dependencies
    if [ -f "$SERVICE_DIR/requirements.txt" ]; then
        echo "  Scanning Python dependencies..."
        snyk test \
            --file="$SERVICE_DIR/requirements.txt" \
            --severity-threshold="$SEVERITY_THRESHOLD" \
            --json-file-output="$OUTPUT_DIR/${service}_python_${TIMESTAMP}.json" \
            || true
    fi
    
    # Scan Docker image
    echo "  Scanning Docker image..."
    snyk container test \
        "nextgen-payment-switch/$service:latest" \
        --severity-threshold="$SEVERITY_THRESHOLD" \
        --json-file-output="$OUTPUT_DIR/${service}_container_${TIMESTAMP}.json" \
        || true
    
    # Monitor in Snyk dashboard
    snyk monitor \
        --file="$SERVICE_DIR/requirements.txt" \
        --project-name="payment-switch-$service" \
        || true
done

# Generate summary report
echo "Generating summary report..."
cat > "$OUTPUT_DIR/summary_${TIMESTAMP}.md" << EOF
# Snyk Dependency Scan Summary

**Scan Date**: $(date)
**Severity Threshold**: $SEVERITY_THRESHOLD

## Scanned Services

| Service | Critical | High | Medium | Low |
|---------|----------|------|--------|-----|
EOF

for service in "${SERVICES[@]}"; do
    if [ -f "$OUTPUT_DIR/${service}_python_${TIMESTAMP}.json" ]; then
        CRITICAL=$(jq '[.vulnerabilities[]? | select(.severity=="critical")] | length' "$OUTPUT_DIR/${service}_python_${TIMESTAMP}.json" 2>/dev/null || echo "0")
        HIGH=$(jq '[.vulnerabilities[]? | select(.severity=="high")] | length' "$OUTPUT_DIR/${service}_python_${TIMESTAMP}.json" 2>/dev/null || echo "0")
        MEDIUM=$(jq '[.vulnerabilities[]? | select(.severity=="medium")] | length' "$OUTPUT_DIR/${service}_python_${TIMESTAMP}.json" 2>/dev/null || echo "0")
        LOW=$(jq '[.vulnerabilities[]? | select(.severity=="low")] | length' "$OUTPUT_DIR/${service}_python_${TIMESTAMP}.json" 2>/dev/null || echo "0")
        
        echo "| $service | $CRITICAL | $HIGH | $MEDIUM | $LOW |" >> "$OUTPUT_DIR/summary_${TIMESTAMP}.md"
    fi
done

echo ""
echo "Scan complete! Results saved to $OUTPUT_DIR/"
echo "Summary: $OUTPUT_DIR/summary_${TIMESTAMP}.md"
echo ""
echo "View detailed results in Snyk dashboard: https://app.snyk.io"
