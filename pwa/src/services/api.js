// 54Bank API Client — handles auth, retries, offline queuing
const API_BASE = window.location.origin + '/api';

class BankAPI {
  constructor() {
    this.token = localStorage.getItem('54bank_token') || '';
    this.offlineQueue = [];
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('54bank_token', token);
  }

  async request(method, path, body = null) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Trace-Id': crypto.randomUUID(),
    };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    // Retry with exponential backoff
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${API_BASE}${path}`, opts);
        if (res.status === 401) {
          this.token = '';
          localStorage.removeItem('54bank_token');
          window.dispatchEvent(new Event('auth-required'));
          throw new Error('Unauthorized');
        }
        if (res.status === 429) {
          const retryAfter = res.headers.get('Retry-After') || 1;
          await new Promise((r) => setTimeout(r, retryAfter * 1000));
          continue;
        }
        return await res.json();
      } catch (err) {
        if (!navigator.onLine && method === 'POST') {
          this.queueOffline(path, body);
          return { queued: true, offline: true };
        }
        if (attempt === 2) throw err;
        await new Promise((r) => setTimeout(r, (attempt + 1) * 1000));
      }
    }
  }

  queueOffline(path, body) {
    this.offlineQueue.push({ url: `${API_BASE}${path}`, payload: body, token: this.token, timestamp: Date.now() });
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => reg.sync.register('agent-query-sync'));
    }
  }

  // Agent endpoints
  async agentQuery(agentName, query, context = {}) {
    return this.request('POST', `/agent/${agentName}/query`, { query, context });
  }

  async agentOpenAccount(customerData) {
    return this.request('POST', '/agent/account-opening/open-account', customerData);
  }

  async agentInvestigate(transactionId, params = {}) {
    return this.request('POST', '/agent/transaction-investigation/investigate', { transaction_id: transactionId, ...params });
  }

  async agentPrepareReturn(returnType, period) {
    return this.request('POST', '/agent/regulatory-returns/prepare-return', { return_type: returnType, period });
  }

  async agentAssessLoan(loanData) {
    return this.request('POST', '/agent/loan-origination/assess-loan', loanData);
  }

  async agentAsk(question) {
    return this.request('POST', '/agent/nl-reporting/ask', { query: question });
  }

  async agentCustomer360(customerId) {
    return this.request('POST', '/agent/customer-360/customer-view', { customer_id: customerId });
  }

  async agentLiquidityPosition() {
    return this.request('POST', '/agent/cash-management/liquidity-position', {});
  }

  async agentDetectFraud(params) {
    return this.request('POST', '/agent/fraud-detection/detect-patterns', params);
  }

  async agentReconcile(params) {
    return this.request('POST', '/agent/reconciliation/reconcile', params);
  }

  // Graph endpoints
  async getCoaGraph() { return this.request('GET', '/neo4j/coa/graph'); }
  async getBaselIII() { return this.request('GET', '/neo4j/coa/basel-iii'); }
  async getLiquidity() { return this.request('GET', '/neo4j/coa/liquidity'); }
  async getPageRank() { return this.request('GET', '/neo4j/coa/pagerank'); }
  async semanticSearch(query) { return this.request('POST', '/qdrant/search/semantic', { query }); }

  // KPI Dashboard endpoints
  async getDashboardSummary() { return this.request('GET', '/dashboard/summary'); }
  async getDashboardRoles() { return this.request('GET', '/dashboard/roles'); }
  async getDashboardRole(role) { return this.request('GET', `/dashboard/role/${role}`); }
  async getDashboardAgents() { return this.request('GET', '/dashboard/agents'); }
  async askDashboard(question, role) { return this.request('POST', '/dashboard/ask', { query: question, role }); }
  async exportDashboard(role, format) { return this.request('POST', '/dashboard/export', { role, format }); }
  async refreshDashboard() { return this.request('GET', '/dashboard/refresh'); }

  // Core banking
  async getAccounts() { return this.request('GET', '/core-banking/list'); }
  async getGLAccounts() { return this.request('GET', '/gl-engine/chart-of-accounts'); }
}

export const api = new BankAPI();
export default api;
