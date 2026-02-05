import axios from 'axios';

/**
 * Fraud Detection API Client
 * Integrates with the hybrid fraud detection service (GNN/ML/Rules)
 */

// API Configuration
const FRAUD_API_URL = process.env.FRAUD_DETECTION_API_URL || 'http://localhost:8004';
const API_TIMEOUT = 10000; // 10 seconds

export interface FraudCheckRequest {
  transaction: {
    transaction_id: string;
    amount: number;
    from_account: string;
    to_account: string;
    type: 'transfer' | 'withdrawal' | 'deposit';
    timestamp: string;
    is_international: boolean;
    hour_of_day: number;
    day_of_week: number;
    metadata?: Record<string, any>;
  };
  account: {
    id: string;
    account_age_days: number;
    balance: number;
    kyc_verified: boolean;
    kyb_verified: boolean;
    risk_score: number;
    total_transactions: number;
    avg_transaction_amount: number;
  };
  history: Array<{
    amount: number;
    type: string;
    timestamp: string;
    is_international: boolean;
    hour_of_day: number;
    hours_ago: number;
  }>;
}

export interface FraudCheckResponse {
  transaction_id: string;
  is_fraud: boolean;
  confidence: number;
  risk_score: number;
  recommended_action: 'ALLOW' | 'ADDITIONAL_VERIFICATION' | 'MANUAL_REVIEW' | 'BLOCK_TRANSACTION';
  explanation: string;
  
  // Component scores
  rule_based_score: number;
  ml_score: number;
  gnn_score: number;
  
  // Detailed results
  rule_violations: Array<{
    rule_id: string;
    rule_name: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    score: number;
  }>;
  suspicious_patterns: string[];
  
  // Metadata
  timestamp: string;
  processing_time_ms: number;
}

export interface FraudRiskLevel {
  level: 'low' | 'medium' | 'high' | 'critical';
  color: string;
  description: string;
}

class FraudDetectionAPI {
  private apiClient = axios.create({
    baseURL: FRAUD_API_URL,
    timeout: API_TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  /**
   * Check if a transaction is fraudulent
   */
  async checkFraud(request: FraudCheckRequest): Promise<FraudCheckResponse> {
    try {
      const response = await this.apiClient.post<FraudCheckResponse>('/detect', request);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Fraud detection API error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get fraud risk level from risk score
   */
  getRiskLevel(riskScore: number): FraudRiskLevel {
    if (riskScore >= 0.9) {
      return {
        level: 'critical',
        color: '#DC2626', // red-600
        description: 'Critical fraud risk - transaction blocked',
      };
    } else if (riskScore >= 0.7) {
      return {
        level: 'high',
        color: '#EA580C', // orange-600
        description: 'High fraud risk - manual review required',
      };
    } else if (riskScore >= 0.5) {
      return {
        level: 'medium',
        color: '#F59E0B', // amber-500
        description: 'Medium fraud risk - additional verification needed',
      };
    } else {
      return {
        level: 'low',
        color: '#16A34A', // green-600
        description: 'Low fraud risk - transaction allowed',
      };
    }
  }

  /**
   * Get system information
   */
  async getSystemInfo(): Promise<{
    decision_strategy: string;
    component_weights: Record<string, number>;
    thresholds: Record<string, number>;
    active_rules: number;
    ml_models: string[];
    gnn_architecture: string;
  }> {
    try {
      const response = await this.apiClient.get('/system/info');
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to get system info: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get active fraud detection rules
   */
  async getRules(): Promise<{
    total_rules: number;
    rules: Array<{
      rule_id: string;
      name: string;
      description: string;
      severity: string;
      weight: number;
    }>;
  }> {
    try {
      const response = await this.apiClient.get('/rules');
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to get rules: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    try {
      const response = await this.apiClient.get('/health');
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Health check failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Format fraud explanation for display
   */
  formatExplanation(response: FraudCheckResponse): string {
    const parts: string[] = [];

    // Risk level
    const riskLevel = this.getRiskLevel(response.risk_score);
    parts.push(`Risk Level: ${riskLevel.description}`);

    // Component scores
    parts.push(`\nDetection Components:`);
    parts.push(`• Rule-based: ${(response.rule_based_score * 100).toFixed(0)}%`);
    parts.push(`• Machine Learning: ${(response.ml_score * 100).toFixed(0)}%`);
    parts.push(`• Graph Analysis: ${(response.gnn_score * 100).toFixed(0)}%`);

    // Rule violations
    if (response.rule_violations.length > 0) {
      parts.push(`\nRule Violations:`);
      response.rule_violations.forEach((violation) => {
        parts.push(`• ${violation.rule_name}: ${violation.description}`);
      });
    }

    // Suspicious patterns
    if (response.suspicious_patterns.length > 0) {
      parts.push(`\nSuspicious Patterns:`);
      response.suspicious_patterns.forEach((pattern) => {
        parts.push(`• ${pattern}`);
      });
    }

    return parts.join('\n');
  }

  /**
   * Get recommended action message
   */
  getActionMessage(action: FraudCheckResponse['recommended_action']): string {
    switch (action) {
      case 'ALLOW':
        return 'Transaction approved';
      case 'ADDITIONAL_VERIFICATION':
        return 'Please complete additional verification to proceed';
      case 'MANUAL_REVIEW':
        return 'This transaction requires manual review. Our team will contact you shortly.';
      case 'BLOCK_TRANSACTION':
        return 'Transaction blocked due to high fraud risk';
      default:
        return 'Unknown action';
    }
  }
}

// Export singleton instance
export const fraudDetectionAPI = new FraudDetectionAPI();
