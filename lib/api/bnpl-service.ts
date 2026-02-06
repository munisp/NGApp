import AsyncStorage from '@react-native-async-storage/async-storage';

const BNPL_SERVICE_URL = process.env.EXPO_PUBLIC_BNPL_SERVICE_URL || 'http://127.0.0.1:8112';

export interface BNPLPlan {
  months: number;
  interest_rate: number;
  monthly_payment: number;
  total_amount: number;
  total_interest: number;
  min_credit_score: number;
  first_payment_date: string;
}

export interface BNPLInstallment {
  installment_id: string;
  installment_number: number;
  amount: number;
  principal_portion: number;
  interest_portion: number;
  due_date: string;
  status: 'pending' | 'due' | 'paid' | 'overdue' | 'waived' | 'partially_paid';
  paid_amount: number;
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  late_fee: number;
  grace_period_end: string;
}

export interface BNPLApplication {
  application_id: string;
  user_id: string;
  category: string;
  merchant_name: string;
  description: string | null;
  principal_amount: number;
  interest_rate: number;
  total_interest: number;
  total_amount: number;
  monthly_payment: number;
  installment_months: number;
  student_name: string | null;
  school_name: string | null;
  grade: string | null;
  employment_status: string | null;
  monthly_income: number | null;
  status: 'draft' | 'pending' | 'credit_check' | 'under_review' | 'approved' | 'rejected' | 'active' | 'disbursed' | 'completed' | 'defaulted' | 'cancelled';
  credit_decision: {
    credit_score: number;
    credit_grade: string;
    fraud_risk_score: number;
    fraud_risk_level: string;
    dti_ratio: number | null;
    risk_factors: Array<{ factor: string; impact: string; value: number }>;
    max_approved_amount: number;
    recommended_action: string;
    auto_approve: boolean;
    auto_reject: boolean;
    confidence: number;
  } | null;
  reviewer_id: string | null;
  reviewer_notes: string | null;
  rejection_reason: string | null;
  disbursement: {
    disbursement_id: string;
    amount: number;
    method: string;
    recipient_name: string;
    status: string;
    disbursed_at: string;
  } | null;
  installments: BNPLInstallment[];
  total_paid: number;
  total_late_fees: number;
  next_payment_date: string | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  disbursed_at: string | null;
  completed_at: string | null;
  defaulted_at: string | null;
}

export interface BNPLPaymentRecord {
  payment_id: string;
  application_id: string;
  installment_id: string;
  user_id: string;
  amount: number;
  payment_method: string;
  payment_reference: string;
  paid_at: string;
}

export interface BNPLNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

export interface BNPLAnalytics {
  total_applications: number;
  by_status: Record<string, number>;
  total_disbursed: number;
  total_collected: number;
  total_outstanding: number;
  total_late_fees: number;
  approval_rate: number;
  default_rate: number;
  total_defaults: number;
}

class BNPLService {
  private async getUserId(): Promise<string> {
    const userData = await AsyncStorage.getItem('userData');
    if (userData) {
      const parsed = JSON.parse(userData);
      return parsed.id || '1';
    }
    return '1';
  }

