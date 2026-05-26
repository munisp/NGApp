/**
 * Core CRM type definitions for multi-tenant platform.
 */

// ── Tenant & Auth ──────────────────────────────────────────
export interface Tenant {
  slug: string
  name: string
  vertical: 'banking' | 'telco' | 'commodity' | 'cpaas' | 'general'
  products: string[]
  logo?: string
  primaryColor?: string
  currency?: string
  locale?: string
}

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  tenantId: string
  permissions: string[]
  avatar?: string
}

export type UserRole = 'super_admin' | 'admin' | 'manager' | 'agent' | 'viewer'

// ── Customer ───────────────────────────────────────────────
export interface Customer {
  id: string
  tenantId: string
  name: string
  email: string
  phone?: string
  company?: string
  segment: CustomerSegment
  healthScore: number
  ltv: number
  status: 'active' | 'inactive' | 'churned' | 'prospect'
  source: 'core-banking' | 'agent-banking' | 'remittance' | 'direct' | 'api'
  tags: string[]
  createdAt: string
  updatedAt: string
}

export type CustomerSegment = 'enterprise' | 'corporate' | 'sme' | 'micro' | 'retail'

// ── Deal / Pipeline ────────────────────────────────────────
export interface Deal {
  id: string
  tenantId: string
  customerId: string
  title: string
  value: number
  currency: string
  stage: DealStage
  probability: number
  expectedCloseDate: string
  assignedTo: string
  products: string[]
  createdAt: string
  updatedAt: string
}

export type DealStage =
  | 'lead'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost'

// ── Analytics ──────────────────────────────────────────────
export interface DashboardMetrics {
  totalCustomers: number
  activeCustomers: number
  totalRevenue: number
  revenueGrowth: number
  avgHealthScore: number
  churnRate: number
  pipeline: PipelineMetrics
  topSegments: SegmentMetric[]
}

export interface PipelineMetrics {
  totalValue: number
  dealCount: number
  avgDealSize: number
  winRate: number
  avgCycleTime: number
  stages: { stage: DealStage; count: number; value: number }[]
}

export interface SegmentMetric {
  segment: CustomerSegment
  customerCount: number
  revenue: number
  healthScore: number
}

// ── Telco Vertical ─────────────────────────────────────────
export interface TelcoSubscriber {
  id: string
  msisdn: string
  imsi: string
  plan: string
  status: 'active' | 'suspended' | 'terminated'
  dataUsageGB: number
  voiceMinutes: number
  balance: number
  networkType: '5G' | '4G' | '3G' | '2G'
}

export interface CellSite {
  id: string
  name: string
  latitude: number
  longitude: number
  type: '5G' | '4G' | '3G'
  status: 'operational' | 'degraded' | 'down' | 'maintenance'
  traffic: number
  capacity: number
}

// ── Commodity Vertical ─────────────────────────────────────
export interface CommodityTrade {
  id: string
  commodity: string
  direction: 'buy' | 'sell'
  quantity: number
  price: number
  currency: string
  counterparty: string
  status: 'pending' | 'executed' | 'settled' | 'cancelled'
  tradeDate: string
  settlementDate: string
}

export interface PriceQuote {
  commodity: string
  bid: number
  ask: number
  last: number
  change: number
  changePercent: number
  volume: number
  timestamp: string
}

// ── CPaaS Vertical ─────────────────────────────────────────
export interface CPaaSChannel {
  id: string
  type: 'sms' | 'whatsapp' | 'voice' | 'email' | 'push' | 'rcs'
  status: 'active' | 'inactive' | 'rate_limited'
  messagesSent: number
  deliveryRate: number
  costPerMessage: number
}

export interface CPaaSMessage {
  id: string
  channelId: string
  direction: 'inbound' | 'outbound'
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'read'
  content: string
  recipient: string
  sender: string
  timestamp: string
}

// ── Agent / AI ─────────────────────────────────────────────
export interface AIAgent {
  id: string
  name: string
  type: 'sales' | 'cs' | 'analytics' | 'compliance'
  status: 'active' | 'paused' | 'error'
  permissionTier: 'observe' | 'suggest' | 'execute'
  actionsToday: number
  costToday: number
  successRate: number
}

// ── API Response ───────────────────────────────────────────
export interface APIResponse<T> {
  data: T
  meta?: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  error?: {
    code: string
    message: string
  }
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  version: string
  uptime: number
  checks: {
    database: boolean
    redis: boolean
    kafka: boolean
    opensearch: boolean
  }
}
