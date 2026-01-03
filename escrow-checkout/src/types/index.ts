// Core types for SocialEscrow platform

export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: 'buyer' | 'seller' | 'agent' | 'admin';
  kycLevel: 0 | 1 | 2 | 3;
  verified: boolean;
}

export interface Seller extends User {
  username: string;
  location: string;
  website?: string;
  trustScore: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  totalTransactions: number;
  successRate: number;
}

export interface BankDetails {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  verified: boolean;
}

export interface Listing {
  id: string;
  title: string;
  description?: string;
  price: number;
  currency: string;
  images?: string[];
  seller: Seller;
  source: 'instagram' | 'whatsapp' | 'facebook' | 'tiktok' | 'twitter' | 'direct';
  sourceUrl?: string;
}

export type EscrowStatus = 
  | 'created'
  | 'funded'
  | 'accepted'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'disputed'
  | 'refunded'
  | 'expired'
  | 'cancelled';

export interface TimelineEvent {
  status: EscrowStatus;
  label: string;
  timestamp?: Date;
  completed: boolean;
  active: boolean;
  actor?: string;
}

export interface ShippingInfo {
  carrier: string;
  trackingNumber: string;
  estimatedDelivery: string;
  actualDelivery?: string;
  proofOfDelivery?: string[];
}

export interface Escrow {
  id: string;
  status: EscrowStatus;
  listing: Listing;
  buyer: User;
  seller: Seller;
  amount: number;
  fee: number;
  total: number;
  currency: string;
  createdAt: Date;
  expiresAt: Date;
  timeline: TimelineEvent[];
  shipping?: ShippingInfo;
  sellerBankDetails?: BankDetails;
  workflowId?: string;
}

export type DisputeReason = 
  | 'item_not_received'
  | 'item_not_as_described'
  | 'item_damaged'
  | 'wrong_item'
  | 'seller_unresponsive'
  | 'other';

export type DisputeStatus = 
  | 'opened'
  | 'evidence_requested'
  | 'under_review'
  | 'escalated'
  | 'resolved_buyer'
  | 'resolved_seller'
  | 'resolved_split';

export interface DisputeEvidence {
  id: string;
  type: 'image' | 'video' | 'document' | 'text';
  url?: string;
  content?: string;
  uploadedBy: string;
  uploadedAt: Date;
}

export interface Dispute {
  id: string;
  escrowId: string;
  status: DisputeStatus;
  reason: DisputeReason;
  description: string;
  initiatedBy: 'buyer' | 'seller';
  buyerEvidence: DisputeEvidence[];
  sellerEvidence: DisputeEvidence[];
  arbiterAssigned?: string;
  resolution?: {
    decision: string;
    buyerRefund: number;
    sellerPayout: number;
    resolvedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

export type RefundReason = 
  | 'buyer_cancelled'
  | 'seller_cancelled'
  | 'expired'
  | 'dispute_resolved'
  | 'fraud_detected';

export interface Refund {
  id: string;
  escrowId: string;
  amount: number;
  reason: RefundReason;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  initiatedAt: Date;
  completedAt?: Date;
}

export type KYCLevel = 0 | 1 | 2 | 3;

export interface KYCRequirement {
  level: KYCLevel;
  maxTransactionAmount: number;
  maxDailyVolume: number;
  requiredDocuments: string[];
}

export interface KYCSubmission {
  id: string;
  userId: string;
  targetLevel: KYCLevel;
  documents: {
    type: string;
    url: string;
    status: 'pending' | 'verified' | 'rejected';
  }[];
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: Date;
  reviewedAt?: Date;
}

export interface Agent {
  id: string;
  name: string;
  phone: string;
  location: {
    address: string;
    latitude: number;
    longitude: number;
  };
  rating: number;
  totalTransactions: number;
  available: boolean;
  floatBalance: number;
}

export type AgentTransactionType = 'cash_in' | 'cash_out';

export interface AgentTransaction {
  id: string;
  escrowId: string;
  agentId: string;
  type: AgentTransactionType;
  amount: number;
  status: 'pending' | 'agent_assigned' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: Date;
  completedAt?: Date;
}

export interface MarketplaceListing {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  images: string[];
  category: string;
  seller: Seller;
  escrowEnabled: boolean;
  createdAt: Date;
}

export interface Storefront {
  id: string;
  sellerId: string;
  name: string;
  description: string;
  logo?: string;
  banner?: string;
  listings: MarketplaceListing[];
  rating: number;
  totalSales: number;
  verified: boolean;
}

export interface Notification {
  id: string;
  type: 'escrow' | 'dispute' | 'refund' | 'kyc' | 'payout' | 'system';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  actionUrl?: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  description: string;
  icon: string;
  color?: string;
  enabled: boolean;
}

export interface LoyaltyInfo {
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  points: number;
  nextTierPoints: number;
  benefits: string[];
  cashbackRate: number;
}
