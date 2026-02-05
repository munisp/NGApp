/**
 * End-to-End Integration Test Suite
 * Tests complete flow: Mobile App → Go KYC Service → Python AI Services → Temporal → Kafka → Wazuh
 */

import { describe, it, expect, beforeAll } from "vitest";
import { grpcKYCClient } from "../lib/api/grpc-kyc-client";

// Test configuration
const TEST_USER_ID = "test-user-" + Date.now();
const TEST_DOCUMENT_TYPE = "passport";
const TEST_DOCUMENT_COUNTRY = "NG";

// Service URLs
const GO_KYC_SERVICE_URL = process.env.KYC_GRPC_URL || "http://localhost:8080";
const PYTHON_KYC_SERVICE_URL = process.env.PYTHON_KYC_URL || "http://localhost:5020";
const TIGERBEETLE_SERVICE_URL = process.env.TIGERBEETLE_URL || "http://localhost:5012";
const TEMPORAL_URL = process.env.TEMPORAL_URL || "http://localhost:7233";
const KAFKA_URL = process.env.KAFKA_URL || "http://localhost:9092";
const PERMIFY_URL = process.env.PERMIFY_URL || "http://localhost:3476";
const WAZUH_URL = process.env.WAZUH_URL || "http://localhost:1514";

describe("End-to-End Integration Tests", () => {
  let verificationId: string;

  describe("Service Health Checks", () => {
    it("should verify Go KYC service is running", async () => {
      const response = await fetch(`${GO_KYC_SERVICE_URL}/health`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.status).toBe("healthy");
    });

    it("should verify Python KYC service is running", async () => {
      const response = await fetch(`${PYTHON_KYC_SERVICE_URL}/health`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.status).toBe("healthy");
    });

    it("should verify TigerBeetle service is running", async () => {
      const response = await fetch(`${TIGERBEETLE_SERVICE_URL}/health`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.status).toBe("healthy");
    });

    it("should verify Temporal service is running", async () => {
      const response = await fetch(`${TEMPORAL_URL}/health`);
      expect(response.ok).toBe(true);
    });

    it("should verify Permify service is running", async () => {
      const response = await fetch(`${PERMIFY_URL}/healthz`);
      expect(response.ok).toBe(true);
    });
  });

  describe("Complete KYC Flow", () => {
    it("should create a new KYC verification", async () => {
      const result = await grpcKYCClient.createVerification(
        TEST_USER_ID,
        TEST_DOCUMENT_TYPE,
        TEST_DOCUMENT_COUNTRY
      );

      expect(result.verificationId).toBeDefined();
      expect(result.status).toBe("pending");
      expect(result.createdAt).toBeInstanceOf(Date);

      verificationId = result.verificationId;
    });

    it("should retrieve the created verification", async () => {
      const verification = await grpcKYCClient.getVerification(
        verificationId,
        TEST_USER_ID
      );

      expect(verification.id).toBe(verificationId);
      expect(verification.userId).toBe(TEST_USER_ID);
      expect(verification.documentType).toBe(TEST_DOCUMENT_TYPE);
      expect(verification.documentCountry).toBe(TEST_DOCUMENT_COUNTRY);
      expect(verification.status).toBe("pending");
    });

    it("should submit document and trigger OCR extraction", async () => {
      const documentImageUrl = "https://example.com/test-passport.jpg";
      
      const result = await grpcKYCClient.submitDocument(
        verificationId,
        TEST_USER_ID,
        documentImageUrl
      );

      expect(result.documentNumber).toBeDefined();
      expect(result.firstName).toBeDefined();
      expect(result.lastName).toBeDefined();
      expect(result.dateOfBirth).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it("should submit liveness video and verify challenge", async () => {
      const videoUrl = "https://example.com/test-liveness.mp4";
      const challenge = "blink";

      const result = await grpcKYCClient.submitLiveness(
        verificationId,
        TEST_USER_ID,
        videoUrl,
        challenge
      );

      expect(result.isLive).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.challenge).toBe(challenge);
      expect(result.challengePassed).toBe(true);
    });

    it("should verify Temporal workflow was triggered", async () => {
      // Wait for workflow to start
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const response = await fetch(
        `${TEMPORAL_URL}/api/v1/namespaces/default/workflows/${verificationId}`
      );
      expect(response.ok).toBe(true);
      
      const workflow = await response.json();
      expect(workflow.execution.workflowId).toBe(verificationId);
      expect(workflow.workflowExecutionInfo.type.name).toBe("KYCVerificationWorkflow");
    });

    it("should verify Kafka events were published", async () => {
      // Check Kafka for KYC events
      const response = await fetch(
        `${KAFKA_URL}/api/topics/kyc-events/messages?limit=10`
      );
      expect(response.ok).toBe(true);

      const messages = await response.json();
      const kycEvent = messages.find((msg: any) => 
        msg.value.verification_id === verificationId
      );
      
      expect(kycEvent).toBeDefined();
      expect(kycEvent.value.event_type).toBe("kyc.verification.created");
    });

    it("should verify Wazuh received audit logs", async () => {
      // Check Wazuh for KYC audit logs
      const response = await fetch(
        `${WAZUH_URL}/api/events?q=verification_id:${verificationId}`
      );
      expect(response.ok).toBe(true);

      const events = await response.json();
      expect(events.data.total_affected_items).toBeGreaterThan(0);
      
      const kycEvent = events.data.affected_items.find((event: any) =>
        event.data.verification_id === verificationId
      );
      expect(kycEvent).toBeDefined();
    });

    it("should verify Permify authorization for verification access", async () => {
      const response = await fetch(`${PERMIFY_URL}/v1/tenants/default/permissions/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: {
            type: "kyc_verification",
            id: verificationId,
          },
          permission: "view",
          subject: {
            type: "user",
            id: TEST_USER_ID,
          },
        }),
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.can).toBe("CHECK_RESULT_ALLOWED");
    });

    it("should approve verification (admin action)", async () => {
      const reviewerId = "admin-" + Date.now();
      
      const verification = await grpcKYCClient.approveVerification(
        verificationId,
        reviewerId,
        "Test approval"
      );

      expect(verification.status).toBe("approved");
      expect(verification.reviewedBy).toBe(reviewerId);
      expect(verification.reviewedAt).toBeInstanceOf(Date);
    });

    it("should create TigerBeetle account after KYC approval", async () => {
      // Check if TigerBeetle account was created
      const response = await fetch(
        `${TIGERBEETLE_SERVICE_URL}/accounts/${TEST_USER_ID}`
      );
      expect(response.ok).toBe(true);

      const account = await response.json();
      expect(account.id).toBeDefined();
      expect(account.user_data).toBe(TEST_USER_ID);
      expect(account.ledger).toBe(1); // Default ledger
      expect(account.code).toBe(1); // User account type
    });
  });

  describe("KYB Flow Integration", () => {
    let kybVerificationId: string;
    const TEST_BUSINESS_ID = "test-business-" + Date.now();

    it("should create a new KYB verification", async () => {
      const response = await fetch(`${PYTHON_KYC_SERVICE_URL}/kyb/verifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: TEST_BUSINESS_ID,
          business_name: "Test Company Ltd",
          business_type: "private_limited",
          registration_country: "NG",
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.verification_id).toBeDefined();
      expect(data.status).toBe("pending");

      kybVerificationId = data.verification_id;
    });

    it("should submit business registration document", async () => {
      const response = await fetch(
        `${PYTHON_KYC_SERVICE_URL}/kyb/verifications/${kybVerificationId}/documents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            document_type: "registration_certificate",
            document_url: "https://example.com/test-cert.pdf",
          }),
        }
      );

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.extraction_result).toBeDefined();
      expect(data.extraction_result.business_name).toBeDefined();
      expect(data.extraction_result.registration_number).toBeDefined();
    });

    it("should verify Temporal KYB workflow was triggered", async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const response = await fetch(
        `${TEMPORAL_URL}/api/v1/namespaces/default/workflows/${kybVerificationId}`
      );
      expect(response.ok).toBe(true);

      const workflow = await response.json();
      expect(workflow.workflowExecutionInfo.type.name).toBe("KYBVerificationWorkflow");
    });
  });

  describe("Transaction Flow with TigerBeetle", () => {
    const SENDER_ID = TEST_USER_ID;
    const RECEIVER_ID = "receiver-" + Date.now();
    const AMOUNT = 1000;

    it("should create receiver account", async () => {
      const response = await fetch(`${TIGERBEETLE_SERVICE_URL}/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: RECEIVER_ID,
          ledger: 1,
          code: 1, // User account
          user_data: RECEIVER_ID,
        }),
      });

      expect(response.ok).toBe(true);
    });

    it("should post a transfer between accounts", async () => {
      const response = await fetch(`${TIGERBEETLE_SERVICE_URL}/transfers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          debit_account_id: SENDER_ID,
          credit_account_id: RECEIVER_ID,
          amount: AMOUNT,
          ledger: 1,
          code: 1, // Transfer code
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.transfer_id).toBeDefined();
    });

    it("should verify Kafka transaction event was published", async () => {
      const response = await fetch(
        `${KAFKA_URL}/api/topics/transaction-events/messages?limit=10`
      );
      expect(response.ok).toBe(true);

      const messages = await response.json();
      const txEvent = messages.find((msg: any) =>
        msg.value.debit_account_id === SENDER_ID &&
        msg.value.credit_account_id === RECEIVER_ID
      );

      expect(txEvent).toBeDefined();
      expect(txEvent.value.amount).toBe(AMOUNT);
    });
  });

  describe("Performance Tests", () => {
    it("should handle concurrent KYC verifications", async () => {
      const concurrentRequests = 10;
      const startTime = Date.now();

      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        grpcKYCClient.createVerification(
          `concurrent-user-${i}-${Date.now()}`,
          TEST_DOCUMENT_TYPE,
          TEST_DOCUMENT_COUNTRY
        )
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(results.length).toBe(concurrentRequests);
      expect(results.every((r) => r.verificationId)).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it("should handle high-throughput TigerBeetle transfers", async () => {
      const transferCount = 100;
      const startTime = Date.now();

      const promises = Array.from({ length: transferCount }, (_, i) =>
        fetch(`${TIGERBEETLE_SERVICE_URL}/transfers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            debit_account_id: TEST_USER_ID,
            credit_account_id: `receiver-${i}`,
            amount: 100,
            ledger: 1,
            code: 1,
          }),
        })
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(results.every((r) => r.ok)).toBe(true);
      const throughput = (transferCount / duration) * 1000; // TPS
      expect(throughput).toBeGreaterThan(100); // At least 100 TPS
    });
  });
});
