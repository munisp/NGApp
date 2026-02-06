import AsyncStorage from '@react-native-async-storage/async-storage';

const KYC_UNIFIED_URL = process.env.EXPO_PUBLIC_KYC_UNIFIED_URL || 'http://127.0.0.1:8110';

export interface KYCSubmission {
  documentType: 'passport' | 'drivers_license' | 'national_id' | 'voters_card';
  frontImage: string;
  backImage: string | null;
  selfieImage: string;
  fullName: string;
  documentNumber: string;
  dateOfBirth: string;
  address: string;
}

export interface KYCStatus {
  status: 'pending' | 'ocr_processing' | 'face_matching' | 'liveness_check' | 'risk_scoring' | 'in_review' | 'verified' | 'rejected' | 'requires_resubmission';
  submittedAt: string;
  reviewedAt?: string;
  rejectionReason?: string;
  verificationLevel: number;
  verificationId?: string;
  riskAssessment?: {
    overall_score: number;
    risk_level: string;
    risk_factors: Array<{ factor: string; impact: string; value?: number }>;
  };
}

export interface KYCVerificationDetail {
  verification_id: string;
  user_id: string;
  document_type: string;
  status: string;
  verification_level: number;
  full_name?: string;
  document_number?: string;
  date_of_birth?: string;
  address?: string;
  nationality?: string;
  country?: string;
  ocr_data: Record<string, unknown>;
  face_data: Record<string, unknown>;
  risk_assessment: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  reviewed_at?: string;
  rejection_reason?: string;
}

class KYCService {
  private readonly STORAGE_KEY = '@kyc_data';
  private readonly STATUS_KEY = '@kyc_status';

  async submitKYC(data: KYCSubmission): Promise<{ success: boolean; message: string; verificationId?: string }> {
    try {
      const userId = await this.getUserId();

      const response = await fetch(`${KYC_UNIFIED_URL}/kyc/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          document_type: data.documentType,
          document_image: data.frontImage,
          selfie_image: data.selfieImage,
          document_number: data.documentNumber || undefined,
          full_name: data.fullName || undefined,
          date_of_birth: data.dateOfBirth || undefined,
          address: data.address || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Submission failed' }));
        throw new Error(error.detail || 'Failed to submit KYC');
      }

      const result = await response.json();

      const status: KYCStatus = {
        status: result.status || 'pending',
        submittedAt: new Date().toISOString(),
        verificationLevel: 0,
        verificationId: result.verification_id,
      };
      await AsyncStorage.setItem(this.STATUS_KEY, JSON.stringify(status));

      return {
        success: true,
        message: result.message || 'KYC documents submitted successfully. Verification typically takes 24-48 hours.',
        verificationId: result.verification_id,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to submit KYC documents';
      console.error('KYC submission error:', error);
      throw new Error(message);
    }
  }

  async getKYCStatus(): Promise<KYCStatus | null> {
    try {
      const userId = await this.getUserId();
      const response = await fetch(`${KYC_UNIFIED_URL}/kyc/status/${userId}`);

      if (!response.ok) {
        const cached = await AsyncStorage.getItem(this.STATUS_KEY);
        return cached ? JSON.parse(cached) : null;
      }

      const data = await response.json();
      if (data.status === 'not_submitted') {
        return null;
      }

      const v = data.verification;
      const status: KYCStatus = {
        status: v.status === 'approved' ? 'verified' : v.status,
        submittedAt: v.created_at,
        reviewedAt: v.reviewed_at,
        rejectionReason: v.rejection_reason,
        verificationLevel: v.verification_level || 0,
        verificationId: v.verification_id,
        riskAssessment: v.risk_assessment,
      };

      await AsyncStorage.setItem(this.STATUS_KEY, JSON.stringify(status));
      return status;
    } catch (error) {
      console.error('Error fetching KYC status:', error);
      const cached = await AsyncStorage.getItem(this.STATUS_KEY);
      return cached ? JSON.parse(cached) : null;
    }
  }

  async getVerificationDetail(verificationId: string): Promise<KYCVerificationDetail | null> {
    try {
      const response = await fetch(`${KYC_UNIFIED_URL}/kyc/verification/${verificationId}`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.verification;
    } catch (error) {
      console.error('Error fetching verification detail:', error);
      return null;
    }
  }

  async getPendingSubmissions(): Promise<Array<{
    verification_id: string;
    user_id: string;
    document_type: string;
    status: string;
    risk_assessment: Record<string, unknown>;
    nationality?: string;
    country?: string;
    created_at: string;
  }>> {
    try {
      const response = await fetch(`${KYC_UNIFIED_URL}/kyc/pending`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.submissions || [];
    } catch (error) {
      console.error('Error fetching pending submissions:', error);
      return [];
    }
  }

  async approveKYC(verificationId: string, reviewerId: string, notes?: string): Promise<{ success: boolean }> {
    const response = await fetch(`${KYC_UNIFIED_URL}/kyc/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verification_id: verificationId, reviewer_id: reviewerId, notes }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Approval failed' }));
      throw new Error(error.detail || 'Failed to approve');
    }
    return response.json();
  }

