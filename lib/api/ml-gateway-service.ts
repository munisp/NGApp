const ML_GATEWAY_URL = process.env.EXPO_PUBLIC_ML_GATEWAY_URL || 'http://127.0.0.1:8119';

export interface MLService {
  key: string;
  name: string;
  url: string;
  port: number;
  type: string;
  status: string;
  endpoints: string[];
}

export interface PredictionResult {
  prediction_id: string;
  service: string;
  model: string;
  result: Record<string, unknown>;
  confidence: number;
  latency_ms: number;
  timestamp: string;
}

export interface FraudCheckResult {
  transaction_id: string;
  is_fraudulent: boolean;
  fraud_score: number;
  risk_level: string;
  signals: Array<{ source: string; score: number; details: string }>;
  recommendation: string;
  latency_ms: number;
}

export interface CreditScoreResult {
  user_id: string;
  credit_score: number;
  grade: string;
  factors: Array<{ name: string; score: number; weight: number; impact: string }>;
  max_loan_amount: number;
  recommended_rate: number;
  confidence: number;
}

export interface CategorizationResult {
  transaction_id: string;
  category: string;
  subcategory: string;
  confidence: number;
  method: string;
}

export interface RiskAssessmentResult {
  entity_id: string;
  entity_type: string;
  overall_risk: number;
  risk_level: string;
  factors: Array<{ name: string; score: number; weight: number }>;
  recommendation: string;
}

export interface ABTest {
  test_id: string;
  name: string;
  model_a: string;
  model_b: string;
  traffic_split: number;
  status: string;
  results: { model_a_count: number; model_b_count: number; model_a_avg_latency: number; model_b_avg_latency: number };
  created_at: string;
}

export interface FeaturePipeline {
  pipeline_id: string;
  name: string;
  source: string;
  features: string[];
  schedule: string;
  status: string;
  last_run: string;
  records_processed: number;
}

class MLGatewayService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${ML_GATEWAY_URL}${endpoint}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || `Request failed: ${response.status}`);
    }
    return response.json();
  }

  async getServices(): Promise<{ services: Record<string, MLService>; total: number }> {
    return this.request('/services');
  }

  async checkServiceHealth(serviceKey: string): Promise<{ service: string; healthy: boolean; latency_ms: number }> {
    return this.request(`/services/${serviceKey}/health`);
  }

  async checkAllHealth(): Promise<{ results: Record<string, { healthy: boolean; latency_ms: number }> }> {
    return this.request('/services/health/all');
  }

  async predict(params: {
    service: string;
    model: string;
    input_data: Record<string, unknown>;
    options?: Record<string, unknown>;
  }): Promise<PredictionResult> {
    return this.request('/predict', { method: 'POST', body: JSON.stringify(params) });
  }

  async batchPredict(params: {
    service: string;
    model: string;
    inputs: Array<Record<string, unknown>>;
  }): Promise<{ batch_id: string; results: PredictionResult[]; total: number; avg_latency_ms: number }> {
    return this.request('/predict/batch', { method: 'POST', body: JSON.stringify(params) });
  }

  async checkFraud(params: {
    transaction_id: string;
    user_id: string;
    amount: number;
    currency: string;
    merchant: string;
    location?: { lat: number; lng: number };
    device_id?: string;
    ip_address?: string;
  }): Promise<FraudCheckResult> {
    return this.request('/fraud/check', { method: 'POST', body: JSON.stringify(params) });
  }

  async calculateCreditScore(params: {
    user_id: string;
    income: number;
    expenses: number;
    existing_loans: number;
    account_age_months: number;
    transaction_count: number;
    savings_balance: number;
  }): Promise<CreditScoreResult> {
    return this.request('/credit-score/calculate', { method: 'POST', body: JSON.stringify(params) });
  }

  async categorizeTransaction(params: {
    transaction_id: string;
    description: string;
    amount: number;
    merchant?: string;
  }): Promise<CategorizationResult> {
    return this.request('/categorize', { method: 'POST', body: JSON.stringify(params) });
  }

  async assessRisk(params: {
    entity_id: string;
    entity_type: string;
    data: Record<string, unknown>;
  }): Promise<RiskAssessmentResult> {
    return this.request('/risk-assessment', { method: 'POST', body: JSON.stringify(params) });
  }

  async createABTest(params: {
    name: string;
    model_a: string;
    model_b: string;
    traffic_split: number;
  }): Promise<ABTest> {
    return this.request('/ab-test/create', { method: 'POST', body: JSON.stringify(params) });
  }

  async getABTest(testId: string): Promise<ABTest> {
    return this.request(`/ab-test/${testId}`);
  }

  async createFeaturePipeline(params: {
    name: string;
    source: string;
    features: string[];
    schedule: string;
  }): Promise<FeaturePipeline> {
    return this.request('/feature-pipeline/create', { method: 'POST', body: JSON.stringify(params) });
  }

  async getFeaturePipelines(): Promise<{ pipelines: FeaturePipeline[]; total: number }> {
    return this.request('/feature-pipelines');
  }

  async getMetrics(): Promise<Record<string, unknown>> {
    return this.request('/metrics');
  }

  async getRecentPredictions(limit?: number): Promise<{ predictions: PredictionResult[]; total: number }> {
    return this.request(`/predictions/recent?limit=${limit || 20}`);
  }
}

export const mlGatewayService = new MLGatewayService();
