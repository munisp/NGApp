/**
 * useWebSocket — React hook wrapping CRMWebSocketClient.
 * Connects on mount, disconnects on unmount, re-connects on tenant change.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { useTenant } from '@/contexts/TenantContext'

const WS_BASE = import.meta.env.VITE_WS_URL || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`

export function useWebSocket(eventTypes = [], onMessage) {
  const { tenant } = useTenant()
  const tenantSlug = tenant?.slug || 'acme-bank'
  const wsRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState(null)
  const reconnectRef = useRef(0)
  const maxReconnect = 10

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    try {
      const ws = new WebSocket(`${WS_BASE}?tenant=${tenantSlug}`)

      ws.onopen = () => {
        setConnected(true)
        reconnectRef.current = 0
        if (eventTypes.length > 0) {
          ws.send(JSON.stringify({ type: 'subscribe', channels: eventTypes }))
        }
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'pong') return
          setLastMessage(data)
          onMessage?.(data)
        } catch {
          // ignore malformed messages
        }
      }

      ws.onclose = () => {
        setConnected(false)
        if (reconnectRef.current < maxReconnect) {
          reconnectRef.current++
          const delay = Math.min(1000 * Math.pow(1.5, reconnectRef.current), 30000)
          setTimeout(connect, delay)
        }
      }

      ws.onerror = () => ws.close()
      wsRef.current = ws
    } catch {
      // WS not available
    }
  }, [tenantSlug, eventTypes, onMessage])

  useEffect(() => {
    connect()
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect])

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ ...data, timestamp: new Date().toISOString() }))
    }
  }, [])

  return { connected, lastMessage, send }
}

export default useWebSocket
