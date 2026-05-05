/**
 * Event Bus — Simulates Kafka-based event streaming between systems
 * Topics: core-banking.customers, agent-banking.registrations, remittance.transactions
 * CRM subscribes to all topics and maintains unified customer records
 */

const eventListeners = new Map()
const eventLog = []

const topics = {
  CORE_BANKING_CUSTOMER: 'core-banking.customers',
  CORE_BANKING_TRANSACTION: 'core-banking.transactions',
  CORE_BANKING_KYC: 'core-banking.kyc',
  AGENT_BANKING_REGISTRATION: 'agent-banking.registrations',
  AGENT_BANKING_TRANSACTION: 'agent-banking.transactions',
  AGENT_BANKING_KYC_UPGRADE: 'agent-banking.kyc-upgrade',
  REMITTANCE_INBOUND: 'remittance.inbound',
  REMITTANCE_OUTBOUND: 'remittance.outbound',
  REMITTANCE_COMPLIANCE: 'remittance.compliance',
  CRM_CUSTOMER_UNIFIED: 'crm.customer.unified',
  CRM_CUSTOMER_UPDATED: 'crm.customer.updated',
  CRM_METRICS_UPDATED: 'crm.metrics.updated',
}

// Simulated recent events
const recentEvents = [
  { id: 'EVT-001', topic: topics.CORE_BANKING_CUSTOMER, type: 'ACCOUNT_OPENED', source: 'Core Banking', data: { customerId: 'CB-006', name: 'Yusuf Adamu', branch: 'Kano Branch' }, timestamp: new Date(Date.now() - 2 * 60 * 1000) },
  { id: 'EVT-002', topic: topics.AGENT_BANKING_REGISTRATION, type: 'CUSTOMER_REGISTERED', source: 'Agent Banking', data: { customerId: 'AG-007', name: 'Amina Sani', agentId: 'AGT-KN-018' }, timestamp: new Date(Date.now() - 5 * 60 * 1000) },
  { id: 'EVT-003', topic: topics.REMITTANCE_INBOUND, type: 'REMITTANCE_RECEIVED', source: 'Remittance', data: { senderId: 'REM-001', amount: 500, currency: 'GBP', corridor: 'GBP → NGN' }, timestamp: new Date(Date.now() - 8 * 60 * 1000) },
  { id: 'EVT-004', topic: topics.CORE_BANKING_TRANSACTION, type: 'LARGE_TRANSACTION', source: 'Core Banking', data: { customerId: 'CB-005', amount: 15000000, type: 'Credit' }, timestamp: new Date(Date.now() - 12 * 60 * 1000) },
  { id: 'EVT-005', topic: topics.AGENT_BANKING_KYC_UPGRADE, type: 'KYC_UPGRADED', source: 'Agent Banking', data: { customerId: 'AG-003', from: 'Basic', to: 'Enhanced' }, timestamp: new Date(Date.now() - 15 * 60 * 1000) },
  { id: 'EVT-006', topic: topics.REMITTANCE_COMPLIANCE, type: 'SANCTIONS_CLEARED', source: 'Remittance', data: { transactionId: 'TXN-REM-042', status: 'Cleared' }, timestamp: new Date(Date.now() - 18 * 60 * 1000) },
  { id: 'EVT-007', topic: topics.CORE_BANKING_KYC, type: 'KYC_VERIFIED', source: 'Core Banking', data: { customerId: 'CB-003', level: 3 }, timestamp: new Date(Date.now() - 22 * 60 * 1000) },
  { id: 'EVT-008', topic: topics.AGENT_BANKING_TRANSACTION, type: 'CASH_IN', source: 'Agent Banking', data: { customerId: 'AG-005', amount: 50000, agentId: 'AGT-PH-011' }, timestamp: new Date(Date.now() - 25 * 60 * 1000) },
  { id: 'EVT-009', topic: topics.REMITTANCE_OUTBOUND, type: 'REMITTANCE_SENT', source: 'Remittance', data: { senderId: 'REM-002', amount: 1500, currency: 'USD', corridor: 'USD → NGN' }, timestamp: new Date(Date.now() - 30 * 60 * 1000) },
  { id: 'EVT-010', topic: topics.CRM_CUSTOMER_UNIFIED, type: 'GOLDEN_RECORD_CREATED', source: 'CRM', data: { customerId: 'UNI-001', sources: ['core-banking', 'agent-banking'] }, timestamp: new Date(Date.now() - 35 * 60 * 1000) },
]

export const eventBus = {
  topics,

  subscribe(topic, callback) {
    if (!eventListeners.has(topic)) {
      eventListeners.set(topic, [])
    }
    eventListeners.get(topic).push(callback)
    return () => {
      const listeners = eventListeners.get(topic)
      const index = listeners.indexOf(callback)
      if (index > -1) listeners.splice(index, 1)
    }
  },

  publish(topic, event) {
    const fullEvent = {
      id: `EVT-${Date.now()}`,
      topic,
      timestamp: new Date(),
      ...event,
    }
    eventLog.push(fullEvent)
    const listeners = eventListeners.get(topic) || []
    listeners.forEach(cb => cb(fullEvent))
    return fullEvent
  },

  getRecentEvents(limit = 10) {
    return recentEvents.slice(0, limit)
  },

  getEventLog() {
    return [...eventLog, ...recentEvents].sort((a, b) => b.timestamp - a.timestamp)
  },

  getTopicStats() {
    return {
      [topics.CORE_BANKING_CUSTOMER]: { messagesPerMinute: 12, lag: 0, consumers: 3 },
      [topics.CORE_BANKING_TRANSACTION]: { messagesPerMinute: 85, lag: 2, consumers: 5 },
      [topics.CORE_BANKING_KYC]: { messagesPerMinute: 4, lag: 0, consumers: 2 },
      [topics.AGENT_BANKING_REGISTRATION]: { messagesPerMinute: 8, lag: 0, consumers: 2 },
      [topics.AGENT_BANKING_TRANSACTION]: { messagesPerMinute: 120, lag: 5, consumers: 4 },
      [topics.AGENT_BANKING_KYC_UPGRADE]: { messagesPerMinute: 2, lag: 0, consumers: 1 },
      [topics.REMITTANCE_INBOUND]: { messagesPerMinute: 18, lag: 1, consumers: 3 },
      [topics.REMITTANCE_OUTBOUND]: { messagesPerMinute: 15, lag: 0, consumers: 3 },
      [topics.REMITTANCE_COMPLIANCE]: { messagesPerMinute: 33, lag: 0, consumers: 2 },
      [topics.CRM_CUSTOMER_UNIFIED]: { messagesPerMinute: 20, lag: 0, consumers: 6 },
    }
  }
}

export default eventBus
