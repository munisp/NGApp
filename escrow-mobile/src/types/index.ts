// Shared types for EscrowProtect mobile app
// These mirror the PWA types for consistency

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

export interface Dispute {
  id: string;
  escrowId: string;
  status: DisputeStatus;
  reason: DisputeReason;
  description: string;
  initiatedBy: 'buyer' | 'seller';
  createdAt: Date;
  updatedAt: Date;
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
}

export type AgentTransactionType = 'cash_in' | 'cash_out';

export interface RootStackParamList {
  Home: undefined;
  EscrowDetail: { escrowId: string; role?: string };
  DisputeForm: { escrowId: string };
  RefundRequest: { escrowId: string };
  AgentCash: { escrowId: string; type: AgentTransactionType };
  Marketplace: undefined;
  SellerProfile: { sellerId: string };
}
