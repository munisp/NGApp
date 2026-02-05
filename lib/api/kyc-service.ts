import AsyncStorage from '@react-native-async-storage/async-storage';

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
  status: 'pending' | 'in_review' | 'verified' | 'rejected';
  submittedAt: string;
  reviewedAt?: string;
  rejectionReason?: string;
  verificationLevel: number; // 0-3 (0=none, 1=basic, 2=intermediate, 3=full)
}

class KYCService {
  private readonly STORAGE_KEY = '@kyc_data';
  private readonly STATUS_KEY = '@kyc_status';

  async submitKYC(data: KYCSubmission): Promise<{ success: boolean; message: string }> {
    try {
      // In production, this would upload images to server and submit for verification
      // For now, we'll store locally and simulate the verification process
      
      const kycData = {
        ...data,
        submittedAt: new Date().toISOString(),
        status: 'in_review' as const,
      };

      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(kycData));
      
      const status: KYCStatus = {
        status: 'in_review',
        submittedAt: new Date().toISOString(),
        verificationLevel: 0,
      };
      
      await AsyncStorage.setItem(this.STATUS_KEY, JSON.stringify(status));

      // Simulate facial recognition verification
      const facialMatch = await this.verifyFacialRecognition(data.frontImage, data.selfieImage);
      
      if (!facialMatch) {
        throw new Error('Facial verification failed. Please ensure your selfie matches your ID photo.');
      }

      return {
        success: true,
        message: 'KYC documents submitted successfully. Verification typically takes 24-48 hours.',
      };
    } catch (error: any) {
      console.error('KYC submission error:', error);
      throw new Error(error.message || 'Failed to submit KYC documents');
    }
  }

  async getKYCStatus(): Promise<KYCStatus | null> {
    try {
      const statusJson = await AsyncStorage.getItem(this.STATUS_KEY);
      if (!statusJson) return null;
      
      return JSON.parse(statusJson);
    } catch (error) {
      console.error('Error fetching KYC status:', error);
      return null;
    }
  }

  async updateKYCStatus(status: Partial<KYCStatus>): Promise<void> {
    try {
      const currentStatus = await this.getKYCStatus();
      if (!currentStatus) {
        throw new Error('No KYC submission found');
      }

      const updatedStatus = {
        ...currentStatus,
        ...status,
      };

      await AsyncStorage.setItem(this.STATUS_KEY, JSON.stringify(updatedStatus));
    } catch (error) {
      console.error('Error updating KYC status:', error);
      throw error;
    }
  }

  async verifyFacialRecognition(idImage: string, selfieImage: string): Promise<boolean> {
    // Connect to DeepFace facial recognition service (Facenet512 model)
    
    try {
      const response = await fetch('http://127.0.0.1:5009/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ document_image: idImage, selfie_image: selfieImage }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Facial recognition error:', error);
        return false;
      }

      const data = await response.json();
      
      // Return true only if:
      // 1. Faces match (confidence >= 95%)
      // 2. Liveness check passes (not a photo of a photo)
      const isMatch = data.isMatch && data.confidence >= 95 && data.livenessCheck?.isLikelyLive;
      
      console.log('Facial recognition result:', {
        isMatch,
        confidence: data.confidence,
        livenessCheck: data.livenessCheck,
      });
      
      return isMatch;
    } catch (error) {
      console.error('Facial recognition error:', error);
      return false;
    }
  }

  async extractDocumentData(documentImage: string): Promise<any> {
    // Connect to KYC Document OCR service (PaddleOCR)
    
    try {
      const response = await fetch('http://127.0.0.1:5008/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEY);
      await AsyncStorage.removeItem(this.STATUS_KEY);
    } catch (error) {
      console.error('Error clearing KYC data:', error);
      throw error;
    }
  }

  // Simulate automatic verification for testing
  async simulateVerification(approved: boolean = true): Promise<void> {
    const currentStatus = await this.getKYCStatus();
    if (!currentStatus) {
      throw new Error('No KYC submission found');
    }

    const updatedStatus: KYCStatus = {
      ...currentStatus,
      status: approved ? 'verified' : 'rejected',
      reviewedAt: new Date().toISOString(),
      verificationLevel: approved ? 3 : 0,
      rejectionReason: approved ? undefined : 'Document image quality is insufficient. Please resubmit with clearer photos.',
    };

    await this.updateKYCStatus(updatedStatus);
  }
}

export const kycService = new KYCService();
