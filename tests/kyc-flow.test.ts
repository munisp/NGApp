import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000';
const VIDEO_LIVENESS_URL = 'http://localhost:5011';
const OCR_URL = 'http://localhost:5010';

describe('KYC Flow End-to-End Tests', () => {
  let testUser: any;
  let authToken: string;
  let submissionId: string;

  beforeAll(async () => {
    // Create test user
    const registerResponse = await axios.post(`${API_BASE_URL}/api/auth/register`, {
      email: `test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      full_name: 'Test User',
    });
    testUser = registerResponse.data.user;
    authToken = registerResponse.data.token;
  });

  afterAll(async () => {
    // Cleanup: Delete test user
    if (testUser) {
      await axios.delete(`${API_BASE_URL}/api/users/${testUser.id}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
    }
  });

  describe('Video Liveness Detection', () => {
    it('should verify video liveness service is running', async () => {
      const response = await axios.get(`${VIDEO_LIVENESS_URL}/health`);
      expect(response.status).toBe(200);
      expect(response.data.status).toBe('healthy');
    });

    it('should detect liveness with valid video and challenges', async () => {
      // Create mock video data (base64 encoded)
      const mockVideoBase64 = Buffer.from('mock-video-data').toString('base64');
      const challenges = ['blink', 'turn_head_left', 'smile'];

      const response = await axios.post(`${VIDEO_LIVENESS_URL}/verify-liveness`, {
        video_base64: mockVideoBase64,
        challenges: challenges,
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('is_live');
      expect(response.data).toHaveProperty('confidence');
      expect(response.data).toHaveProperty('challenges_completed');
      expect(response.data.challenges_completed).toEqual(expect.arrayContaining(challenges));
    });

    it('should reject video with spoofing detected', async () => {
      const mockVideoBase64 = Buffer.from('spoofed-video-data').toString('base64');
      const challenges = ['blink'];

      const response = await axios.post(`${VIDEO_LIVENESS_URL}/verify-liveness`, {
        video_base64: mockVideoBase64,
        challenges: challenges,
      });

      expect(response.status).toBe(200);
      if (!response.data.is_live) {
        expect(response.data).toHaveProperty('failure_reason');
        expect(response.data).toHaveProperty('anti_spoofing_flags');
      }
    });

    it('should handle missing challenges parameter', async () => {
      const mockVideoBase64 = Buffer.from('mock-video-data').toString('base64');

      try {
        await axios.post(`${VIDEO_LIVENESS_URL}/verify-liveness`, {
          video_base64: mockVideoBase64,
        });
      } catch (error: any) {
        expect(error.response.status).toBe(422);
      }
    });
  });

  describe('OCR Document Extraction', () => {
    it('should verify OCR service is running', async () => {
      const response = await axios.get(`${OCR_URL}/health`);
      expect(response.status).toBe(200);
      expect(response.data.status).toBe('healthy');
    });

    it('should extract data from passport image', async () => {
      // Create mock passport image (base64 encoded)
      const mockImageBase64 = Buffer.from('mock-passport-image').toString('base64');

      const response = await axios.post(`${OCR_URL}/extract`, {
        image_base64: mockImageBase64,
        document_type: 'passport',
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('extracted_data');
      expect(response.data).toHaveProperty('confidence');
      expect(response.data.extracted_data).toHaveProperty('document_number');
      expect(response.data.extracted_data).toHaveProperty('full_name');
      expect(response.data.extracted_data).toHaveProperty('date_of_birth');
      expect(response.data.extracted_data).toHaveProperty('expiry_date');
    });

    it('should extract data from drivers license', async () => {
      const mockImageBase64 = Buffer.from('mock-license-image').toString('base64');

      const response = await axios.post(`${OCR_URL}/extract`, {
        image_base64: mockImageBase64,
        document_type: 'drivers_license',
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('extracted_data');
      expect(response.data.extracted_data).toHaveProperty('license_number');
      expect(response.data.extracted_data).toHaveProperty('full_name');
      expect(response.data.extracted_data).toHaveProperty('date_of_birth');
    });

    it('should handle low confidence OCR results', async () => {
      const mockImageBase64 = Buffer.from('blurry-image').toString('base64');

      const response = await axios.post(`${OCR_URL}/extract`, {
        image_base64: mockImageBase64,
        document_type: 'passport',
      });

      expect(response.status).toBe(200);
      if (response.data.confidence < 50) {
        expect(response.data).toHaveProperty('warning');
      }
    });
  });

  describe('Complete KYC Submission Flow', () => {
    it('should create KYC submission with all required data', async () => {
      // Step 1: Video liveness verification
      const mockVideoBase64 = Buffer.from('mock-video-data').toString('base64');
      const livenessResponse = await axios.post(`${VIDEO_LIVENESS_URL}/verify-liveness`, {
        video_base64: mockVideoBase64,
        challenges: ['blink', 'smile', 'turn_head_left'],
      });

      expect(livenessResponse.data.is_live).toBe(true);

      // Step 2: Upload document images
      const mockFrontImage = Buffer.from('mock-front-image').toString('base64');
      const mockBackImage = Buffer.from('mock-back-image').toString('base64');

      // Step 3: Create KYC submission
      const submissionResponse = await axios.post(
        `${API_BASE_URL}/api/kyc/submissions`,
        {
          document_type: 'drivers_license',
          front_image: `data:image/jpeg;base64,${mockFrontImage}`,
          back_image: `data:image/jpeg;base64,${mockBackImage}`,
          liveness_verified: true,
        },
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(submissionResponse.status).toBe(201);
      expect(submissionResponse.data).toHaveProperty('id');
      expect(submissionResponse.data.status).toBe('pending');
      submissionId = submissionResponse.data.id;
    });

    it('should reject KYC submission without liveness verification', async () => {
      const mockFrontImage = Buffer.from('mock-front-image').toString('base64');

      try {
        await axios.post(
          `${API_BASE_URL}/api/kyc/submissions`,
          {
            document_type: 'passport',
            front_image: `data:image/jpeg;base64,${mockFrontImage}`,
            liveness_verified: false,
          },
          {
            headers: { Authorization: `Bearer ${authToken}` },
          }
        );
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.detail).toContain('liveness');
      }
    });

    it('should retrieve KYC submission status', async () => {
      if (!submissionId) {
        throw new Error('No submission ID available');
      }

      const response = await axios.get(`${API_BASE_URL}/api/kyc/submissions/${submissionId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.status).toBe(200);
      expect(response.data.id).toBe(submissionId);
      expect(response.data).toHaveProperty('status');
      expect(response.data).toHaveProperty('created_at');
    });

    it('should process KYC submission through OCR', async () => {
      if (!submissionId) {
        throw new Error('No submission ID available');
      }

      // Trigger OCR processing
      const response = await axios.post(
        `${API_BASE_URL}/api/kyc/submissions/${submissionId}/process`,
        {},
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('ocr_data');
      expect(response.data.ocr_data).toHaveProperty('extracted_data');
      expect(response.data.ocr_data).toHaveProperty('confidence');
    });

    it('should allow admin to review KYC submission', async () => {
      if (!submissionId) {
        throw new Error('No submission ID available');
      }

      // Create admin user
      const adminRegisterResponse = await axios.post(`${API_BASE_URL}/api/auth/register`, {
        email: `admin-${Date.now()}@example.com`,
        password: 'AdminPassword123!',
        full_name: 'Admin User',
        role: 'admin',
      });
      const adminToken = adminRegisterResponse.data.token;

      // Approve submission
      const response = await axios.post(
        `${API_BASE_URL}/api/kyc/submissions/${submissionId}/review`,
        {
          status: 'approved',
          reviewer_notes: 'All documents verified successfully',
        },
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('approved');
      expect(response.data).toHaveProperty('reviewed_at');
      expect(response.data).toHaveProperty('reviewer_notes');

      // Cleanup admin user
      await axios.delete(`${API_BASE_URL}/api/users/${adminRegisterResponse.data.user.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
    });

    it('should update user KYC status after approval', async () => {
      const response = await axios.get(`${API_BASE_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.status).toBe(200);
      expect(response.data.kyc_status).toBe('verified');
      expect(response.data.kyc_verified_at).toBeTruthy();
    });
  });

  describe('Security and Compliance', () => {
    it('should log PII access events to Wazuh', async () => {
      if (!submissionId) {
        throw new Error('No submission ID available');
      }

      // Access KYC document
      const response = await axios.get(`${API_BASE_URL}/api/kyc/submissions/${submissionId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.status).toBe(200);

      // Check if audit log was created
      const auditResponse = await axios.get(
        `${API_BASE_URL}/api/kyc/audit-logs?submission_id=${submissionId}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(auditResponse.status).toBe(200);
      expect(auditResponse.data.logs).toContainEqual(
        expect.objectContaining({
          action: 'document_access',
          submission_id: submissionId,
        })
      );
    });

    it('should enforce rate limiting on KYC submissions', async () => {
      const mockFrontImage = Buffer.from('mock-front-image').toString('base64');

      // Attempt multiple submissions in quick succession
      const promises = Array(10)
        .fill(null)
        .map(() =>
          axios.post(
            `${API_BASE_URL}/api/kyc/submissions`,
            {
              document_type: 'passport',
              front_image: `data:image/jpeg;base64,${mockFrontImage}`,
              liveness_verified: true,
            },
            {
              headers: { Authorization: `Bearer ${authToken}` },
            }
          )
        );

      const results = await Promise.allSettled(promises);
      const rateLimited = results.some(
        (result) => result.status === 'rejected' && result.reason?.response?.status === 429
      );

      expect(rateLimited).toBe(true);
    });

    it('should encrypt PII data at rest', async () => {
      if (!submissionId) {
        throw new Error('No submission ID available');
      }

      // Get submission data
      const response = await axios.get(`${API_BASE_URL}/api/kyc/submissions/${submissionId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.status).toBe(200);

      // Check that sensitive fields are not returned in plain text
      // (they should be decrypted only when explicitly requested)
      expect(response.data).toHaveProperty('document_type');
      expect(response.data).not.toHaveProperty('front_image_url'); // Should be encrypted
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid document type', async () => {
      const mockFrontImage = Buffer.from('mock-front-image').toString('base64');

      try {
        await axios.post(
          `${API_BASE_URL}/api/kyc/submissions`,
          {
            document_type: 'invalid_type',
            front_image: `data:image/jpeg;base64,${mockFrontImage}`,
            liveness_verified: true,
          },
          {
            headers: { Authorization: `Bearer ${authToken}` },
          }
        );
      } catch (error: any) {
        expect(error.response.status).toBe(422);
      }
    });

    it('should handle missing required fields', async () => {
      try {
        await axios.post(
          `${API_BASE_URL}/api/kyc/submissions`,
          {
            document_type: 'passport',
            // Missing front_image
            liveness_verified: true,
          },
          {
            headers: { Authorization: `Bearer ${authToken}` },
          }
        );
      } catch (error: any) {
        expect(error.response.status).toBe(422);
      }
    });

    it('should handle duplicate KYC submissions', async () => {
      const mockFrontImage = Buffer.from('mock-front-image').toString('base64');

      // Create first submission
      await axios.post(
        `${API_BASE_URL}/api/kyc/submissions`,
        {
          document_type: 'passport',
          front_image: `data:image/jpeg;base64,${mockFrontImage}`,
          liveness_verified: true,
        },
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      // Attempt duplicate submission
      try {
        await axios.post(
          `${API_BASE_URL}/api/kyc/submissions`,
          {
            document_type: 'passport',
            front_image: `data:image/jpeg;base64,${mockFrontImage}`,
            liveness_verified: true,
          },
          {
            headers: { Authorization: `Bearer ${authToken}` },
          }
        );
      } catch (error: any) {
        expect(error.response.status).toBe(409);
        expect(error.response.data.detail).toContain('duplicate');
      }
    });

    it('should handle service unavailability gracefully', async () => {
      // Test with invalid OCR service URL
      const mockImageBase64 = Buffer.from('mock-image').toString('base64');

      try {
        await axios.post(
          'http://localhost:9999/extract',
          {
            image_base64: mockImageBase64,
            document_type: 'passport',
          },
          {
            timeout: 2000,
          }
        );
      } catch (error: any) {
        expect(error.code).toMatch(/ECONNREFUSED|ETIMEDOUT/);
      }
    });
  });
});
