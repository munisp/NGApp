package shared

import (
	"database/sql"
	"fmt"
	"math/rand"
	"os"
	"strconv"
	"sync"
	"sync/atomic"
	"time"
)

type DBConfig struct {
	PrimaryDSN     string
	ReplicaDSNs    []string
	MaxOpenConns   int
	MaxIdleConns   int
	ConnMaxLife    time.Duration
	ConnMaxIdle    time.Duration
	StatementTimeout int
}

func DefaultDBConfig() DBConfig {
	pgHost := getEnv("PGBOUNCER_HOST", "pgbouncer")
	pgPort := getEnv("PGBOUNCER_PORT", "6432")
	pgUser := getEnv("POSTGRES_USER", "fintech")
	pgPass := getEnv("POSTGRES_PASSWORD", "fintech_secret")
	pgDB := getEnv("POSTGRES_DB", "fintech")

	primaryDSN := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable statement_timeout=%s",
		pgHost, pgPort, pgUser, pgPass, pgDB, getEnv("STATEMENT_TIMEOUT_MS", "30000"),
	)

	replicaDSNs := []string{}
	replicaHost := getEnv("PGBOUNCER_REPLICA_HOST", "")
	if replicaHost != "" {
		replicaDSN := fmt.Sprintf(
			"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable statement_timeout=%s",
			replicaHost, pgPort, getEnv("POSTGRES_READONLY_USER", pgUser),
			getEnv("POSTGRES_READONLY_PASSWORD", pgPass), pgDB,
			getEnv("STATEMENT_TIMEOUT_MS", "30000"),
		)
		replicaDSNs = append(replicaDSNs, replicaDSN)
	}

	replicaCount, _ := strconv.Atoi(getEnv("POSTGRES_REPLICA_COUNT", "0"))
	for i := 1; i <= replicaCount; i++ {
		rHost := getEnv(fmt.Sprintf("PGBOUNCER_REPLICA_%d_HOST", i), "")
		if rHost != "" {
			rDSN := fmt.Sprintf(
				"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
				rHost, pgPort, getEnv("POSTGRES_READONLY_USER", pgUser),
				getEnv("POSTGRES_READONLY_PASSWORD", pgPass), pgDB,
			)
			replicaDSNs = append(replicaDSNs, rDSN)
		}
	}

	maxOpen, _ := strconv.Atoi(getEnv("DB_MAX_OPEN_CONNS", "25"))
	maxIdle, _ := strconv.Atoi(getEnv("DB_MAX_IDLE_CONNS", "10"))
	connMaxLifeSec, _ := strconv.Atoi(getEnv("DB_CONN_MAX_LIFE_SEC", "300"))
	connMaxIdleSec, _ := strconv.Atoi(getEnv("DB_CONN_MAX_IDLE_SEC", "60"))
	stmtTimeout, _ := strconv.Atoi(getEnv("STATEMENT_TIMEOUT_MS", "30000"))

	return DBConfig{
		PrimaryDSN:       primaryDSN,
		ReplicaDSNs:      replicaDSNs,
		MaxOpenConns:     maxOpen,
		MaxIdleConns:     maxIdle,
		ConnMaxLife:      time.Duration(connMaxLifeSec) * time.Second,
		ConnMaxIdle:      time.Duration(connMaxIdleSec) * time.Second,
		StatementTimeout: stmtTimeout,
	}
}

type DBPool struct {
	primary      *sql.DB
	replicas     []*sql.DB
	replicaIdx   atomic.Uint64
	logger       *StructuredLogger
	mu           sync.RWMutex
	healthChecks map[string]bool
}

