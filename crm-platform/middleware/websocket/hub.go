package websocket

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// Hub manages WebSocket connections for real-time CRM events.
type Hub struct {
	mu          sync.RWMutex
	clients     map[string]map[*Client]bool // tenant -> clients
	broadcast   chan Message
	register    chan *Client
	unregister  chan *Client
}

// Client represents a single WebSocket connection.
type Client struct {
	conn     *websocket.Conn
	tenantID string
	userID   string
	send     chan []byte
}

// Message is a real-time event sent to clients.
type Message struct {
	TenantID string      `json:"tenant_id"`
	Type     string      `json:"type"` // customer_update, campaign_alert, trade_executed, etc.
	Payload  interface{} `json:"payload"`
	Time     time.Time   `json:"timestamp"`
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		allowed := []string{"https://crm.platform.ng", "http://localhost:5173", "http://localhost:3000"}
		for _, a := range allowed {
			if origin == a {
				return true
			}
		}
		return false
	},
}

// NewHub creates a new WebSocket hub.
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[string]map[*Client]bool),
		broadcast:  make(chan Message, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

// Run starts the hub's event loop.
func (h *Hub) Run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case client := <-h.register:
			h.mu.Lock()
			if h.clients[client.tenantID] == nil {
				h.clients[client.tenantID] = make(map[*Client]bool)
			}
			h.clients[client.tenantID][client] = true
			h.mu.Unlock()
		case client := <-h.unregister:
			h.mu.Lock()
			if clients, ok := h.clients[client.tenantID]; ok {
				delete(clients, client)
				close(client.send)
			}
			h.mu.Unlock()
		case msg := <-h.broadcast:
			data, _ := json.Marshal(msg)
			h.mu.RLock()
			if clients, ok := h.clients[msg.TenantID]; ok {
				for client := range clients {
					select {
					case client.send <- data:
					default:
						close(client.send)
						delete(clients, client)
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

// Broadcast sends a message to all clients of a tenant.
func (h *Hub) Broadcast(tenantID, msgType string, payload interface{}) {
	h.broadcast <- Message{
		TenantID: tenantID,
		Type:     msgType,
		Payload:  payload,
		Time:     time.Now(),
	}
}

// HandleWS handles WebSocket upgrade and client registration.
func (h *Hub) HandleWS(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		http.Error(w, "missing X-Tenant-ID", http.StatusBadRequest)
		return
	}
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	client := &Client{
		conn:     conn,
		tenantID: tenantID,
		userID:   r.URL.Query().Get("user_id"),
		send:     make(chan []byte, 256),
	}
	h.register <- client

	go client.writePump()
	go client.readPump(h)
}

func (c *Client) writePump() {
	defer c.conn.Close()
	for msg := range c.send {
		if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			return
		}
	}
}

func (c *Client) readPump(h *Hub) {
	defer func() {
		h.unregister <- c
		c.conn.Close()
	}()
	c.conn.SetReadLimit(512)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})
	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

// SSE handler for clients that don't support WebSocket.

// HandleSSE serves Server-Sent Events for a tenant.
func (h *Hub) HandleSSE(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		http.Error(w, "missing X-Tenant-ID", http.StatusBadRequest)
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", r.Header.Get("Origin"))

	events := make(chan []byte, 64)
	client := &Client{tenantID: tenantID, send: events}
	h.register <- client
	defer func() { h.unregister <- client }()

	for {
		select {
		case <-r.Context().Done():
			return
		case data := <-events:
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		}
	}
}
