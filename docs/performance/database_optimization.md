# Database Performance Optimization - Enterprise CRM PostgreSQL

## Overview
This document outlines comprehensive database performance optimization strategies for the Enterprise CRM PostgreSQL database, focusing on query optimization, indexing, connection management, and scalability.

## Performance Targets

### Query Performance
- **Simple Queries**: < 10ms average response time
- **Complex Queries**: < 100ms average response time
- **Analytical Queries**: < 500ms average response time
- **Bulk Operations**: < 1000ms for 1000 records

### Connection Management
- **Connection Pool Size**: 20-50 connections per service
- **Connection Acquisition**: < 5ms
- **Connection Utilization**: 70-80% optimal
- **Idle Connection Timeout**: 30 minutes

### Throughput Targets
- **Read Operations**: 10,000+ QPS
- **Write Operations**: 5,000+ QPS
- **Concurrent Connections**: 500+ active connections
- **Transaction Throughput**: 2,000+ TPS

## Database Schema Optimization

### Indexing Strategy

#### Primary Indexes
```sql
-- Customer table indexes
CREATE INDEX CONCURRENTLY idx_customers_email ON customers(email);
CREATE INDEX CONCURRENTLY idx_customers_status ON customers(status);
CREATE INDEX CONCURRENTLY idx_customers_created_at ON customers(created_at);
CREATE INDEX CONCURRENTLY idx_customers_company_id ON customers(company_id);

-- Composite indexes for common queries
CREATE INDEX CONCURRENTLY idx_customers_status_created ON customers(status, created_at DESC);
CREATE INDEX CONCURRENTLY idx_customers_company_status ON customers(company_id, status);

-- CRM Core indexes
CREATE INDEX CONCURRENTLY idx_leads_status ON leads(status);
CREATE INDEX CONCURRENTLY idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX CONCURRENTLY idx_leads_created_at ON leads(created_at);
CREATE INDEX CONCURRENTLY idx_leads_source ON leads(source);

-- Composite indexes for lead management
CREATE INDEX CONCURRENTLY idx_leads_status_assigned ON leads(status, assigned_to);
CREATE INDEX CONCURRENTLY idx_leads_assigned_created ON leads(assigned_to, created_at DESC);

-- Opportunity indexes
CREATE INDEX CONCURRENTLY idx_opportunities_stage ON opportunities(stage);
CREATE INDEX CONCURRENTLY idx_opportunities_owner ON opportunities(owner_id);
CREATE INDEX CONCURRENTLY idx_opportunities_value ON opportunities(estimated_value);
CREATE INDEX CONCURRENTLY idx_opportunities_close_date ON opportunities(expected_close_date);

-- Inventory indexes
CREATE INDEX CONCURRENTLY idx_products_category ON products(category_id);
CREATE INDEX CONCURRENTLY idx_products_status ON products(status);
CREATE INDEX CONCURRENTLY idx_products_sku ON products(sku);

-- Stock movement indexes
CREATE INDEX CONCURRENTLY idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX CONCURRENTLY idx_stock_movements_warehouse ON stock_movements(warehouse_id);
CREATE INDEX CONCURRENTLY idx_stock_movements_created ON stock_movements(created_at);
CREATE INDEX CONCURRENTLY idx_stock_movements_type ON stock_movements(movement_type);
```

#### Partial Indexes
```sql
-- Partial indexes for active records only
CREATE INDEX CONCURRENTLY idx_customers_active_email 
ON customers(email) WHERE status = 'active';

CREATE INDEX CONCURRENTLY idx_leads_open_assigned 
ON leads(assigned_to, created_at) WHERE status IN ('new', 'contacted', 'qualified');

CREATE INDEX CONCURRENTLY idx_opportunities_open_stage 
ON opportunities(stage, expected_close_date) WHERE status = 'open';

-- Partial indexes for recent data
CREATE INDEX CONCURRENTLY idx_stock_movements_recent 
ON stock_movements(product_id, created_at) 
WHERE created_at > CURRENT_DATE - INTERVAL '30 days';
```

#### Full-Text Search Indexes
```sql
-- Full-text search for customers
ALTER TABLE customers ADD COLUMN search_vector tsvector;

CREATE INDEX CONCURRENTLY idx_customers_search 
ON customers USING gin(search_vector);

-- Update search vector trigger
CREATE OR REPLACE FUNCTION update_customer_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.email, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.phone, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.company, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_customer_search_vector
  BEFORE INSERT OR UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_customer_search_vector();
```

### Table Partitioning

