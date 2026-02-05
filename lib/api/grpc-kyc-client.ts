/**
 * gRPC Client for Go KYC Service
 * Connects React Native mobile app to Go gRPC backend
 */

// Configuration
const KYC_SERVICE_URL = process.env.EXPO_PUBLIC_KYC_GRPC_URL || "http://localhost:8080";

// Type definitions (matching Go protobuf)
export interface KYCVerification {
  id: string;
  userId: string;
  documentType: string;
  documentNumber?: string;
  documentCountry: string;
  documentExpiryDate?: Date;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: Date;
  nationality?: string;
  address?: string;
  documentImageUrl?: string;
  selfieVideoUrl?: string;
  livenessChallenge?: string;
  livenessScore?: number;
  faceMatchScore?: number;
  riskScore?: number;
  riskLevel?: string;
  status: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentExtractionResult {
  documentNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  expiryDate: string;
  confidence: number;
}

export interface LivenessResult {
  isLive: boolean;
  confidence: number;
  challenge: string;
  challengePassed: boolean;
}

// gRPC Client Class
export class GrpcKYCClient {
  private baseUrl: string;

  constructor(baseUrl: string = KYC_SERVICE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Create a new KYC verification
   */
  async createVerification(
    userId: string,
    documentType: string,
    documentCountry: string
  ): Promise<{ verificationId: string; status: string; createdAt: Date }> {
    const response = await fetch(`${this.baseUrl}/v1/kyc/verifications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        document_type: documentType,
        document_country: documentCountry,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create verification: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      verificationId: data.verification_id,
      status: data.status,
      createdAt: new Date(data.created_at),
    };
  }

  /**
   * Get verification by ID
   */
  async getVerification(
    verificationId: string,
    userId: string
  ): Promise<KYCVerification> {
    const response = await fetch(
      `${this.baseUrl}/v1/kyc/verifications/${verificationId}?user_id=${userId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get verification: ${response.statusText}`);
    }

    const data = await response.json();
    return this.mapVerificationResponse(data.verification);
  }

  /**
   * List verifications for a user
   */
  async listVerifications(
    userId: string,
    status?: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{ verifications: KYCVerification[]; total: number; page: number; pageSize: number }> {
    const params = new URLSearchParams({
      user_id: userId,
      page: page.toString(),
      page_size: pageSize.toString(),
    });

    if (status) {
      params.append("status", status);
    }

    const response = await fetch(
      `${this.baseUrl}/v1/kyc/verifications?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to list verifications: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      verifications: data.verifications.map(this.mapVerificationResponse),
      total: data.total,
      page: data.page,
      pageSize: data.page_size,
    };
  }

  /**
   * Submit document for OCR extraction
   */
  async submitDocument(
    verificationId: string,
    userId: string,
    documentImageUrl: string
  ): Promise<DocumentExtractionResult> {
    const response = await fetch(`${this.baseUrl}/v1/kyc/verifications/${verificationId}/document`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        document_image_url: documentImageUrl,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to submit document: ${response.statusText}`);
    }

    const data = await response.json();
    return data.extraction_result;
  }

  /**
   * Submit liveness video
   */
  async submitLiveness(
    verificationId: string,
    userId: string,
    videoUrl: string,
    challenge: string
  ): Promise<LivenessResult> {
    const response = await fetch(`${this.baseUrl}/v1/kyc/verifications/${verificationId}/liveness`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        video_url: videoUrl,
        challenge: challenge,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to submit liveness: ${response.statusText}`);
    }

    const data = await response.json();
    return data.liveness_result;
  }

  /**
   * Approve verification (admin only)
   */
  async approveVerification(
    verificationId: string,
    reviewerId: string,
    notes?: string
  ): Promise<KYCVerification> {
    const response = await fetch(`${this.baseUrl}/v1/kyc/verifications/${verificationId}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reviewer_id: reviewerId,
        notes: notes,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to approve verification: ${response.statusText}`);
    }

    const data = await response.json();
    return this.mapVerificationResponse(data.verification);
  }

  /**
   * Reject verification (admin only)
   */
  async rejectVerification(
    verificationId: string,
    reviewerId: string,
    reason: string
  ): Promise<KYCVerification> {
    const response = await fetch(`${this.baseUrl}/v1/kyc/verifications/${verificationId}/reject`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reviewer_id: reviewerId,
        reason: reason,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to reject verification: ${response.statusText}`);
    }

    const data = await response.json();
    return this.mapVerificationResponse(data.verification);
  }

  /**
   * Map API response to KYCVerification type
   */
  private mapVerificationResponse(data: any): KYCVerification {
    return {
      id: data.id,
      userId: data.user_id,
      documentType: data.document_type,
      documentNumber: data.document_number,
      documentCountry: data.document_country,
      documentExpiryDate: data.document_expiry_date ? new Date(data.document_expiry_date) : undefined,
      firstName: data.first_name,
      lastName: data.last_name,
      dateOfBirth: data.date_of_birth ? new Date(data.date_of_birth) : undefined,
      nationality: data.nationality,
      address: data.address,
      documentImageUrl: data.document_image_url,
      selfieVideoUrl: data.selfie_video_url,
      livenessChallenge: data.liveness_challenge,
      livenessScore: data.liveness_score,
      faceMatchScore: data.face_match_score,
      riskScore: data.risk_score,
      riskLevel: data.risk_level,
      status: data.status,
      reviewedBy: data.reviewed_by,
      reviewedAt: data.reviewed_at ? new Date(data.reviewed_at) : undefined,
      rejectionReason: data.rejection_reason,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}

// Export singleton instance
export const grpcKYCClient = new GrpcKYCClient();