func NewDBPool(cfg DBConfig, logger *StructuredLogger) (*DBPool, error) {
	pool := &DBPool{
		logger:       logger,
		healthChecks: make(map[string]bool),
	}

	primary, err := openDB(cfg.PrimaryDSN, cfg.MaxOpenConns, cfg.MaxIdleConns, cfg.ConnMaxLife, cfg.ConnMaxIdle)
	if err != nil {
		logger.Warn("primary DB connection deferred", map[string]interface{}{"error": err.Error()})
	}
	pool.primary = primary

	for i, dsn := range cfg.ReplicaDSNs {
		replica, err := openDB(dsn, cfg.MaxOpenConns*2, cfg.MaxIdleConns*2, cfg.ConnMaxLife, cfg.ConnMaxIdle)
		if err != nil {
			logger.Warn("replica DB connection deferred", map[string]interface{}{"replica": i, "error": err.Error()})
			continue
		}
		pool.replicas = append(pool.replicas, replica)
	}

	go pool.runHealthChecks()

	logger.Info("database pool initialized", map[string]interface{}{
		"primary":  cfg.PrimaryDSN != "",
		"replicas": len(pool.replicas),
	})

	return pool, nil
}

func openDB(dsn string, maxOpen, maxIdle int, maxLife, maxIdleTime time.Duration) (*sql.DB, error) {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(maxOpen)
	db.SetMaxIdleConns(maxIdle)
	db.SetConnMaxLifetime(maxLife)
	db.SetConnMaxIdleTime(maxIdleTime)
	return db, nil
}

func (p *DBPool) Primary() *sql.DB {
	return p.primary
}

func (p *DBPool) Replica() *sql.DB {
	if len(p.replicas) == 0 {
		return p.primary
	}
	idx := p.replicaIdx.Add(1)
	return p.replicas[idx%uint64(len(p.replicas))]
}

func (p *DBPool) ReadDB() *sql.DB {
	if len(p.replicas) == 0 {
		return p.primary
	}
	healthyReplicas := p.healthyReplicas()
	if len(healthyReplicas) == 0 {
		return p.primary
	}
	return healthyReplicas[rand.Intn(len(healthyReplicas))]
}

func (p *DBPool) WriteDB() *sql.DB {
	return p.primary
}

func (p *DBPool) healthyReplicas() []*sql.DB {
	p.mu.RLock()
	defer p.mu.RUnlock()
	var healthy []*sql.DB
	for i, r := range p.replicas {
		key := fmt.Sprintf("replica-%d", i)
		if ok, exists := p.healthChecks[key]; exists && ok {
			healthy = append(healthy, r)
		} else if !exists {
			healthy = append(healthy, r)
		}
	}
	return healthy
}

func (p *DBPool) runHealthChecks() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		p.mu.Lock()
		if p.primary != nil {
			err := p.primary.Ping()
			p.healthChecks["primary"] = err == nil
		}
		for i, r := range p.replicas {
			key := fmt.Sprintf("replica-%d", i)
			err := r.Ping()
			p.healthChecks[key] = err == nil
		}
		p.mu.Unlock()
	}
}

func (p *DBPool) Stats() map[string]interface{} {
	stats := make(map[string]interface{})
	if p.primary != nil {
		ps := p.primary.Stats()
		stats["primary"] = map[string]interface{}{
			"open_connections": ps.OpenConnections,
			"in_use":           ps.InUse,
			"idle":             ps.Idle,
			"wait_count":       ps.WaitCount,
			"wait_duration_ms": ps.WaitDuration.Milliseconds(),
			"max_idle_closed":  ps.MaxIdleClosed,
			"max_life_closed":  ps.MaxLifetimeClosed,
		}
	}
	for i, r := range p.replicas {
		rs := r.Stats()
		stats[fmt.Sprintf("replica_%d", i)] = map[string]interface{}{
			"open_connections": rs.OpenConnections,
			"in_use":           rs.InUse,
			"idle":             rs.Idle,
			"wait_count":       rs.WaitCount,
			"wait_duration_ms": rs.WaitDuration.Milliseconds(),
		}
	}
	return stats
}

func (p *DBPool) Close() error {
	if p.primary != nil {
		p.primary.Close()
	}
	for _, r := range p.replicas {
		r.Close()
	}
	return nil
}

func (p *DBPool) HealthCheck() bool {
	if p.primary == nil {
		return false
	}
	return p.primary.Ping() == nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
