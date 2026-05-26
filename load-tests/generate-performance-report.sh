#!/bin/bash

# Performance Report Generator
# Analyzes load test results and generates comprehensive HTML report

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
RESULTS_DIR="results"
REPORTS_DIR="reports"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
REPORT_FILE="$REPORTS_DIR/performance-report-$TIMESTAMP.html"

# Performance targets
TARGET_PAYMENT_TPS=10000
TARGET_FRAUD_TPS=5000
TARGET_P95_MS=100
TARGET_P99_MS=500
TARGET_ERROR_RATE=0.001

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Performance Report Generator                          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Create directories
mkdir -p "$RESULTS_DIR"
mkdir -p "$REPORTS_DIR"

# Find latest test results
LATEST_PAYMENT=$(ls -t $RESULTS_DIR/payment-test-*.json 2>/dev/null | head -1)
LATEST_FRAUD=$(ls -t $RESULTS_DIR/fraud-test-*.json 2>/dev/null | head -1)

if [ -z "$LATEST_PAYMENT" ] && [ -z "$LATEST_FRAUD" ]; then
    echo -e "${RED}✗ No test results found in $RESULTS_DIR${NC}"
    echo "Run load tests first:"
    echo "  ./run-all-tests.sh local"
    exit 1
fi

echo "Analyzing test results..."
echo ""

# Function to extract metric from k6 JSON
extract_metric() {
    local file="$1"
    local metric="$2"
    local stat="$3"
    
    if [ -f "$file" ]; then
        jq -r ".metrics[\"$metric\"].$stat // 0" "$file"
    else
        echo "0"
    fi
}

# Extract payment test metrics
if [ -n "$LATEST_PAYMENT" ]; then
    echo -e "${BLUE}Payment Processing Test:${NC} $(basename $LATEST_PAYMENT)"
    
    PAYMENT_TPS=$(extract_metric "$LATEST_PAYMENT" "http_reqs" "rate")
    PAYMENT_P95=$(extract_metric "$LATEST_PAYMENT" "http_req_duration" "p(95)")
    PAYMENT_P99=$(extract_metric "$LATEST_PAYMENT" "http_req_duration" "p(99)")
    PAYMENT_AVG=$(extract_metric "$LATEST_PAYMENT" "http_req_duration" "avg")
    PAYMENT_ERRORS=$(extract_metric "$LATEST_PAYMENT" "http_req_failed" "rate")
    PAYMENT_CHECKS=$(extract_metric "$LATEST_PAYMENT" "checks" "passes")
    
    echo "  TPS: $PAYMENT_TPS"
    echo "  P95: ${PAYMENT_P95}ms"
    echo "  P99: ${PAYMENT_P99}ms"
    echo "  Error Rate: $PAYMENT_ERRORS"
    echo ""
fi

# Extract fraud test metrics
if [ -n "$LATEST_FRAUD" ]; then
    echo -e "${BLUE}Fraud Detection Test:${NC} $(basename $LATEST_FRAUD)"
    
    FRAUD_TPS=$(extract_metric "$LATEST_FRAUD" "http_reqs" "rate")
    FRAUD_P95=$(extract_metric "$LATEST_FRAUD" "http_req_duration" "p(95)")
    FRAUD_P99=$(extract_metric "$LATEST_FRAUD" "http_req_duration" "p(99)")
    FRAUD_AVG=$(extract_metric "$LATEST_FRAUD" "http_req_duration" "avg")
    FRAUD_ERRORS=$(extract_metric "$LATEST_FRAUD" "http_req_failed" "rate")
    FRAUD_CHECKS=$(extract_metric "$LATEST_FRAUD" "checks" "passes")
    
    echo "  TPS: $FRAUD_TPS"
    echo "  P95: ${FRAUD_P95}ms"
    echo "  P99: ${FRAUD_P99}ms"
    echo "  Error Rate: $FRAUD_ERRORS"
    echo ""
fi

# Generate HTML report
echo "Generating HTML report..."