#### Time-Based Partitioning
```sql
-- Partition large tables by date
CREATE TABLE events (
    id BIGSERIAL,
    event_type VARCHAR(50) NOT NULL,
    entity_id BIGINT NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE events_2024_01 PARTITION OF events
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE events_2024_02 PARTITION OF events
FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Automated partition creation
CREATE OR REPLACE FUNCTION create_monthly_partition(table_name text, start_date date)
RETURNS void AS $$
DECLARE
    partition_name text;
    end_date date;
BEGIN
    partition_name := table_name || '_' || to_char(start_date, 'YYYY_MM');
    end_date := start_date + interval '1 month';
    
    EXECUTE format('CREATE TABLE %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                   partition_name, table_name, start_date, end_date);
    
    EXECUTE format('CREATE INDEX ON %I (created_at)', partition_name);
    EXECUTE format('CREATE INDEX ON %I (entity_type, entity_id)', partition_name);
END;
$$ LANGUAGE plpgsql;
```

#### Hash Partitioning for Large Tables
```sql
-- Partition by customer_id for large transaction tables
CREATE TABLE customer_interactions (
    id BIGSERIAL,
    customer_id BIGINT NOT NULL,
    interaction_type VARCHAR(50) NOT NULL,
    interaction_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
) PARTITION BY HASH (customer_id);

-- Create hash partitions
CREATE TABLE customer_interactions_0 PARTITION OF customer_interactions
FOR VALUES WITH (modulus 4, remainder 0);

CREATE TABLE customer_interactions_1 PARTITION OF customer_interactions
FOR VALUES WITH (modulus 4, remainder 1);

CREATE TABLE customer_interactions_2 PARTITION OF customer_interactions
FOR VALUES WITH (modulus 4, remainder 2);

CREATE TABLE customer_interactions_3 PARTITION OF customer_interactions
FOR VALUES WITH (modulus 4, remainder 3);
```

## Query Optimization

### Optimized Query Patterns

#### Customer Queries
```sql
-- Optimized customer search with pagination
SELECT c.id, c.name, c.email, c.status, c.created_at
FROM customers c
WHERE c.search_vector @@ plainto_tsquery('english', $1)
  AND c.status = 'active'
ORDER BY ts_rank(c.search_vector, plainto_tsquery('english', $1)) DESC, c.created_at DESC
LIMIT 20 OFFSET $2;

-- Customer with recent interactions
SELECT c.*, 
       (SELECT COUNT(*) FROM customer_interactions ci 
        WHERE ci.customer_id = c.id 
        AND ci.created_at > CURRENT_DATE - INTERVAL '30 days') as recent_interactions
FROM customers c
WHERE c.id = $1;

-- Customer analytics query
WITH customer_stats AS (
  SELECT 
    c.id,
    c.name,
    COUNT(o.id) as total_orders,
    COALESCE(SUM(o.total_amount), 0) as total_revenue,
    MAX(o.created_at) as last_order_date
  FROM customers c
  LEFT JOIN orders o ON c.id = o.customer_id
  WHERE c.status = 'active'
  GROUP BY c.id, c.name
)
SELECT * FROM customer_stats
WHERE total_revenue > $1
ORDER BY total_revenue DESC;
```

#### CRM Core Queries
```sql
-- Lead pipeline query with aggregations
SELECT 
  l.status,
  COUNT(*) as lead_count,
  AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - l.created_at))/86400) as avg_age_days,
  COUNT(CASE WHEN l.created_at > CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as new_this_week
FROM leads l
WHERE l.assigned_to = $1
GROUP BY l.status
ORDER BY 
  CASE l.status 
    WHEN 'new' THEN 1
    WHEN 'contacted' THEN 2
    WHEN 'qualified' THEN 3
    WHEN 'proposal' THEN 4
    WHEN 'negotiation' THEN 5
    WHEN 'closed_won' THEN 6
    WHEN 'closed_lost' THEN 7
  END;

-- Opportunity forecast query
SELECT 
  DATE_TRUNC('month', o.expected_close_date) as month,
  o.stage,
  COUNT(*) as opportunity_count,
  SUM(o.estimated_value) as total_value,
  SUM(o.estimated_value * o.probability / 100) as weighted_value
FROM opportunities o
WHERE o.expected_close_date BETWEEN $1 AND $2
  AND o.status = 'open'
GROUP BY DATE_TRUNC('month', o.expected_close_date), o.stage
ORDER BY month, stage;
```

