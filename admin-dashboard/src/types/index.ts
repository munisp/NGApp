// Core types for Payment Switch Admin Dashboard

// Transaction types
export interface Transaction {
  id: string;
  transferId: string;
  payerFsp: string;
  payeeFsp: string;
  amount: number;
  currency: string;
  state: TransactionState;
  createdAt: string;
  completedAt?: string;
  errorCode?: string;
  errorMessage?: string;
  tigerBeetleId?: string;
  latencyMs?: number;
}

export type TransactionState = 
  | 'INITIATED'
  | 'RESERVED'
  | 'COMMITTED'
  | 'ABORTED'
  | 'EXPIRED'
  | 'FAILED';

// Participant types
export interface Participant {
  id: string;
  fspId: string;
  name: string;
  type: ParticipantType;
  status: ParticipantStatus;
  currency: string;
  tigerBeetleAccountId: string;
  netDebitCap: number;
  currentPosition: number;
  createdAt: string;
  updatedAt: string;
  kycStatus: KYCStatus;
  limits: ParticipantLimits;
  contacts: ParticipantContact[];
}

export type ParticipantType = 'DFSP' | 'HUB' | 'BANK' | 'MFI' | 'MOBILE_MONEY';
export type ParticipantStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING' | 'INACTIVE';
export type KYCStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface ParticipantLimits {
  dailyTransactionLimit: number;
  singleTransactionLimit: number;
  monthlyVolumeLimit: number;
  maxPendingTransfers: number;
}

export interface ParticipantContact {
  name: string;
  email: string;
  phone: string;
  role: string;
}

// Settlement types
export interface SettlementWindow {
  id: string;
  state: SettlementWindowState;
  openedAt: string;
  closedAt?: string;
  settledAt?: string;
  totalTransactions: number;
  totalAmount: number;
  currency: string;
  participants: SettlementParticipant[];
}

export type SettlementWindowState = 
  | 'OPEN'
  | 'CLOSED'
  | 'PENDING_SETTLEMENT'
  | 'SETTLING'
  | 'SETTLED'
  | 'ABORTED';

export interface SettlementParticipant {
  fspId: string;
  name: string;
  netPosition: number;
  debitAmount: number;
  creditAmount: number;
  transactionCount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface Settlement {
  id: string;
  windowId: string;
  state: SettlementState;
  createdAt: string;
  settledAt?: string;
  approvedBy?: string;
  participants: SettlementParticipant[];
  totalAmount: number;
  currency: string;
}

export type SettlementState = 
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PROCESSING'
  | 'SETTLED'
  | 'FAILED'
  | 'REJECTED';

// Fraud & Risk types
export interface FraudAlert {
  id: string;
  transactionId: string;
  alertType: FraudAlertType;
  severity: AlertSeverity;
  riskScore: number;
  mlConfidence: number;
  status: AlertStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: string;
  details: FraudAlertDetails;
}

export type FraudAlertType = 
  | 'VELOCITY_BREACH'
  | 'AMOUNT_ANOMALY'
  | 'PATTERN_MATCH'
  | 'SANCTIONS_HIT'
  | 'GEO_ANOMALY'
  | 'DEVICE_ANOMALY'
  | 'ML_DETECTION';

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertStatus = 'OPEN' | 'INVESTIGATING' | 'ESCALATED' | 'RESOLVED' | 'FALSE_POSITIVE';

export interface FraudAlertDetails {
  payerFsp: string;
  payeeFsp: string;
  amount: number;
  currency: string;
  triggerRules: string[];
  mlFeatures?: Record<string, number>;
}

export interface FraudRule {
  id: string;
  name: string;
  description: string;
  type: FraudRuleType;
  enabled: boolean;
  priority: number;
  conditions: FraudRuleCondition[];
  actions: FraudRuleAction[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export type FraudRuleType = 'VELOCITY' | 'AMOUNT' | 'PATTERN' | 'BLACKLIST' | 'CUSTOM';

export interface FraudRuleCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: string | number | string[];
}

export interface FraudRuleAction {
  type: 'BLOCK' | 'ALERT' | 'FLAG' | 'REVIEW' | 'LOG';
  severity?: AlertSeverity;
  notifyChannels?: string[];
}

// Kill Switch types
export interface KillSwitch {
  id: string;
  name: string;
  type: KillSwitchType;
  scope: KillSwitchScope;
  status: 'ACTIVE' | 'INACTIVE';
  activatedAt?: string;
  activatedBy?: string;
  deactivatedAt?: string;
  deactivatedBy?: string;
  reason?: string;
  affectedParticipants?: string[];
}

export type KillSwitchType = 
  | 'GLOBAL'
  | 'PARTICIPANT'
  | 'CURRENCY'
  | 'TRANSACTION_TYPE'
  | 'REGION';

export type KillSwitchScope = {
  type: KillSwitchType;
  value?: string;
};

// Report types
export interface Report {
  id: string;
  name: string;
  type: ReportType;
  format: 'PDF' | 'EXCEL' | 'CSV' | 'JSON';
  status: ReportStatus;
  scheduledAt?: string;
  generatedAt?: string;
  submittedAt?: string;
  parameters: Record<string, unknown>;
  downloadUrl?: string;
  fileSize?: number;
}

export type ReportType = 
  | 'DAILY_TRANSACTION'
  | 'SETTLEMENT'
  | 'REGULATORY_CBN'
  | 'FRAUD_SUMMARY'
  | 'PARTICIPANT_ACTIVITY'
  | 'RECONCILIATION'
  | 'AUDIT_LOG';

export type ReportStatus = 
  | 'SCHEDULED'
  | 'GENERATING'
  | 'READY'
  | 'SUBMITTED'
  | 'FAILED';

// API Key types
export interface APIKey {
  id: string;
  name: string;
  keyPrefix: string;
  participantId: string;
  permissions: string[];
  rateLimit: number;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  createdAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
  usageCount: number;
}

// Dashboard metrics types
export interface DashboardMetrics {
  tps: number;
  successRate: number;
  avgLatencyMs: number;
  activeParticipants: number;
  pendingSettlements: number;
  openAlerts: number;
  totalTransactionsToday: number;
  totalVolumeToday: number;
  currency: string;
}

export interface TimeSeriesDataPoint {
  timestamp: string;
  value: number;
}

export interface ParticipantHealth {
  fspId: string;
  name: string;
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  tps: number;
  successRate: number;
  avgLatencyMs: number;
  lastTransactionAt: string;
  errorRate: number;
}

// Audit log types
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
}

// User types
export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId?: string;
  participantId?: string;
  lastLoginAt?: string;
  createdAt: string;
}

export type UserRole = 'ADMIN' | 'OPERATOR' | 'VIEWER' | 'PARTICIPANT';

// Notification types
export interface Notification {
  id: string;
  type: NotificationType;
  severity: AlertSeverity;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

export type NotificationType = 
  | 'ALERT'
  | 'SETTLEMENT'
  | 'PARTICIPANT'
  | 'SYSTEM'
  | 'REPORT';
