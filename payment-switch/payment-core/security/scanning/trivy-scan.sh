#!/bin/bash

# Trivy Container Image Scanning Script
# Scans all payment switch container images for vulnerabilities

set -e

# Configuration
TRIVY_VERSION="0.48.0"
SEVERITY="CRITICAL,HIGH,MEDIUM"
OUTPUT_DIR="./scan-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

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

# Install Trivy if not present
if ! command -v trivy &> /dev/null; then
    echo "Installing Trivy..."
    wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add -
    echo "deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | sudo tee -a /etc/apt/sources.list.d/trivy.list
    sudo apt-get update
    sudo apt-get install trivy -y
fi

# Update vulnerability database
echo "Updating Trivy vulnerability database..."
trivy image --download-db-only

# Scan each service
echo "Starting vulnerability scans..."
for service in "${SERVICES[@]}"; do
    echo "Scanning $service..."
    
    # Scan and generate JSON report
    trivy image \
        --severity "$SEVERITY" \
        --format json \
        --output "$OUTPUT_DIR/${service}_${TIMESTAMP}.json" \
        "nextgen-payment-switch/$service:latest"
    
    # Scan and generate table report
    trivy image \
        --severity "$SEVERITY" \
        --format table \
        --output "$OUTPUT_DIR/${service}_${TIMESTAMP}.txt" \
        "nextgen-payment-switch/$service:latest"
    
    # Scan and generate SARIF report for GitHub
    trivy image \
        --severity "$SEVERITY" \
        --format sarif \
        --output "$OUTPUT_DIR/${service}_${TIMESTAMP}.sarif" \
        "nextgen-payment-switch/$service:latest"
done

# Generate summary report
echo "Generating summary report..."
cat > "$OUTPUT_DIR/summary_${TIMESTAMP}.md" << EOF
# Vulnerability Scan Summary

**Scan Date**: $(date)
**Trivy Version**: $(trivy --version | head -n1)
**Severity Levels**: $SEVERITY

## Scanned Services

EOF

for service in "${SERVICES[@]}"; do
    CRITICAL=$(jq '[.Results[].Vulnerabilities[]? | select(.Severity=="CRITICAL")] | length' "$OUTPUT_DIR/${service}_${TIMESTAMP}.json")
    HIGH=$(jq '[.Results[].Vulnerabilities[]? | select(.Severity=="HIGH")] | length' "$OUTPUT_DIR/${service}_${TIMESTAMP}.json")
    MEDIUM=$(jq '[.Results[].Vulnerabilities[]? | select(.Severity=="MEDIUM")] | length' "$OUTPUT_DIR/${service}_${TIMESTAMP}.json")
    
    echo "| $service | $CRITICAL | $HIGH | $MEDIUM |" >> "$OUTPUT_DIR/summary_${TIMESTAMP}.md"
done

echo ""
echo "Scan complete! Results saved to $OUTPUT_DIR/"
echo "Summary: $OUTPUT_DIR/summary_${TIMESTAMP}.md"
