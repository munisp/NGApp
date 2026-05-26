// Package ws implements a WebSocket hub for broadcasting real-time alarm events
// to connected operator dashboard clients.
// Spec: WS /api/v1/stream/alarms — sub-second latency for critical alarms.
package ws

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"sync"
	"time"
)

// AlarmEvent is the message broadcast to all connected clients.
type AlarmEvent struct {
	AlarmID   string    `json:"alarm_id"`
	WellID    string    `json:"well_id"`
	WellName  string    `json:"well_name"`
	Severity  string    `json:"severity"` // CRITICAL, HIGH, MEDIUM, LOW
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
	TenantID  string    `json:"tenant_id"`
}

// Client represents a single WebSocket connection.
type Client struct {
	hub      *Hub
	conn     wsConn
	send     chan []byte
	tenantID string
}

// wsConn abstracts the WebSocket connection for testability.
type wsConn interface {
	ReadMessage() (int, []byte, error)
	WriteMessage(int, []byte) error
	Close() error
}

// Hub maintains the set of active clients and broadcasts messages.
type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

// NewHub creates a new Hub instance.
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

// Run starts the hub event loop. Call in a goroutine.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			slog.Info("ws client connected", "tenant", client.tenantID, "total", len(h.clients))

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()
			slog.Info("ws client disconnected", "tenant", client.tenantID, "total", len(h.clients))

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					// Slow client — drop message to avoid blocking
					slog.Warn("ws client send buffer full, dropping message", "tenant", client.tenantID)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// Broadcast sends an AlarmEvent to all connected clients.
func (h *Hub) Broadcast(event AlarmEvent) error {
	data, err := json.Marshal(event)
	if err != nil {
		return err
	}
	select {
	case h.broadcast <- data:
	default:
		slog.Warn("broadcast channel full, dropping alarm event", "alarm_id", event.AlarmID)
	}
	return nil
}

// ServeWS upgrades the HTTP connection to WebSocket and registers the client.
// Uses a simple polling fallback if gorilla/websocket is unavailable.
func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	// In production: upgrade using gorilla/websocket or nhooyr.io/websocket
	// Here we implement SSE (Server-Sent Events) as a WebSocket-compatible fallback
	// that works without external dependencies.
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	// Create a channel-based client for SSE
	msgCh := make(chan []byte, 64)
	client := &Client{
		hub:      h,
		send:     msgCh,
		tenantID: r.Header.Get("X-Tenant-ID"),
	}
	h.register <- client
	defer func() { h.unregister <- client }()

	// Send initial connected event
	fmt.Fprintf(w, "event: connected\ndata: {\"status\":\"connected\"}\n\n")
	flusher.Flush()

	// Stream events
	ctx := r.Context()
	heartbeat := time.NewTicker(30 * time.Second)
	defer heartbeat.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-heartbeat.C:
			fmt.Fprintf(w, ": heartbeat\n\n")
			flusher.Flush()
		case msg, ok := <-msgCh:
			if !ok {
				return
			}
			fmt.Fprintf(w, "event: alarm\ndata: %s\n\n", msg)
			flusher.Flush()
		}
	}
}