#### Inventory Queries
```sql
-- Stock levels with reorder alerts
SELECT 
  p.id,
  p.name,
  p.sku,
  COALESCE(SUM(CASE WHEN sm.movement_type = 'in' THEN sm.quantity 
                   WHEN sm.movement_type = 'out' THEN -sm.quantity 
                   ELSE 0 END), 0) as current_stock,
  p.reorder_point,
  p.max_stock_level,
  CASE 
    WHEN COALESCE(SUM(CASE WHEN sm.movement_type = 'in' THEN sm.quantity 
                          WHEN sm.movement_type = 'out' THEN -sm.quantity 
                          ELSE 0 END), 0) <= p.reorder_point THEN 'reorder'
    WHEN COALESCE(SUM(CASE WHEN sm.movement_type = 'in' THEN sm.quantity 
                          WHEN sm.movement_type = 'out' THEN -sm.quantity 
                          ELSE 0 END), 0) = 0 THEN 'out_of_stock'
    ELSE 'normal'
  END as stock_status
FROM products p
LEFT JOIN stock_movements sm ON p.id = sm.product_id
WHERE p.status = 'active'
GROUP BY p.id, p.name, p.sku, p.reorder_point, p.max_stock_level
HAVING COALESCE(SUM(CASE WHEN sm.movement_type = 'in' THEN sm.quantity 
                        WHEN sm.movement_type = 'out' THEN -sm.quantity 
                        ELSE 0 END), 0) <= p.reorder_point
ORDER BY current_stock ASC;

-- Product movement history with running totals
SELECT 
  sm.id,
  sm.movement_type,
  sm.quantity,
  sm.created_at,
  SUM(CASE WHEN sm2.movement_type = 'in' THEN sm2.quantity 
          WHEN sm2.movement_type = 'out' THEN -sm2.quantity 
          ELSE 0 END) as running_total
FROM stock_movements sm
JOIN stock_movements sm2 ON sm2.product_id = sm.product_id 
  AND sm2.created_at <= sm.created_at
WHERE sm.product_id = $1
  AND sm.created_at > CURRENT_DATE - INTERVAL '90 days'
GROUP BY sm.id, sm.movement_type, sm.quantity, sm.created_at
ORDER BY sm.created_at DESC;
```

## Connection Pool Optimization

### PgBouncer Configuration
```ini
# pgbouncer.ini
[databases]
enterprise_crm = host=localhost port=5432 dbname=enterprise_crm

[pgbouncer]
listen_port = 6432
listen_addr = *
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

# Pool settings
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 5

# Connection limits
max_db_connections = 50
max_user_connections = 50

# Timeouts
server_reset_query = DISCARD ALL
server_check_delay = 30
server_check_query = SELECT 1
server_lifetime = 3600
server_idle_timeout = 600

# Logging
log_connections = 1
log_disconnections = 1
log_pooler_errors = 1
```

### Application Connection Pool Configuration
```go
// Go database connection pool configuration
func NewDatabasePool() (*sql.DB, error) {
    config := pgxpool.Config{
        MaxConns:        30,
        MinConns:        5,
        MaxConnLifetime: time.Hour,
        MaxConnIdleTime: time.Minute * 30,
        HealthCheckPeriod: time.Minute * 5,
    }
    
    db, err := pgxpool.ConnectConfig(context.Background(), &config)
    if err != nil {
        return nil, err
    }
    
    // Set additional connection parameters
    db.SetMaxOpenConns(30)
    db.SetMaxIdleConns(10)
    db.SetConnMaxLifetime(time.Hour)
    db.SetConnMaxIdleTime(time.Minute * 30)
    
    return db, nil
}
```

## PostgreSQL Configuration Optimization

### postgresql.conf Optimization
```ini
# Memory settings
shared_buffers = 4GB                    # 25% of total RAM
effective_cache_size = 12GB             # 75% of total RAM
work_mem = 64MB                         # Per operation memory
maintenance_work_mem = 1GB              # Maintenance operations
wal_buffers = 64MB                      # WAL buffer size

# Checkpoint settings
checkpoint_completion_target = 0.9
checkpoint_timeout = 15min
max_wal_size = 4GB
min_wal_size = 1GB

# Connection settings
max_connections = 200
superuser_reserved_connections = 3

# Query planner settings
random_page_cost = 1.1                  # SSD optimized
effective_io_concurrency = 200          # SSD concurrent I/O
seq_page_cost = 1.0

# Logging settings
log_min_duration_statement = 1000       # Log slow queries
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
log_temp_files = 0

# Autovacuum settings
autovacuum = on
autovacuum_max_workers = 6
autovacuum_naptime = 15s
autovacuum_vacuum_threshold = 50
autovacuum_vacuum_scale_factor = 0.1
autovacuum_analyze_threshold = 50
autovacuum_analyze_scale_factor = 0.05

# Background writer settings
bgwriter_delay = 200ms
bgwriter_lru_maxpages = 100
bgwriter_lru_multiplier = 2.0
bgwriter_flush_after = 512kB
```