  async getAvailablePlans(amount: number): Promise<BNPLPlan[]> {
    try {
      const response = await fetch(`${BNPL_SERVICE_URL}/bnpl/plans?amount=${amount}&credit_score=500`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.plans || [];
    } catch (error) {
      console.error('Error fetching BNPL plans:', error);
      return [];
    }
  }

  async applyForBNPL(params: {
    category?: string;
    merchant_name: string;
    description?: string;
    amount: number;
    installment_months: number;
    student_name?: string;
    school_name?: string;
    grade?: string;
    employment_status?: string;
    monthly_income?: number;
    documents?: Record<string, string>;
  }): Promise<{ application_id: string; status: string; message: string; monthly_payment: number; total_amount: number }> {
    const userId = await this.getUserId();
    const response = await fetch(`${BNPL_SERVICE_URL}/bnpl/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        category: params.category || 'general_purchase',
        merchant_name: params.merchant_name,
        description: params.description,
        amount: params.amount,
        installment_months: params.installment_months,
        student_name: params.student_name,
        school_name: params.school_name,
        grade: params.grade,
        employment_status: params.employment_status,
        monthly_income: params.monthly_income,
        documents: params.documents,
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Application failed' }));
      throw new Error(error.detail || 'Failed to submit BNPL application');
    }
    return response.json();
  }

  async getApplication(applicationId: string): Promise<BNPLApplication> {
    const response = await fetch(`${BNPL_SERVICE_URL}/bnpl/application/${applicationId}`);
    if (!response.ok) {
      throw new Error('Application not found');
    }
    return response.json();
  }

  async getUserApplications(status?: string): Promise<{ applications: BNPLApplication[]; total: number }> {
    const userId = await this.getUserId();
    const url = status
      ? `${BNPL_SERVICE_URL}/bnpl/user/${userId}/applications?status=${status}`
      : `${BNPL_SERVICE_URL}/bnpl/user/${userId}/applications`;
    const response = await fetch(url);
    if (!response.ok) return { applications: [], total: 0 };
    return response.json();
  }

  async getPendingApplications(): Promise<{ applications: BNPLApplication[]; total: number }> {
    const response = await fetch(`${BNPL_SERVICE_URL}/bnpl/pending`);
    if (!response.ok) return { applications: [], total: 0 };
    return response.json();
  }

  async reviewApplication(params: {
    application_id: string;
    reviewer_id: string;
    action: 'approve' | 'reject';
    notes?: string;
    rejection_reason?: string;
    adjusted_amount?: number;
    adjusted_rate?: number;
  }): Promise<{ success: boolean; status: string; message: string }> {
    const response = await fetch(`${BNPL_SERVICE_URL}/bnpl/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Review failed' }));
      throw new Error(error.detail || 'Failed to review application');
    }
    return response.json();
  }

  async disburseFunds(applicationId: string, method?: string, recipientAccount?: string): Promise<{ success: boolean; disbursement_id: string }> {
    const response = await fetch(`${BNPL_SERVICE_URL}/bnpl/disburse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        application_id: applicationId,
        disbursement_method: method || 'bank_transfer',
        recipient_account: recipientAccount,
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Disbursement failed' }));
      throw new Error(error.detail || 'Failed to disburse funds');
    }
    return response.json();
  }

  async payInstallment(params: {
    application_id: string;
    installment_id: string;
    payment_method: 'wallet' | 'card' | 'bank_transfer' | 'mobile_money' | 'auto_debit';
    amount?: number;
  }): Promise<{
    success: boolean;
    payment_id: string;
    amount_paid: number;
    installment_status: string;
    application_status: string;
    remaining_installments: number;
  }> {
    const response = await fetch(`${BNPL_SERVICE_URL}/bnpl/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Payment failed' }));
      throw new Error(error.detail || 'Failed to process payment');
    }
    return response.json();
  }

  async getInstallments(applicationId: string): Promise<{
    application_id: string;
    installments: BNPLInstallment[];
    total_amount: number;
    total_paid: number;
    total_late_fees: number;
    remaining: number;
  }> {
    const response = await fetch(`${BNPL_SERVICE_URL}/bnpl/installments/${applicationId}`);
    if (!response.ok) throw new Error('Failed to fetch installments');
    return response.json();
  }

  async getPaymentHistory(applicationId: string): Promise<{ payments: BNPLPaymentRecord[]; total: number }> {
    const response = await fetch(`${BNPL_SERVICE_URL}/bnpl/payments/${applicationId}`);
    if (!response.ok) return { payments: [], total: 0 };
    return response.json();
  }

  async getNotifications(unreadOnly?: boolean): Promise<{ notifications: BNPLNotification[]; total: number }> {
    const userId = await this.getUserId();
    const url = unreadOnly
      ? `${BNPL_SERVICE_URL}/bnpl/notifications/${userId}?unread_only=true`
      : `${BNPL_SERVICE_URL}/bnpl/notifications/${userId}`;
    const response = await fetch(url);
    if (!response.ok) return { notifications: [], total: 0 };
    return response.json();
  }

  async getAuditTrail(applicationId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const response = await fetch(`${BNPL_SERVICE_URL}/bnpl/audit/${applicationId}`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.audit_trail || [];
    } catch (error) {
      console.error('Error fetching BNPL audit trail:', error);
      return [];
    }
  }

  async getAnalyticsSummary(): Promise<BNPLAnalytics> {
    const response = await fetch(`${BNPL_SERVICE_URL}/bnpl/analytics/summary`);
    if (!response.ok) {
      return {
        total_applications: 0,
        by_status: {},
        total_disbursed: 0,
        total_collected: 0,
        total_outstanding: 0,
        total_late_fees: 0,
        approval_rate: 0,
        default_rate: 0,
        total_defaults: 0,
      };
    }
    return response.json();
  }
}

export const bnplService = new BNPLService();
