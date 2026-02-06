/**
 * KYB (Know Your Business) API Service
 * Integrates with Python KYB backend service for business verification
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KYB_SERVICE_URL = process.env.EXPO_PUBLIC_KYB_SERVICE_URL || 'http://127.0.0.1:8111';

// Types
export interface BusinessRegistrationData {
  businessName: string;
  registrationNumber: string;
  businessType: 'sole_proprietorship' | 'partnership' | 'limited_liability' | 'corporation' | 'cooperative';
  country: string;
  registrationDate: string;
  taxId: string;
  industry: string;
  website?: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

export interface BeneficialOwner {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  ownershipPercentage: number;
  idType: 'passport' | 'national_id' | 'drivers_license';
  idNumber: string;
  idExpiryDate: string;
  isPoliticallyExposed: boolean;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

export interface Director {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  position: string;
  appointmentDate: string;
  idType: 'passport' | 'national_id' | 'drivers_license';
  idNumber: string;
  idExpiryDate: string;
  isPoliticallyExposed: boolean;
}

export interface DocumentUpload {
  documentType: 'business_registration' | 'tax_certificate' | 'articles_of_incorporation' | 'proof_of_address' | 'financial_statement' | 'beneficial_owner_id' | 'director_id';
  file: {
    uri: string;
    name: string;
    type: string;
  };
  ownerId?: string; // For beneficial owner or director documents
}

export interface KYBSubmission {
  businessInfo: BusinessRegistrationData;
  beneficialOwners: BeneficialOwner[];
  directors: Director[];
  documents: DocumentUpload[];
}

export interface KYBVerificationResponse {
  verificationId: string;
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'requires_additional_info';
  businessInfo: BusinessRegistrationData;
  beneficialOwners: BeneficialOwner[];
  directors: Director[];
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  sanctionsCheckResults: {
    businessClean: boolean;
    ownersClean: boolean;
    directorsClean: boolean;
    matches: any[];
  };
  complianceChecks: {
    businessRegistrationVerified: boolean;
    taxIdVerified: boolean;
    beneficialOwnersVerified: boolean;
    directorsVerified: boolean;
    documentsVerified: boolean;
  };
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KYBStatusResponse {
  verificationId: string;
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'requires_additional_info';
  progress: {
    documentReview: number;
    sanctionsScreening: number;
    beneficialOwnerVerification: number;
    directorVerification: number;
    overallProgress: number;
  };
  estimatedCompletionTime?: string;
}

class KYBService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: KYB_SERVICE_URL,
      timeout: 60000, // 60 seconds for document uploads
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      async (config) => {
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          // Server responded with error status
          const message = (error.response.data as any)?.message || 'An error occurred';
          throw new Error(message);
        } else if (error.request) {
          // Request made but no response
          throw new Error('Network error. Please check your connection.');
        } else {
          // Error in request setup
          throw new Error(error.message);
        }
      }
    );
  }

  /**
   * Submit KYB verification request
   */
  async submitKYBVerification(data: KYBSubmission): Promise<KYBVerificationResponse> {
    try {
      const response = await this.api.post<KYBVerificationResponse>('/kyb/submit', data);
      return response.data;
    } catch (error) {
      console.error('KYB submission error:', error);
      throw error;
    }
  }

  /**
   * Upload business document
   */
  async uploadDocument(document: DocumentUpload): Promise<{ documentId: string; url: string }> {
    try {
      const formData = new FormData();
      formData.append('documentType', document.documentType);
      formData.append('file', {
        uri: document.file.uri,
        name: document.file.name,
        type: document.file.type,
      } as any);
      
      if (document.ownerId) {
        formData.append('ownerId', document.ownerId);
      }

      const response = await this.api.post<{ documentId: string; url: string }>(
        '/kyb/upload-document',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Document upload error:', error);
      throw error;
    }
  }

  /**
   * Get KYB verification status
   */
  async getVerificationStatus(verificationId: string): Promise<KYBStatusResponse> {
    try {
      const response = await this.api.get<KYBStatusResponse>(`/kyb/status/${verificationId}`);
      return response.data;
    } catch (error) {
      console.error('Get KYB status error:', error);
      throw error;
    }
  }

  /**
   * Get KYB verification details
   */
  async getVerificationDetails(verificationId: string): Promise<KYBVerificationResponse> {
    try {
      const response = await this.api.get<KYBVerificationResponse>(`/kyb/verification/${verificationId}`);
      return response.data;
    } catch (error) {
      console.error('Get KYB details error:', error);
      throw error;
    }
  }

  /**
   * Update KYB verification (for resubmission)
   */
  async updateVerification(
    verificationId: string,
    data: Partial<KYBSubmission>
  ): Promise<KYBVerificationResponse> {
    try {
      const response = await this.api.put<KYBVerificationResponse>(
        `/kyb/verification/${verificationId}`,
        data
      );
      return response.data;
    } catch (error) {
      console.error('Update KYB verification error:', error);
      throw error;
    }
  }

  /**
   * Perform sanctions screening
   */
  async performSanctionsScreening(data: {
    businessName: string;
    registrationNumber: string;
    beneficialOwners: Array<{ firstName: string; lastName: string; dateOfBirth: string }>;
    directors: Array<{ firstName: string; lastName: string; dateOfBirth: string }>;
  }): Promise<{
    businessClean: boolean;
    ownersClean: boolean;
    directorsClean: boolean;
    matches: any[];
  }> {
    try {
      const response = await this.api.post('/kyb/sanctions-screening', data);
      return response.data;
    } catch (error) {
      console.error('Sanctions screening error:', error);
      throw error;
    }
  }

  /**
   * Verify business registration
   */
  async verifyBusinessRegistration(data: {
    businessName: string;
    registrationNumber: string;
    country: string;
  }): Promise<{
    verified: boolean;
    registrationStatus: 'active' | 'inactive' | 'dissolved' | 'unknown';
    registrationDate?: string;
    businessType?: string;
    message?: string;
  }> {
    try {
      const response = await this.api.post('/kyb/verify-registration', data);
      return response.data;
    } catch (error) {
      console.error('Business registration verification error:', error);
      throw error;
    }
  }

  /**
   * Verify tax ID
   */
  async verifyTaxId(data: {
    taxId: string;
    businessName: string;
    country: string;
  }): Promise<{
    verified: boolean;
    status: 'valid' | 'invalid' | 'unknown';
    message?: string;
  }> {
    try {
      const response = await this.api.post('/kyb/verify-tax-id', data);
      return response.data;
    } catch (error) {
      console.error('Tax ID verification error:', error);
      throw error;
    }
  }

  /**
   * Extract data from business document using OCR
   */
  async extractDocumentData(documentUri: string, documentType: string): Promise<{
    extractedData: Record<string, any>;
    confidence: number;
  }> {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: documentUri,
        name: 'document.jpg',
        type: 'image/jpeg',
      } as any);
      formData.append('documentType', documentType);

      const response = await this.api.post('/kyb/extract-document-data', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data;
    } catch (error) {
      console.error('Document data extraction error:', error);
      throw error;
    }
  }

  /**
   * Calculate business risk score
   */
  async calculateRiskScore(data: {
    businessInfo: BusinessRegistrationData;
    beneficialOwners: BeneficialOwner[];
    directors: Director[];
    industry: string;
    country: string;
  }): Promise<{
    riskScore: number;
    riskLevel: 'low' | 'medium' | 'high';
    riskFactors: Array<{
      factor: string;
      impact: 'low' | 'medium' | 'high';
      description: string;
    }>;
  }> {
    try {
      const response = await this.api.post('/kyb/calculate-risk-score', data);
      return response.data;
    } catch (error) {
      console.error('Risk score calculation error:', error);
      throw error;
    }
  }

  /**
   * Get user's KYB verifications
   */
  async getUserVerifications(): Promise<KYBVerificationResponse[]> {
    try {
      const response = await this.api.get<KYBVerificationResponse[]>('/kyb/my-verifications');
      return response.data;
    } catch (error) {
      console.error('Get user verifications error:', error);
      throw error;
    }
  }

  /**
   * Check if user has completed KYB
   */
  async checkKYBStatus(): Promise<{
    hasCompletedKYB: boolean;
    status?: 'pending' | 'in_review' | 'approved' | 'rejected' | 'requires_additional_info';
    verificationId?: string;
  }> {
    try {
      const response = await this.api.get('/kyb/check-status');
      return response.data;
    } catch (error) {
      console.error('Check KYB status error:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const kybService = new KYBService();