  async rejectKYC(verificationId: string, reviewerId: string, reason: string, notes?: string): Promise<{ success: boolean }> {
    const response = await fetch(`${KYC_UNIFIED_URL}/kyc/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verification_id: verificationId, reviewer_id: reviewerId, reason, notes }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Rejection failed' }));
      throw new Error(error.detail || 'Failed to reject');
    }
    return response.json();
  }

  async resubmitKYC(
    verificationId: string,
    documentType: string,
    documentImage: string,
    selfieImage: string,
    nationality?: string,
  ): Promise<{ success: boolean; verificationId: string }> {
    const userId = await this.getUserId();
    const response = await fetch(`${KYC_UNIFIED_URL}/kyc/resubmit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        verification_id: verificationId,
        user_id: userId,
        document_type: documentType,
        document_image: documentImage,
        selfie_image: selfieImage,
        nationality,
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Resubmission failed' }));
      throw new Error(error.detail || 'Failed to resubmit');
    }
    const data = await response.json();
    return { success: true, verificationId: data.verification_id };
  }

  async verifyVideoLiveness(
    verificationId: string,
    videoBase64: string,
    challenges: string[],
  ): Promise<{
    is_live: boolean;
    confidence: number;
    challenges_completed: string[];
    failure_reason?: string;
    anti_spoofing_flags?: { screen_replay_detected: boolean; mask_detected: boolean; multiple_faces_detected: boolean };
  }> {
    const userId = await this.getUserId();
    const response = await fetch(`${KYC_UNIFIED_URL}/kyc/video-liveness`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        verification_id: verificationId,
        video_base64: videoBase64,
        challenges,
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Liveness check failed' }));
      throw new Error(error.detail || 'Video liveness verification failed');
    }
    return response.json();
  }

  async getAuditLog(verificationId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const response = await fetch(`${KYC_UNIFIED_URL}/kyc/audit/${verificationId}`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.logs || [];
    } catch (error) {
      console.error('Error fetching audit log:', error);
      return [];
    }
  }

  async getAnalyticsSummary(): Promise<Record<string, unknown>> {
    try {
      const response = await fetch(`${KYC_UNIFIED_URL}/kyc/analytics/summary`);
      if (!response.ok) return {};
      return response.json();
    } catch (error) {
      console.error('Error fetching analytics:', error);
      return {};
    }
  }

  async verifyFacialRecognition(idImage: string, selfieImage: string): Promise<boolean> {
    try {
      const response = await fetch('http://127.0.0.1:5009/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_image: idImage, selfie_image: selfieImage }),
      });
      if (!response.ok) return false;
      const data = await response.json();
      return data.isMatch && data.confidence >= 95 && data.livenessCheck?.isLikelyLive;
    } catch (error) {
      console.error('Facial recognition error:', error);
      return false;
    }
  }

  async extractDocumentData(documentImage: string): Promise<Record<string, unknown>> {
    try {
      const response = await fetch('http://127.0.0.1:5008/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: documentImage }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'OCR extraction failed');
      }
      const data = await response.json();
      return {
        fullName: data.fullName || '',
        documentNumber: data.documentNumber || '',
        dateOfBirth: data.dateOfBirth || '',
        address: data.address || '',
        country: data.country || '',
        documentType: data.documentType || '',
        confidence: data.confidence || 0,
        rawText: data.rawText || [],
      };
    } catch (error) {
      console.error('Document extraction error:', error);
      throw error;
    }
  }

  async clearKYCData(): Promise<void> {
    await AsyncStorage.removeItem(this.STORAGE_KEY);
    await AsyncStorage.removeItem(this.STATUS_KEY);
  }

  private async getUserId(): Promise<string> {
    const userData = await AsyncStorage.getItem('userData');
    if (userData) {
      const parsed = JSON.parse(userData);
      return parsed.id || '1';
    }
    return '1';
  }
}

export const kycService = new KYCService();
