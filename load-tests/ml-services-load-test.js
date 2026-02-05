/**
 * k6 Load Test Script for ML Services
 * Tests all 5 ML services under various load conditions
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('ml_errors');
const mlResponseTime = new Trend('ml_response_time');
const mlRequestCounter = new Counter('ml_total_requests');

// Test configuration - ML services need longer response times
export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Ramp up to 10 users
    { duration: '3m', target: 10 },   // Stay at 10 users
    { duration: '1m', target: 25 },   // Ramp up to 25 users
    { duration: '3m', target: 25 },   // Stay at 25 users
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '3m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    'http_req_duration': ['p(95)<3000'], // 95% of requests should be below 3s (ML is slower)
    'http_req_failed': ['rate<0.02'],    // Error rate should be below 2%
    'ml_errors': ['rate<0.05'],          // Custom error rate below 5%
  },
};

const ML_BASE_URL = __ENV.ML_URL || 'http://127.0.0.1';

// Test data
const testTransactions = Array.from({ length: 50 }, (_, i) => ({
  id: `txn_${Date.now()}_${i}`,
  amount: Math.random() * 500 + 10,
  merchant: ['Shoprite', 'Uber', 'Netflix', 'MTN', 'Dangote'][i % 5],
  category: ['groceries', 'transport', 'entertainment', 'bills', 'shopping'][i % 5],
  description: `Test transaction ${i}`,
  timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
  type: i % 3 === 0 ? 'credit' : 'debit',
}));

export default function () {
  const headers = {
    'Content-Type': 'application/json',
  };

  // Test 1: Predictive Alerts ML (Port 5003)
  {
    const payload = JSON.stringify({
      transactions: testTransactions,
      user_id: `user_${__VU}`,
      user_context: {
        monthly_budget: 10000,
        current_spending: 7500,
      },
    });

    const res = http.post(`${ML_BASE_URL}:5003/analyze`, payload, { 
      headers,
      timeout: '30s',
    });

    check(res, {
      'predictive alerts ML status is 200': (r) => r.status === 200,
      'predictive alerts ML response time < 5000ms': (r) => r.timings.duration < 5000,
      'predictive alerts ML has alerts': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.alerts && Array.isArray(body.alerts);
        } catch (e) {
          return false;
        }
      },
    });

    errorRate.add(res.status !== 200);
    mlResponseTime.add(res.timings.duration);
    mlRequestCounter.add(1);
  }

  sleep(2);

  // Test 2: Smart Categorization ML (Port 5004)
  {
    const payload = JSON.stringify({
      merchant: 'Shoprite Ikeja',
      description: 'Grocery shopping',
      amount: 5000,
      user_id: `user_${__VU}`,
    });

    const res = http.post(`${ML_BASE_URL}:5004/categorize`, payload, { 
      headers,
      timeout: '20s',
    });

    check(res, {
      'smart categorization ML status is 200': (r) => r.status === 200,
      'smart categorization ML response time < 3000ms': (r) => r.timings.duration < 3000,
      'smart categorization ML has category': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.category && body.confidence !== undefined;
        } catch (e) {
          return false;
        }
      },
    });

    errorRate.add(res.status !== 200);
    mlResponseTime.add(res.timings.duration);
    mlRequestCounter.add(1);
  }

  sleep(2);

  // Test 3: Tax Optimization ML (Port 5005)
  {
    const payload = JSON.stringify({
      country: 'nigeria',
      annual_income: 5000000,
      transactions: testTransactions.slice(0, 20),
    });

    const res = http.post(`${ML_BASE_URL}:5005/optimize`, payload, { 
      headers,
      timeout: '30s',
    });

    check(res, {
      'tax optimization ML status is 200': (r) => r.status === 200,
      'tax optimization ML response time < 5000ms': (r) => r.timings.duration < 5000,
      'tax optimization ML has calculation': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.tax_calculation && body.detected_deductions;
        } catch (e) {
          return false;
        }
      },
    });

    errorRate.add(res.status !== 200);
    mlResponseTime.add(res.timings.duration);
    mlRequestCounter.add(1);
  }

  sleep(2);

  // Test 4: Investment Risk ML (Port 5006)
  {
    const payload = JSON.stringify({
      holdings: {
        'DANGCEM.LG': 10000,
        'MTNN.LG': 15000,
        'ZENITHBANK.LG': 8000,
        'NPN.JO': 12000,
      },
    });

    const res = http.post(`${ML_BASE_URL}:5006/analyze`, payload, { 
      headers,
      timeout: '25s',
    });

    check(res, {
      'investment risk ML status is 200': (r) => r.status === 200,
      'investment risk ML response time < 4000ms': (r) => r.timings.duration < 4000,
      'investment risk ML has metrics': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.metrics && body.diversification;
        } catch (e) {
          return false;
        }
      },
    });

    errorRate.add(res.status !== 200);
    mlResponseTime.add(res.timings.duration);
    mlRequestCounter.add(1);
  }

  sleep(2);

  // Test 5: Credit Score ML (Port 5007)
  {
    const payload = JSON.stringify({
      on_time_payments: 45,
      total_payments: 50,
      credit_used: 3000,
      credit_limit: 10000,
      credit_age_months: 24,
      num_accounts: 3,
      recent_inquiries: 1,
      annual_income: 3000000,
      monthly_savings: 50000,
    });

    const res = http.post(`${ML_BASE_URL}:5007/predict`, payload, { 
      headers,
      timeout: '25s',
    });

    check(res, {
      'credit score ML status is 200': (r) => r.status === 200,
      'credit score ML response time < 4000ms': (r) => r.timings.duration < 4000,
      'credit score ML has prediction': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.credit_score && body.rating && body.factor_scores;
        } catch (e) {
          return false;
        }
      },
    });

    errorRate.add(res.status !== 200);
    mlResponseTime.add(res.timings.duration);
    mlRequestCounter.add(1);
  }

  sleep(3);
}

export function handleSummary(data) {
  return {
    'load-test-results/ml-summary.json': JSON.stringify(data, null, 2),
    'load-test-results/ml-summary.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';

  let summary = '\n';
  summary += `${indent}========== ML Services Load Test Summary ==========\n\n`;
  
  const testDuration = data.state.testRunDurationMs / 1000;
  summary += `${indent}Test Duration: ${testDuration.toFixed(2)}s\n`;
  
  const totalRequests = data.metrics.ml_total_requests?.values?.count || 0;
  const failedRequests = data.metrics.http_req_failed?.values?.rate || 0;
  summary += `${indent}Total ML Requests: ${totalRequests}\n`;
  summary += `${indent}Failed Requests: ${(failedRequests * 100).toFixed(2)}%\n\n`;
  
  const p95 = data.metrics.http_req_duration?.values?.['p(95)'] || 0;
  const p99 = data.metrics.http_req_duration?.values?.['p(99)'] || 0;
  const avg = data.metrics.http_req_duration?.values?.avg || 0;
  summary += `${indent}ML Response Times:\n`;
  summary += `${indent}  Average: ${avg.toFixed(2)}ms\n`;
  summary += `${indent}  P95: ${p95.toFixed(2)}ms\n`;
  summary += `${indent}  P99: ${p99.toFixed(2)}ms\n\n`;
  
  const rps = totalRequests / testDuration;
  summary += `${indent}ML Throughput: ${rps.toFixed(2)} req/s\n\n`;
  
  summary += `${indent}Thresholds:\n`;
  Object.entries(data.metrics).forEach(([name, metric]) => {
    if (metric.thresholds) {
      Object.entries(metric.thresholds).forEach(([threshold, result]) => {
        const status = result.ok ? '✓ PASS' : '✗ FAIL';
        summary += `${indent}  ${status}: ${name} ${threshold}\n`;
      });
    }
  });
  
  summary += `\n${indent}===================================================\n`;
  
  return summary;
}

function htmlReport(data) {
  const testDuration = (data.state.testRunDurationMs / 1000).toFixed(2);
  const totalRequests = data.metrics.ml_total_requests?.values?.count || 0;
  const failedRequests = ((data.metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2);
  const p95 = (data.metrics.http_req_duration?.values?.['p(95)'] || 0).toFixed(2);
  const p99 = (data.metrics.http_req_duration?.values?.['p(99)'] || 0).toFixed(2);
  const avg = (data.metrics.http_req_duration?.values?.avg || 0).toFixed(2);
  const rps = (totalRequests / (data.state.testRunDurationMs / 1000)).toFixed(2);

  return `
<!DOCTYPE html>
<html>
<head>
  <title>ML Services Load Test Results</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2 4px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 3px solid #8b5cf6; padding-bottom: 10px; }
    .metric { background: #f9f9f9; padding: 15px; margin: 10px 0; border-left: 4px solid #8b5cf6; }
    .metric-title { font-weight: bold; color: #555; margin-bottom: 5px; }
    .metric-value { font-size: 24px; color: #8b5cf6; }
    .pass { color: #22c55e; }
    .fail { color: #ef4444; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #8b5cf6; color: white; }
  </style>
</head>
<body>
  <div class="container">
    <h1>ML Services Load Test Results</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
    <p><strong>Services Tested:</strong> Predictive Alerts, Smart Categorization, Tax Optimization, Investment Risk, Credit Score</p>
    
    <h2>Overview</h2>
    <div class="metric">
      <div class="metric-title">Test Duration</div>
      <div class="metric-value">${testDuration}s</div>
    </div>
    <div class="metric">
      <div class="metric-title">Total ML Requests</div>
      <div class="metric-value">${totalRequests}</div>
    </div>
    <div class="metric">
      <div class="metric-title">Failed Requests</div>
      <div class="metric-value">${failedRequests}%</div>
    </div>
    <div class="metric">
      <div class="metric-title">ML Throughput</div>
      <div class="metric-value">${rps} req/s</div>
    </div>
    
    <h2>Response Times</h2>
    <table>
      <tr>
        <th>Metric</th>
        <th>Value</th>
      </tr>
      <tr>
        <td>Average</td>
        <td>${avg}ms</td>
      </tr>
      <tr>
        <td>95th Percentile</td>
        <td>${p95}ms</td>
      </tr>
      <tr>
        <td>99th Percentile</td>
        <td>${p99}ms</td>
      </tr>
    </table>
    
    <h2>Thresholds</h2>
    <table>
      <tr>
        <th>Metric</th>
        <th>Threshold</th>
        <th>Status</th>
      </tr>
      ${Object.entries(data.metrics)
        .filter(([_, metric]) => metric.thresholds)
        .map(([name, metric]) =>
          Object.entries(metric.thresholds)
            .map(([threshold, result]) => `
              <tr>
                <td>${name}</td>
                <td>${threshold}</td>
                <td class="${result.ok ? 'pass' : 'fail'}">${result.ok ? '✓ PASS' : '✗ FAIL'}</td>
              </tr>
            `)
            .join('')
        )
        .join('')}
    </table>
    
    <h2>Notes</h2>
    <ul>
      <li>ML services have higher response times due to model inference</li>
      <li>Qwen LLM processing adds 500-2000ms latency</li>
      <li>Consider caching for frequently requested predictions</li>
      <li>Monitor Ollama service resource usage during peak load</li>
    </ul>
  </div>
</body>
</html>
  `;
}
