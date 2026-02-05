/**
 * k6 Load Test Script for Express.js API
 * Tests all critical API endpoints under various load conditions
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiResponseTime = new Trend('api_response_time');
const requestCounter = new Counter('total_requests');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 200 },  // Ramp up to 200 users
    { duration: '5m', target: 200 },  // Stay at 200 users
    { duration: '3m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'], // 95% of requests should be below 500ms
    'http_req_failed': ['rate<0.01'],   // Error rate should be below 1%
    'errors': ['rate<0.05'],            // Custom error rate below 5%
  },
};

const BASE_URL = __ENV.API_URL || 'http://127.0.0.1:3000';

// Test data
const testTransactions = [
  {
    id: `txn_${Date.now()}_1`,
    amount: 50.00,
    merchant: 'Shoprite',
    category: 'groceries',
    description: 'Weekly grocery shopping',
    date: new Date().toISOString(),
    type: 'debit',
  },
  {
    id: `txn_${Date.now()}_2`,
    amount: 25.50,
    merchant: 'Uber',
    category: 'transport',
    description: 'Ride to office',
    date: new Date().toISOString(),
    type: 'debit',
  },
];

const testBudgets = [
  { category: 'groceries', limit: 500 },
  { category: 'transport', limit: 200 },
  { category: 'entertainment', limit: 150 },
];

export default function () {
  const headers = {
    'Content-Type': 'application/json',
  };

  // Test 1: Health check
  {
    const res = http.get(`${BASE_URL}/api/health`, { headers });
    check(res, {
      'health check status is 200': (r) => r.status === 200,
      'health check has ok field': (r) => JSON.parse(r.body).ok === true,
    });
    errorRate.add(res.status !== 200);
    apiResponseTime.add(res.timings.duration);
    requestCounter.add(1);
  }

  sleep(1);

  // Test 2: Predictive Alerts API
  {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();

    const payload = JSON.stringify({
      transactions: testTransactions,
      budgets: testBudgets,
      period_start: periodStart,
      period_end: periodEnd,
    });

    const res = http.post(
      `${BASE_URL}/api/trpc/predictiveAlerts.getAllAlerts`,
      payload,
      { headers }
    );

    check(res, {
      'predictive alerts status is 200': (r) => r.status === 200,
      'predictive alerts response time < 1000ms': (r) => r.timings.duration < 1000,
      'predictive alerts has result': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.result && body.result.data;
        } catch (e) {
          return false;
        }
      },
    });

    errorRate.add(res.status !== 200);
    apiResponseTime.add(res.timings.duration);
    requestCounter.add(1);
  }

  sleep(1);

  // Test 3: African Markets - Get Stocks by Country
  {
    const res = http.post(
      `${BASE_URL}/api/trpc/africanMarkets.getStocksByCountry`,
      JSON.stringify({ country: 'nigeria' }),
      { headers }
    );

    check(res, {
      'african markets status is 200': (r) => r.status === 200,
      'african markets response time < 500ms': (r) => r.timings.duration < 500,
      'african markets has stocks': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.result && body.result.data && body.result.data.stocks;
        } catch (e) {
          return false;
        }
      },
    });

    errorRate.add(res.status !== 200);
    apiResponseTime.add(res.timings.duration);
    requestCounter.add(1);
  }

  sleep(1);

  // Test 4: Tax Optimization API
  {
    const payload = JSON.stringify({
      country: 'nigeria',
      annual_income: 5000000,
      transactions: testTransactions,
    });

    const res = http.post(
      `${BASE_URL}/api/trpc/taxOptimization.optimize`,
      payload,
      { headers }
    );

    check(res, {
      'tax optimization status is 200': (r) => r.status === 200,
      'tax optimization response time < 1500ms': (r) => r.timings.duration < 1500,
      'tax optimization has calculation': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.result && body.result.data && body.result.data.tax_calculation;
        } catch (e) {
          return false;
        }
      },
    });

    errorRate.add(res.status !== 200);
    apiResponseTime.add(res.timings.duration);
    requestCounter.add(1);
  }

  sleep(1);

  // Test 5: Expense Forecast API
  {
    const payload = JSON.stringify({
      transactions: testTransactions,
      category: 'groceries',
    });

    const res = http.post(
      `${BASE_URL}/api/trpc/expenseForecast.getForecast`,
      payload,
      { headers }
    );

    check(res, {
      'expense forecast status is 200': (r) => r.status === 200,
      'expense forecast response time < 800ms': (r) => r.timings.duration < 800,
    });

    errorRate.add(res.status !== 200);
    apiResponseTime.add(res.timings.duration);
    requestCounter.add(1);
  }

  sleep(1);

  // Test 6: AI Insights API
  {
    const payload = JSON.stringify({
      transactions: testTransactions,
    });

    const res = http.post(
      `${BASE_URL}/api/trpc/insights.analyze`,
      payload,
      { headers }
    );

    check(res, {
      'insights status is 200': (r) => r.status === 200,
      'insights response time < 2000ms': (r) => r.timings.duration < 2000,
      'insights has data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.result && body.result.data;
        } catch (e) {
          return false;
        }
      },
    });

    errorRate.add(res.status !== 200);
    apiResponseTime.add(res.timings.duration);
    requestCounter.add(1);
  }

  sleep(2);
}

export function handleSummary(data) {
  return {
    'load-test-results/api-summary.json': JSON.stringify(data, null, 2),
    'load-test-results/api-summary.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;

  let summary = '\n';
  summary += `${indent}========== API Load Test Summary ==========\n\n`;
  
  // Test duration
  const testDuration = data.state.testRunDurationMs / 1000;
  summary += `${indent}Test Duration: ${testDuration.toFixed(2)}s\n`;
  
  // Request metrics
  const totalRequests = data.metrics.total_requests?.values?.count || 0;
  const failedRequests = data.metrics.http_req_failed?.values?.rate || 0;
  summary += `${indent}Total Requests: ${totalRequests}\n`;
  summary += `${indent}Failed Requests: ${(failedRequests * 100).toFixed(2)}%\n\n`;
  
  // Response time metrics
  const p95 = data.metrics.http_req_duration?.values?.['p(95)'] || 0;
  const p99 = data.metrics.http_req_duration?.values?.['p(99)'] || 0;
  const avg = data.metrics.http_req_duration?.values?.avg || 0;
  summary += `${indent}Response Times:\n`;
  summary += `${indent}  Average: ${avg.toFixed(2)}ms\n`;
  summary += `${indent}  P95: ${p95.toFixed(2)}ms\n`;
  summary += `${indent}  P99: ${p99.toFixed(2)}ms\n\n`;
  
  // Throughput
  const rps = totalRequests / testDuration;
  summary += `${indent}Throughput: ${rps.toFixed(2)} req/s\n\n`;
  
  // Thresholds
  summary += `${indent}Thresholds:\n`;
  Object.entries(data.metrics).forEach(([name, metric]) => {
    if (metric.thresholds) {
      Object.entries(metric.thresholds).forEach(([threshold, result]) => {
        const status = result.ok ? '✓ PASS' : '✗ FAIL';
        summary += `${indent}  ${status}: ${name} ${threshold}\n`;
      });
    }
  });
  
  summary += `\n${indent}==========================================\n`;
  
  return summary;
}

function htmlReport(data) {
  const testDuration = (data.state.testRunDurationMs / 1000).toFixed(2);
  const totalRequests = data.metrics.total_requests?.values?.count || 0;
  const failedRequests = ((data.metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2);
  const p95 = (data.metrics.http_req_duration?.values?.['p(95)'] || 0).toFixed(2);
  const p99 = (data.metrics.http_req_duration?.values?.['p(99)'] || 0).toFixed(2);
  const avg = (data.metrics.http_req_duration?.values?.avg || 0).toFixed(2);
  const rps = (totalRequests / (data.state.testRunDurationMs / 1000)).toFixed(2);

  return `
<!DOCTYPE html>
<html>
<head>
  <title>API Load Test Results</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 3px solid #0a7ea4; padding-bottom: 10px; }
    .metric { background: #f9f9f9; padding: 15px; margin: 10px 0; border-left: 4px solid #0a7ea4; }
    .metric-title { font-weight: bold; color: #555; margin-bottom: 5px; }
    .metric-value { font-size: 24px; color: #0a7ea4; }
    .pass { color: #22c55e; }
    .fail { color: #ef4444; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #0a7ea4; color: white; }
  </style>
</head>
<body>
  <div class="container">
    <h1>API Load Test Results</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
    
    <h2>Overview</h2>
    <div class="metric">
      <div class="metric-title">Test Duration</div>
      <div class="metric-value">${testDuration}s</div>
    </div>
    <div class="metric">
      <div class="metric-title">Total Requests</div>
      <div class="metric-value">${totalRequests}</div>
    </div>
    <div class="metric">
      <div class="metric-title">Failed Requests</div>
      <div class="metric-value">${failedRequests}%</div>
    </div>
    <div class="metric">
      <div class="metric-title">Throughput</div>
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
  </div>
</body>
</html>
  `;
}