cat > "$REPORT_FILE" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Test Report</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        header {
            border-bottom: 3px solid #2563eb;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        
        h1 {
            color: #1e40af;
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        
        .meta {
            color: #666;
            font-size: 0.9em;
        }
        
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        
        .card {
            background: #f8fafc;
            border-left: 4px solid #2563eb;
            padding: 20px;
            border-radius: 4px;
        }
        
        .card.success {
            border-left-color: #10b981;
            background: #f0fdf4;
        }
        
        .card.warning {
            border-left-color: #f59e0b;
            background: #fffbeb;
        }
        
        .card.error {
            border-left-color: #ef4444;
            background: #fef2f2;
        }
        
        .card h3 {
            color: #1e40af;
            font-size: 0.9em;
            text-transform: uppercase;
            margin-bottom: 10px;
        }
        
        .card .value {
            font-size: 2em;
            font-weight: bold;
            color: #1e293b;
        }
        
        .card .target {
            font-size: 0.85em;
            color: #64748b;
            margin-top: 5px;
        }
        
        .status {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.85em;
            font-weight: 600;
            margin-top: 8px;
        }
        
        .status.pass {
            background: #d1fae5;
            color: #065f46;
        }
        
        .status.fail {
            background: #fee2e2;
            color: #991b1b;
        }
        
        section {
            margin: 40px 0;
        }
        
        h2 {
            color: #1e40af;
            font-size: 1.8em;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e5e7eb;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
        }
        
        th {
            background: #f8fafc;
            color: #1e40af;
            font-weight: 600;
        }
        
        tr:hover {
            background: #f8fafc;
        }
        
        .metric-good {
            color: #10b981;
            font-weight: 600;
        }
        
        .metric-bad {
            color: #ef4444;
            font-weight: 600;
        }
        
        .recommendations {
            background: #fffbeb;
            border-left: 4px solid #f59e0b;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
        }
        
        .recommendations h3 {
            color: #92400e;
            margin-bottom: 10px;
        }
        
        .recommendations ul {
            margin-left: 20px;
        }
        
        .recommendations li {
            margin: 8px 0;
            color: #78350f;
        }
        
        footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #e5e7eb;
            text-align: center;
            color: #64748b;
            font-size: 0.9em;
        }
        
        .chart-placeholder {
            background: #f8fafc;
            border: 2px dashed #cbd5e1;
            border-radius: 4px;
            padding: 40px;
            text-align: center;
            color: #64748b;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🚀 Performance Test Report</h1>
            <div class="meta">
                <strong>Generated:</strong> TIMESTAMP_PLACEHOLDER<br>
                <strong>Platform:</strong> Payment Switch - Web Checkout<br>
                <strong>Environment:</strong> Staging
            </div>
        </header>
        
        <section>
            <h2>Executive Summary</h2>
            <div class="summary">
                <div class="card PAYMENT_TPS_STATUS">
                    <h3>Payment Processing TPS</h3>
                    <div class="value">PAYMENT_TPS_PLACEHOLDER</div>
                    <div class="target">Target: 10,000 TPS</div>
                    <span class="status PAYMENT_TPS_PASS">PAYMENT_TPS_LABEL</span>
                </div>
                
                <div class="card FRAUD_TPS_STATUS">
                    <h3>Fraud Detection TPS</h3>
                    <div class="value">FRAUD_TPS_PLACEHOLDER</div>
                    <div class="target">Target: 5,000 TPS</div>
                    <span class="status FRAUD_TPS_PASS">FRAUD_TPS_LABEL</span>
                </div>
                
                <div class="card PAYMENT_P95_STATUS">
                    <h3>Response Time (P95)</h3>
                    <div class="value">PAYMENT_P95_PLACEHOLDER ms</div>
                    <div class="target">Target: &lt;100ms</div>
                    <span class="status PAYMENT_P95_PASS">PAYMENT_P95_LABEL</span>
                </div>
                
                <div class="card PAYMENT_ERROR_STATUS">
                    <h3>Error Rate</h3>
                    <div class="value">PAYMENT_ERROR_PLACEHOLDER%</div>
                    <div class="target">Target: &lt;0.1%</div>
                    <span class="status PAYMENT_ERROR_PASS">PAYMENT_ERROR_LABEL</span>
                </div>
            </div>
        </section>
        
        <section>
            <h2>Detailed Metrics</h2>
            
            <h3>Payment Processing Test</h3>
            <table>
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>Value</th>
                        <th>Target</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Transactions Per Second</td>
                        <td class="PAYMENT_TPS_CLASS">PAYMENT_TPS_PLACEHOLDER</td>
                        <td>10,000</td>
                        <td>PAYMENT_TPS_LABEL</td>
                    </tr>
                    <tr>
                        <td>Average Response Time</td>
                        <td>PAYMENT_AVG_PLACEHOLDER ms</td>
                        <td>&lt;50ms</td>
                        <td>-</td>
                    </tr>
                    <tr>
                        <td>P95 Response Time</td>
                        <td class="PAYMENT_P95_CLASS">PAYMENT_P95_PLACEHOLDER ms</td>
                        <td>&lt;100ms</td>
                        <td>PAYMENT_P95_LABEL</td>
                    </tr>
                    <tr>
                        <td>P99 Response Time</td>
                        <td class="PAYMENT_P99_CLASS">PAYMENT_P99_PLACEHOLDER ms</td>
                        <td>&lt;500ms</td>
                        <td>PAYMENT_P99_LABEL</td>
                    </tr>
                    <tr>
                        <td>Error Rate</td>
                        <td class="PAYMENT_ERROR_CLASS">PAYMENT_ERROR_PLACEHOLDER%</td>
                        <td>&lt;0.1%</td>
                        <td>PAYMENT_ERROR_LABEL</td>
                    </tr>
                    <tr>
                        <td>Successful Checks</td>
                        <td>PAYMENT_CHECKS_PLACEHOLDER</td>
                        <td>100%</td>
                        <td>-</td>
                    </tr>
                </tbody>
            </table>
            
            <h3>Fraud Detection Test</h3>
            <table>
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>Value</th>
                        <th>Target</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Fraud Checks Per Second</td>
                        <td class="FRAUD_TPS_CLASS">FRAUD_TPS_PLACEHOLDER</td>
                        <td>5,000</td>
                        <td>FRAUD_TPS_LABEL</td>
                    </tr>
                    <tr>
                        <td>Average Response Time</td>
                        <td>FRAUD_AVG_PLACEHOLDER ms</td>
                        <td>&lt;100ms</td>
                        <td>-</td>
                    </tr>
                    <tr>
                        <td>P95 Response Time</td>
                        <td class="FRAUD_P95_CLASS">FRAUD_P95_PLACEHOLDER ms</td>
                        <td>&lt;200ms</td>
                        <td>FRAUD_P95_LABEL</td>
                    </tr>
                    <tr>
                        <td>P99 Response Time</td>
                        <td class="FRAUD_P99_CLASS">FRAUD_P99_PLACEHOLDER ms</td>
                        <td>&lt;1000ms</td>
                        <td>FRAUD_P99_LABEL</td>
                    </tr>
                    <tr>
                        <td>Error Rate</td>
                        <td class="FRAUD_ERROR_CLASS">FRAUD_ERROR_PLACEHOLDER%</td>
                        <td>&lt;0.1%</td>
                        <td>FRAUD_ERROR_LABEL</td>
                    </tr>
                </tbody>
            </table>
        </section>
        
        <section>
            <h2>Performance Analysis</h2>
            
            <div class="chart-placeholder">
                📊 Response Time Distribution Chart
                <br><small>Import k6 results into Grafana for detailed visualizations</small>
            </div>
            
            <div class="chart-placeholder">
                📈 Throughput Over Time Chart
                <br><small>View real-time metrics in Grafana dashboards</small>
            </div>
        </section>
        
        RECOMMENDATIONS_SECTION
        
        <section>
            <h2>Next Steps</h2>
            <ul style="margin-left: 20px;">
                <li>Review detailed metrics in Grafana dashboards</li>
                <li>Implement recommended optimizations</li>
                <li>Re-run tests after optimizations</li>
                <li>Document baseline performance</li>
                <li>Set up continuous performance monitoring</li>
                <li>Schedule regular load tests</li>
            </ul>
        </section>
        
        <footer>
            <p>Generated by Payment Switch Performance Testing Suite</p>
            <p>For questions or support, contact the DevOps team</p>
        </footer>
    </div>
</body>
</html>
EOF

# Replace placeholders with actual values
sed -i "s/TIMESTAMP_PLACEHOLDER/$(date '+%Y-%m-%d %H:%M:%S')/g" "$REPORT_FILE"

if [ -n "$LATEST_PAYMENT" ]; then
    # Format numbers
    PAYMENT_TPS_FORMATTED=$(printf "%.0f" "$PAYMENT_TPS")
    PAYMENT_P95_FORMATTED=$(printf "%.1f" "$PAYMENT_P95")
    PAYMENT_P99_FORMATTED=$(printf "%.1f" "$PAYMENT_P99")
    PAYMENT_AVG_FORMATTED=$(printf "%.1f" "$PAYMENT_AVG")
    PAYMENT_ERROR_FORMATTED=$(printf "%.3f" "$(echo "$PAYMENT_ERRORS * 100" | bc)")
    
    # Determine status
    PAYMENT_TPS_PASS="fail"
    PAYMENT_TPS_STATUS="error"
    PAYMENT_TPS_CLASS="metric-bad"
    PAYMENT_TPS_LABEL="❌ BELOW TARGET"
    if (( $(echo "$PAYMENT_TPS >= $TARGET_PAYMENT_TPS" | bc -l) )); then
        PAYMENT_TPS_PASS="pass"
        PAYMENT_TPS_STATUS="success"
        PAYMENT_TPS_CLASS="metric-good"
        PAYMENT_TPS_LABEL="✅ PASS"
    fi
    
    PAYMENT_P95_PASS="fail"
    PAYMENT_P95_STATUS="error"
    PAYMENT_P95_CLASS="metric-bad"
    PAYMENT_P95_LABEL="❌ ABOVE TARGET"
    if (( $(echo "$PAYMENT_P95 <= $TARGET_P95_MS" | bc -l) )); then
        PAYMENT_P95_PASS="pass"
        PAYMENT_P95_STATUS="success"
        PAYMENT_P95_CLASS="metric-good"
        PAYMENT_P95_LABEL="✅ PASS"
    fi
    
    PAYMENT_P99_PASS="fail"
    PAYMENT_P99_CLASS="metric-bad"
    PAYMENT_P99_LABEL="❌ ABOVE TARGET"
    if (( $(echo "$PAYMENT_P99 <= $TARGET_P99_MS" | bc -l) )); then
        PAYMENT_P99_PASS="pass"
        PAYMENT_P99_CLASS="metric-good"
        PAYMENT_P99_LABEL="✅ PASS"
    fi
    
    PAYMENT_ERROR_PASS="fail"
    PAYMENT_ERROR_STATUS="error"
    PAYMENT_ERROR_CLASS="metric-bad"
    PAYMENT_ERROR_LABEL="❌ ABOVE TARGET"
    if (( $(echo "$PAYMENT_ERRORS <= $TARGET_ERROR_RATE" | bc -l) )); then
        PAYMENT_ERROR_PASS="pass"
        PAYMENT_ERROR_STATUS="success"
        PAYMENT_ERROR_CLASS="metric-good"
        PAYMENT_ERROR_LABEL="✅ PASS"
    fi
    
    # Replace in HTML
    sed -i "s/PAYMENT_TPS_PLACEHOLDER/$PAYMENT_TPS_FORMATTED/g" "$REPORT_FILE"
    sed -i "s/PAYMENT_P95_PLACEHOLDER/$PAYMENT_P95_FORMATTED/g" "$REPORT_FILE"
    sed -i "s/PAYMENT_P99_PLACEHOLDER/$PAYMENT_P99_FORMATTED/g" "$REPORT_FILE"
    sed -i "s/PAYMENT_AVG_PLACEHOLDER/$PAYMENT_AVG_FORMATTED/g" "$REPORT_FILE"
    sed -i "s/PAYMENT_ERROR_PLACEHOLDER/$PAYMENT_ERROR_FORMATTED/g" "$REPORT_FILE"
    sed -i "s/PAYMENT_CHECKS_PLACEHOLDER/$PAYMENT_CHECKS/g" "$REPORT_FILE"
    
    sed -i "s/PAYMENT_TPS_PASS/$PAYMENT_TPS_PASS/g" "$REPORT_FILE"
    sed -i "s/PAYMENT_TPS_STATUS/$PAYMENT_TPS_STATUS/g" "$REPORT_FILE"
    sed -i "s/PAYMENT_TPS_CLASS/$PAYMENT_TPS_CLASS/g" "$REPORT_FILE"
    sed -i "s/PAYMENT_TPS_LABEL/$PAYMENT_TPS_LABEL/g" "$REPORT_FILE"
    
    sed -i "s/PAYMENT_P95_PASS/$PAYMENT_P95_PASS/g" "$REPORT_FILE"
    sed -i "s/PAYMENT_P95_STATUS/$PAYMENT_P95_STATUS/g" "$REPORT_FILE"
    sed -i "s/PAYMENT_P95_CLASS/$PAYMENT_P95_CLASS/g" "$REPORT_FILE"
    sed -i "s/PAYMENT_P95_LABEL/$PAYMENT_P95_LABEL/g" "$REPORT_FILE"
    
    sed -i "s/PAYMENT_P99_CLASS/$PAYMENT_P99_CLASS/g" "$REPORT_FILE"
    sed -i "s/PAYMENT_P99_LABEL/$PAYMENT_P99_LABEL/g" "$REPORT_FILE"
    
    sed -i "s/PAYMENT_ERROR_PASS/$PAYMENT_ERROR_PASS/g" "$REPORT_FILE"
    sed -i "s/PAYMENT_ERROR_STATUS/$PAYMENT_ERROR_STATUS/g" "$REPORT_FILE"
    sed -i "s/PAYMENT_ERROR_CLASS/$PAYMENT_ERROR_CLASS/g" "$REPORT_FILE"
    sed -i "s/PAYMENT_ERROR_LABEL/$PAYMENT_ERROR_LABEL/g" "$REPORT_FILE"
fi

if [ -n "$LATEST_FRAUD" ]; then
    # Format numbers
    FRAUD_TPS_FORMATTED=$(printf "%.0f" "$FRAUD_TPS")
    FRAUD_P95_FORMATTED=$(printf "%.1f" "$FRAUD_P95")
    FRAUD_P99_FORMATTED=$(printf "%.1f" "$FRAUD_P99")
    FRAUD_AVG_FORMATTED=$(printf "%.1f" "$FRAUD_AVG")
    FRAUD_ERROR_FORMATTED=$(printf "%.3f" "$(echo "$FRAUD_ERRORS * 100" | bc)")
    
    # Determine status
    FRAUD_TPS_PASS="fail"
    FRAUD_TPS_STATUS="error"
    FRAUD_TPS_CLASS="metric-bad"
    FRAUD_TPS_LABEL="❌ BELOW TARGET"
    if (( $(echo "$FRAUD_TPS >= $TARGET_FRAUD_TPS" | bc -l) )); then
        FRAUD_TPS_PASS="pass"
        FRAUD_TPS_STATUS="success"
        FRAUD_TPS_CLASS="metric-good"
        FRAUD_TPS_LABEL="✅ PASS"
    fi
    
    FRAUD_P95_PASS="fail"
    FRAUD_P95_CLASS="metric-bad"
    FRAUD_P95_LABEL="❌ ABOVE TARGET"
    if (( $(echo "$FRAUD_P95 <= 200" | bc -l) )); then
        FRAUD_P95_PASS="pass"
        FRAUD_P95_CLASS="metric-good"
        FRAUD_P95_LABEL="✅ PASS"
    fi
    
    FRAUD_P99_PASS="fail"
    FRAUD_P99_CLASS="metric-bad"
    FRAUD_P99_LABEL="❌ ABOVE TARGET"
    if (( $(echo "$FRAUD_P99 <= 1000" | bc -l) )); then
        FRAUD_P99_PASS="pass"
        FRAUD_P99_CLASS="metric-good"
        FRAUD_P99_LABEL="✅ PASS"
    fi
    
    FRAUD_ERROR_PASS="fail"
    FRAUD_ERROR_CLASS="metric-bad"
    FRAUD_ERROR_LABEL="❌ ABOVE TARGET"
    if (( $(echo "$FRAUD_ERRORS <= $TARGET_ERROR_RATE" | bc -l) )); then
        FRAUD_ERROR_PASS="pass"
        FRAUD_ERROR_CLASS="metric-good"
        FRAUD_ERROR_LABEL="✅ PASS"
    fi
    
    # Replace in HTML
    sed -i "s/FRAUD_TPS_PLACEHOLDER/$FRAUD_TPS_FORMATTED/g" "$REPORT_FILE"
    sed -i "s/FRAUD_P95_PLACEHOLDER/$FRAUD_P95_FORMATTED/g" "$REPORT_FILE"
    sed -i "s/FRAUD_P99_PLACEHOLDER/$FRAUD_P99_FORMATTED/g" "$REPORT_FILE"
    sed -i "s/FRAUD_AVG_PLACEHOLDER/$FRAUD_AVG_FORMATTED/g" "$REPORT_FILE"
    sed -i "s/FRAUD_ERROR_PLACEHOLDER/$FRAUD_ERROR_FORMATTED/g" "$REPORT_FILE"
    
    sed -i "s/FRAUD_TPS_PASS/$FRAUD_TPS_PASS/g" "$REPORT_FILE"
    sed -i "s/FRAUD_TPS_STATUS/$FRAUD_TPS_STATUS/g" "$REPORT_FILE"
    sed -i "s/FRAUD_TPS_CLASS/$FRAUD_TPS_CLASS/g" "$REPORT_FILE"
    sed -i "s/FRAUD_TPS_LABEL/$FRAUD_TPS_LABEL/g" "$REPORT_FILE"
    
    sed -i "s/FRAUD_P95_CLASS/$FRAUD_P95_CLASS/g" "$REPORT_FILE"
    sed -i "s/FRAUD_P95_LABEL/$FRAUD_P95_LABEL/g" "$REPORT_FILE"
    
    sed -i "s/FRAUD_P99_CLASS/$FRAUD_P99_CLASS/g" "$REPORT_FILE"
    sed -i "s/FRAUD_P99_LABEL/$FRAUD_P99_LABEL/g" "$REPORT_FILE"
    
    sed -i "s/FRAUD_ERROR_CLASS/$FRAUD_ERROR_CLASS/g" "$REPORT_FILE"
    sed -i "s/FRAUD_ERROR_LABEL/$FRAUD_ERROR_LABEL/g" "$REPORT_FILE"
fi

# Generate recommendations
RECOMMENDATIONS=""

if [ "$PAYMENT_TPS_PASS" = "fail" ] || [ "$FRAUD_TPS_PASS" = "fail" ]; then
    RECOMMENDATIONS="$RECOMMENDATIONS
                <li>Scale horizontally: Add more service instances</li>
                <li>Optimize database queries: Add indexes, use connection pooling</li>
                <li>Enable Redis caching for frequently accessed data</li>"
fi

if [ "$PAYMENT_P95_PASS" = "fail" ]; then
    RECOMMENDATIONS="$RECOMMENDATIONS
                <li>Profile slow endpoints and optimize bottlenecks</li>
                <li>Implement database query optimization</li>
                <li>Consider using a CDN for static assets</li>"
fi

if [ "$PAYMENT_ERROR_PASS" = "fail" ] || [ "$FRAUD_ERROR_PASS" = "fail" ]; then
    RECOMMENDATIONS="$RECOMMENDATIONS
                <li>Review error logs to identify failure patterns</li>
                <li>Implement retry logic with exponential backoff</li>
                <li>Add circuit breakers for external service calls</li>
                <li>Increase timeout values if appropriate</li>"
fi

if [ -n "$RECOMMENDATIONS" ]; then
    RECOMMENDATIONS_HTML="
        <section>
            <div class=\"recommendations\">
                <h3>⚠️ Recommendations</h3>
                <ul>$RECOMMENDATIONS
                </ul>
            </div>
        </section>"
    sed -i "s|RECOMMENDATIONS_SECTION|$RECOMMENDATIONS_HTML|g" "$REPORT_FILE"
else
    RECOMMENDATIONS_HTML="
        <section>
            <div class=\"recommendations\" style=\"background: #f0fdf4; border-left-color: #10b981;\">
                <h3 style=\"color: #065f46;\">✅ All Performance Targets Met</h3>
                <p style=\"color: #047857;\">The platform is performing within acceptable parameters. Continue monitoring and maintain current optimization strategies.</p>
            </div>
        </section>"
    sed -i "s|RECOMMENDATIONS_SECTION|$RECOMMENDATIONS_HTML|g" "$REPORT_FILE"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Report Generated Successfully!                        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Report saved to: ${BLUE}$REPORT_FILE${NC}"
echo ""
echo "Open the report:"
echo -e "  ${BLUE}open $REPORT_FILE${NC}"
echo ""
echo "Or view in browser:"
echo -e "  ${BLUE}file://$(pwd)/$REPORT_FILE${NC}"
echo ""
