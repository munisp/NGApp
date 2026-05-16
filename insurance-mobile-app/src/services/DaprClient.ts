import { DaprClient as DaprSDKClient, CommunicationProtocolEnum } from '@dapr/dapr';

export interface DaprConfig {
  daprHost: string;
  daprPort: string;
  pubsubName: string;
  stateStoreName: string;
  secretStoreName: string;
}

export interface PublishOptions {
  topic: string;
  data: Record<string, unknown>;
  metadata?: Record<string, string>;
}

export interface StateOptions {
  key: string;
  value?: unknown;
  metadata?: Record<string, string>;
}

export interface ServiceInvocationOptions {
  appId: string;
  methodName: string;
  data?: Record<string, unknown>;
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE';
}

const DEFAULT_CONFIG: DaprConfig = {
  daprHost: process.env.DAPR_HOST || '127.0.0.1',
  daprPort: process.env.DAPR_HTTP_PORT || '3500',
  pubsubName: 'pubsub',
  stateStoreName: 'statestore',
  secretStoreName: 'secretstore',
};

class DaprClientService {
  private client: DaprSDKClient;
  private config: DaprConfig;
  private isInitialized: boolean = false;

  constructor(config: Partial<DaprConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.client = new DaprSDKClient({
      daprHost: this.config.daprHost,
      daprPort: this.config.daprPort,
      communicationProtocol: CommunicationProtocolEnum.HTTP,
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.client.start();
      this.isInitialized = true;
      console.log('Dapr client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Dapr client:', error);
      throw error;
    }
  }

  async publishEvent(options: PublishOptions): Promise<void> {
    await this.ensureInitialized();

    try {
      await this.client.pubsub.publish(
        this.config.pubsubName,
        options.topic,
        options.data,
        options.metadata
      );
      console.log(`Event published to ${options.topic}`);
    } catch (error) {
      console.error(`Failed to publish event to ${options.topic}:`, error);
      throw error;
    }
  }

  async saveState(options: StateOptions): Promise<void> {
    await this.ensureInitialized();

    try {
      await this.client.state.save(this.config.stateStoreName, [
        {
          key: options.key,
          value: options.value,
          metadata: options.metadata,
        },
      ]);
      console.log(`State saved: ${options.key}`);
    } catch (error) {
      console.error(`Failed to save state ${options.key}:`, error);
      throw error;
    }
  }

  async getState<T = unknown>(key: string): Promise<T | null> {
    await this.ensureInitialized();

    try {
      const result = await this.client.state.get(this.config.stateStoreName, key);
      return result as T;
    } catch (error) {
      console.error(`Failed to get state ${key}:`, error);
      throw error;
    }
  }

  async deleteState(key: string): Promise<void> {
    await this.ensureInitialized();

    try {
      await this.client.state.delete(this.config.stateStoreName, key);
      console.log(`State deleted: ${key}`);
    } catch (error) {
      console.error(`Failed to delete state ${key}:`, error);
      throw error;
    }
  }

  async invokeService<T = unknown>(options: ServiceInvocationOptions): Promise<T> {
    await this.ensureInitialized();

    try {
      const response = await this.client.invoker.invoke(
        options.appId,
        options.methodName,
        options.httpMethod || 'POST',
        options.data
      );
      console.log(`Service invoked: ${options.appId}/${options.methodName}`);
      return response as T;
    } catch (error) {
      console.error(`Failed to invoke service ${options.appId}/${options.methodName}:`, error);
      throw error;
    }
  }

  async getSecret(secretName: string): Promise<Record<string, string>> {
    await this.ensureInitialized();

    try {
      const secret = await this.client.secret.get(this.config.secretStoreName, secretName);
      return secret;
    } catch (error) {
      console.error(`Failed to get secret ${secretName}:`, error);
      throw error;
    }
  }

  async getBulkSecret(): Promise<Record<string, Record<string, string>>> {
    await this.ensureInitialized();

    try {
      const secrets = await this.client.secret.getBulk(this.config.secretStoreName);
      return secrets;
    } catch (error) {
      console.error('Failed to get bulk secrets:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.health.isHealthy();
      return true;
    } catch (error) {
      console.error('Dapr health check failed:', error);
      return false;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  async close(): Promise<void> {
    if (this.isInitialized) {
      await this.client.stop();
      this.isInitialized = false;
      console.log('Dapr client closed');
    }
  }
}

export const daprClient = new DaprClientService();

export class PolicyEventPublisher {
  private dapr: DaprClientService;

  constructor(daprClient: DaprClientService) {
    this.dapr = daprClient;
  }

  async publishPolicyCreated(policyId: string, customerId: string, policyType: string): Promise<void> {
    await this.dapr.publishEvent({
      topic: 'policy-events',
      data: {
        eventType: 'POLICY_CREATED',
        policyId,
        customerId,
        policyType,
        timestamp: new Date().toISOString(),
      },
    });
  }

  async publishPolicyUpdated(policyId: string, changes: Record<string, unknown>): Promise<void> {
    await this.dapr.publishEvent({
      topic: 'policy-events',
      data: {
        eventType: 'POLICY_UPDATED',
        policyId,
        changes,
        timestamp: new Date().toISOString(),
      },
    });
  }

  async publishPolicyCancelled(policyId: string, reason: string): Promise<void> {
    await this.dapr.publishEvent({
      topic: 'policy-events',
      data: {
        eventType: 'POLICY_CANCELLED',
        policyId,
        reason,
        timestamp: new Date().toISOString(),
      },
    });
  }

  async publishPremiumPaid(policyId: string, amount: number, paymentRef: string): Promise<void> {
    await this.dapr.publishEvent({
      topic: 'payment-events',
      data: {
        eventType: 'PREMIUM_PAID',
        policyId,
        amount,
        paymentRef,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

export class ClaimEventPublisher {
  private dapr: DaprClientService;

  constructor(daprClient: DaprClientService) {
    this.dapr = daprClient;
  }

  async publishClaimSubmitted(claimId: string, policyId: string, amount: number): Promise<void> {
    await this.dapr.publishEvent({
      topic: 'claim-events',
      data: {
        eventType: 'CLAIM_SUBMITTED',
        claimId,
        policyId,
        amount,
        timestamp: new Date().toISOString(),
      },
    });
  }

  async publishClaimApproved(claimId: string, approvedAmount: number): Promise<void> {
    await this.dapr.publishEvent({
      topic: 'claim-events',
      data: {
        eventType: 'CLAIM_APPROVED',
        claimId,
        approvedAmount,
        timestamp: new Date().toISOString(),
      },
    });
  }

  async publishClaimRejected(claimId: string, reason: string): Promise<void> {
    await this.dapr.publishEvent({
      topic: 'claim-events',
      data: {
        eventType: 'CLAIM_REJECTED',
        claimId,
        reason,
        timestamp: new Date().toISOString(),
      },
    });
  }

  async publishClaimPaid(claimId: string, amount: number, paymentRef: string): Promise<void> {
    await this.dapr.publishEvent({
      topic: 'claim-events',
      data: {
        eventType: 'CLAIM_PAID',
        claimId,
        amount,
        paymentRef,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

export class WorkflowStateManager {
  private dapr: DaprClientService;
  private keyPrefix: string = 'workflow:';

  constructor(daprClient: DaprClientService) {
    this.dapr = daprClient;
  }

  async saveWorkflowState(workflowId: string, state: Record<string, unknown>): Promise<void> {
    await this.dapr.saveState({
      key: `${this.keyPrefix}${workflowId}`,
      value: {
        ...state,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  async getWorkflowState<T = Record<string, unknown>>(workflowId: string): Promise<T | null> {
    return this.dapr.getState<T>(`${this.keyPrefix}${workflowId}`);
  }

  async deleteWorkflowState(workflowId: string): Promise<void> {
    await this.dapr.deleteState(`${this.keyPrefix}${workflowId}`);
  }
}

export class ServiceInvoker {
  private dapr: DaprClientService;

  constructor(daprClient: DaprClientService) {
    this.dapr = daprClient;
  }

  async invokeKYCService(customerId: string, documentType: string): Promise<unknown> {
    return this.dapr.invokeService({
      appId: 'kyc-service',
      methodName: 'api/v1/verify',
      data: { customerId, documentType },
    });
  }

  async invokeUnderwritingService(applicationId: string): Promise<unknown> {
    return this.dapr.invokeService({
      appId: 'underwriting-service',
      methodName: 'api/v1/evaluate',
      data: { applicationId },
    });
  }

  async invokePaymentService(policyId: string, amount: number): Promise<unknown> {
    return this.dapr.invokeService({
      appId: 'payment-service',
      methodName: 'api/v1/process',
      data: { policyId, amount },
    });
  }

  async invokeFraudDetectionService(transactionId: string, data: Record<string, unknown>): Promise<unknown> {
    return this.dapr.invokeService({
      appId: 'fraud-detection-service',
      methodName: 'api/v1/analyze',
      data: { transactionId, ...data },
    });
  }

  async invokeNotificationService(userId: string, message: string, channel: string): Promise<unknown> {
    return this.dapr.invokeService({
      appId: 'notification-service',
      methodName: 'api/v1/send',
      data: { userId, message, channel },
    });
  }
}

export default daprClient;
