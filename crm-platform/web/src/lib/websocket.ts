/**
 * WebSocket client for real-time CRM events.
 * Supports auto-reconnect, heartbeat, and tenant-scoped channels.
 */

export type EventType =
  | 'customer.created'
  | 'customer.updated'
  | 'customer.deleted'
  | 'deal.stage_changed'
  | 'deal.won'
  | 'deal.lost'
  | 'agent.action'
  | 'alert.triggered'
  | 'notification'
  | 'health.changed'
  | 'telco.subscriber_event'
  | 'commodity.trade_executed'
  | 'cpaas.message_delivered'

export interface WSMessage {
  type: EventType
  tenantId: string
  payload: Record<string, unknown>
  timestamp: string
  correlationId?: string
}

type MessageHandler = (msg: WSMessage) => void

interface WSClientOptions {
  url?: string
  tenantId: string
  reconnectInterval?: number
  maxReconnectAttempts?: number
  heartbeatInterval?: number
}

export class CRMWebSocketClient {
  private ws: WebSocket | null = null
  private handlers: Map<EventType | '*', Set<MessageHandler>> = new Map()
  private reconnectAttempts = 0
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private isClosing = false

  constructor(private options: WSClientOptions) {
    this.options.url = options.url || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
    this.options.reconnectInterval = options.reconnectInterval || 3000
    this.options.maxReconnectAttempts = options.maxReconnectAttempts || 10
    this.options.heartbeatInterval = options.heartbeatInterval || 30000
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return
    this.isClosing = false

    try {
      this.ws = new WebSocket(`${this.options.url}?tenant=${this.options.tenantId}`)

      this.ws.onopen = () => {
        this.reconnectAttempts = 0
        this.startHeartbeat()
      }

      this.ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data)
          this.dispatch(msg)
        } catch {
          // ignore malformed messages
        }
      }

      this.ws.onclose = () => {
        this.stopHeartbeat()
        if (!this.isClosing) this.scheduleReconnect()
      }

      this.ws.onerror = () => {
        this.ws?.close()
      }
    } catch {
      this.scheduleReconnect()
    }
  }

  disconnect(): void {
    this.isClosing = true
    this.stopHeartbeat()
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
  }

  on(type: EventType | '*', handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set())
    this.handlers.get(type)!.add(handler)
    return () => this.handlers.get(type)?.delete(handler)
  }

  send(msg: Omit<WSMessage, 'timestamp'>): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return
    this.ws.send(JSON.stringify({ ...msg, timestamp: new Date().toISOString() }))
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  private dispatch(msg: WSMessage): void {
    this.handlers.get(msg.type)?.forEach(h => h(msg))
    this.handlers.get('*')?.forEach(h => h(msg))
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, this.options.heartbeatInterval!)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts!) return
    this.reconnectAttempts++
    const delay = this.options.reconnectInterval! * Math.pow(1.5, this.reconnectAttempts - 1)
    this.reconnectTimer = setTimeout(() => this.connect(), Math.min(delay, 30000))
  }
}

let clientInstance: CRMWebSocketClient | null = null

export function getWSClient(tenantId: string): CRMWebSocketClient {
  if (!clientInstance || clientInstance['options'].tenantId !== tenantId) {
    clientInstance?.disconnect()
    clientInstance = new CRMWebSocketClient({ tenantId })
  }
  return clientInstance
}