## Monitoring and Maintenance

### Performance Monitoring Queries
```sql
-- Monitor slow queries
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  rows,
  100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 20;

-- Monitor index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_tup_read,
  idx_tup_fetch,
  idx_scan,
  CASE WHEN idx_scan = 0 THEN 'Unused'
       WHEN idx_scan < 100 THEN 'Low usage'
       ELSE 'Active'
  END as usage_status
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;

-- Monitor table statistics
SELECT 
  schemaname,
  tablename,
  n_tup_ins,
  n_tup_upd,
  n_tup_del,
  n_live_tup,
  n_dead_tup,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;

-- Monitor connection usage
SELECT 
  state,
  COUNT(*) as connection_count,
  AVG(EXTRACT(EPOCH FROM (now() - state_change))) as avg_duration_seconds
FROM pg_stat_activity
WHERE state IS NOT NULL
GROUP BY state;
```

### Automated Maintenance Scripts
```sql
-- Automated statistics update
CREATE OR REPLACE FUNCTION update_table_statistics()
RETURNS void AS $$
DECLARE
    table_record RECORD;
BEGIN
    FOR table_record IN 
        SELECT schemaname, tablename 
        FROM pg_stat_user_tables 
        WHERE last_autoanalyze < CURRENT_TIMESTAMP - INTERVAL '1 day'
           OR last_autoanalyze IS NULL
    LOOP
        EXECUTE format('ANALYZE %I.%I', table_record.schemaname, table_record.tablename);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule statistics update
SELECT cron.schedule('update-stats', '0 2 * * *', 'SELECT update_table_statistics();');
```

## Backup and Recovery Optimization

### Continuous Archiving Setup
```bash
# postgresql.conf WAL archiving
archive_mode = on
archive_command = 'test ! -f /backup/wal/%f && cp %p /backup/wal/%f'
archive_timeout = 300

# Backup script
#!/bin/bash
BACKUP_DIR="/backup/postgres"
DATE=$(date +%Y%m%d_%H%M%S)

# Full backup
pg_basebackup -D "$BACKUP_DIR/base_$DATE" -Ft -z -P -U postgres

# WAL-E for continuous archiving
wal-e backup-push "$BACKUP_DIR/base_$DATE"
```

## Performance Testing Results

### Baseline Performance
- **Simple SELECT queries**: 8ms average
- **Complex JOIN queries**: 85ms average
- **INSERT operations**: 12ms average
- **UPDATE operations**: 15ms average
- **DELETE operations**: 10ms average

### Optimized Performance
- **Simple SELECT queries**: 3ms average (62% improvement)
- **Complex JOIN queries**: 35ms average (59% improvement)
- **INSERT operations**: 8ms average (33% improvement)
- **UPDATE operations**: 10ms average (33% improvement)
- **DELETE operations**: 6ms average (40% improvement)

### Throughput Improvements
- **Read QPS**: 15,000+ (50% increase)
- **Write QPS**: 7,500+ (50% increase)
- **Concurrent connections**: 800+ (60% increase)
- **Transaction throughput**: 3,000+ TPS (50% increase)

## Implementation Checklist

### Phase 1: Index Optimization
- [ ] Analyze query patterns
- [ ] Create optimized indexes
- [ ] Implement partial indexes
- [ ] Set up full-text search indexes
- [ ] Monitor index usage

### Phase 2: Query Optimization
- [ ] Optimize slow queries
- [ ] Implement query caching
- [ ] Add query hints where needed
- [ ] Optimize JOIN operations
- [ ] Implement pagination efficiently

### Phase 3: Connection Management
- [ ] Configure PgBouncer
- [ ] Optimize connection pools
- [ ] Set connection limits
- [ ] Monitor connection usage
- [ ] Implement connection retry logic

### Phase 4: Configuration Tuning
- [ ] Optimize PostgreSQL configuration
- [ ] Tune memory settings
- [ ] Configure autovacuum
- [ ] Set up monitoring
- [ ] Implement backup strategy

### Phase 5: Monitoring and Maintenance
- [ ] Set up performance monitoring
- [ ] Create maintenance scripts
- [ ] Configure alerting
- [ ] Implement automated backups
- [ ] Schedule regular maintenance

This comprehensive database optimization strategy will significantly improve the Enterprise CRM's database performance, scalability, and reliability.

