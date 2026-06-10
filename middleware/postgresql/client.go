package postgresql

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

// Client wraps database/sql with health checks, connection pool stats, and Patroni awareness.
type Client struct {
	db         *sql.DB
	patroniURL string
	httpClient *http.Client
}

// ClientConfig configures a PostgreSQL client.
type ClientConfig struct {
	DSN        string
	PatroniURL string
	MaxOpen    int
	MaxIdle    int
	MaxLife    time.Duration
}

// DefaultClientConfig reads from env vars.
func DefaultClientConfig() ClientConfig {
	return ClientConfig{
		DSN:        envOr("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/payment_switch?sslmode=disable"),
		PatroniURL: envOr("PATRONI_URL", "http://patroni:8008"),
		MaxOpen:    50,
		MaxIdle:    10,
		MaxLife:    5 * time.Minute,
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// NewClient opens a real Postgres connection.
func NewClient(cfg ClientConfig) (*Client, error) {
	db, err := sql.Open("postgres", cfg.DSN)
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}
	db.SetMaxOpenConns(cfg.MaxOpen)
	db.SetMaxIdleConns(cfg.MaxIdle)
	db.SetConnMaxLifetime(cfg.MaxLife)
	return &Client{
		db:         db,
		patroniURL: cfg.PatroniURL,
		httpClient: &http.Client{Timeout: 3 * time.Second},
	}, nil
}

// HealthCheck pings postgres.
func (c *Client) HealthCheck(ctx context.Context) error {
	return c.db.PingContext(ctx)
}

// Close closes the DB pool.
func (c *Client) Close() error {
	return c.db.Close()
}

// PoolStats returns the current connection pool statistics.
func (c *Client) PoolStats() sql.DBStats {
	return c.db.Stats()
}

// PatroniCluster queries the Patroni REST API for cluster state.
type PatroniMember struct {
	Name     string `json:"name"`
	Role     string `json:"role"`
	State    string `json:"state"`
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Timeline int    `json:"timeline"`
	Lag      *int64 `json:"lag"`
}

type PatroniClusterInfo struct {
	Members []PatroniMember `json:"members"`
}

func (c *Client) GetPatroniCluster(ctx context.Context) (*PatroniClusterInfo, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.patroniURL+"/cluster", nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("patroni cluster: %w", err)
	}
	defer resp.Body.Close()
	var info PatroniClusterInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, err
	}
	return &info, nil
}

// ReplicationLag returns bytes of replication lag from pg_stat_replication.
func (c *Client) ReplicationLag(ctx context.Context) (int64, error) {
	var lag sql.NullInt64
	err := c.db.QueryRowContext(ctx,
		`SELECT COALESCE(MAX(pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn)), 0)
		 FROM pg_stat_replication`).Scan(&lag)
	if err != nil {
		return 0, err
	}
	return lag.Int64, nil
}

// PartitionCount returns the total number of partitions for a given parent table.
func (c *Client) PartitionCount(ctx context.Context, tableName string) (int, error) {
	var count int
	err := c.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM pg_inherits
		 JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
		 WHERE parent.relname = $1`, tableName).Scan(&count)
	return count, err
}

// TableSize returns the total size (with indexes) for a table.
func (c *Client) TableSize(ctx context.Context, tableName string) (string, error) {
	var size string
	err := c.db.QueryRowContext(ctx,
		`SELECT pg_size_pretty(pg_total_relation_size($1))`, tableName).Scan(&size)
	return size, err
}

// ActiveConnections returns the number of active backend connections.
func (c *Client) ActiveConnections(ctx context.Context) (int, error) {
	var count int
	err := c.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active'`).Scan(&count)
	return count, err
}

// LongRunningQueries returns queries running longer than the given threshold.
func (c *Client) LongRunningQueries(ctx context.Context, threshold time.Duration) ([]map[string]interface{}, error) {
	rows, err := c.db.QueryContext(ctx,
		`SELECT pid, now() - pg_stat_activity.query_start AS duration,
		        query, state, wait_event_type
		 FROM pg_stat_activity
		 WHERE (now() - pg_stat_activity.query_start) > $1::interval
		   AND state != 'idle'
		 ORDER BY duration DESC LIMIT 10`, threshold.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []map[string]interface{}
	for rows.Next() {
		var pid int
		var dur, query, state string
		var waitType sql.NullString
		if err := rows.Scan(&pid, &dur, &query, &state, &waitType); err != nil {
			continue
		}
		results = append(results, map[string]interface{}{
			"pid": pid, "duration": dur, "query": query, "state": state,
			"wait_event_type": waitType.String,
		})
	}
	return results, nil
}
