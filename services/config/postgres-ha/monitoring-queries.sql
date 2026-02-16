-- Enable pg_stat_statements extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Top 20 slowest queries by mean execution time
CREATE OR REPLACE VIEW slow_queries AS
SELECT
    queryid,
    LEFT(query, 200) AS query_preview,
    calls,
    mean_exec_time AS avg_ms,
    total_exec_time AS total_ms,
    rows,
    shared_blks_hit,
    shared_blks_read,
    CASE WHEN shared_blks_hit + shared_blks_read > 0
        THEN ROUND(shared_blks_hit::numeric / (shared_blks_hit + shared_blks_read) * 100, 2)
        ELSE 0
    END AS cache_hit_pct
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Top queries by total time (cumulative impact)
CREATE OR REPLACE VIEW high_impact_queries AS
SELECT
    queryid,
    LEFT(query, 200) AS query_preview,
    calls,
    total_exec_time AS total_ms,
    mean_exec_time AS avg_ms,
    stddev_exec_time AS stddev_ms,
    rows
FROM pg_stat_statements
WHERE calls > 100
ORDER BY total_exec_time DESC
LIMIT 20;

-- Connection statistics
CREATE OR REPLACE VIEW connection_stats AS
SELECT
    datname,
    usename,
    state,
    COUNT(*) AS count,
    MAX(EXTRACT(EPOCH FROM (now() - state_change)))::int AS max_idle_seconds
FROM pg_stat_activity
WHERE pid <> pg_backend_pid()
GROUP BY datname, usename, state
ORDER BY count DESC;

-- Replication lag monitoring
CREATE OR REPLACE VIEW replication_status AS
SELECT
    client_addr,
    state,
    sent_lsn,
    write_lsn,
    flush_lsn,
    replay_lsn,
    pg_wal_lsn_diff(sent_lsn, replay_lsn) AS replay_lag_bytes,
    pg_wal_lsn_diff(sent_lsn, write_lsn) AS write_lag_bytes
FROM pg_stat_replication;

-- Table bloat estimation
CREATE OR REPLACE VIEW table_bloat AS
SELECT
    schemaname,
    relname AS table_name,
    n_live_tup AS live_tuples,
    n_dead_tup AS dead_tuples,
    CASE WHEN n_live_tup > 0
        THEN ROUND(n_dead_tup::numeric / n_live_tup * 100, 2)
        ELSE 0
    END AS dead_pct,
    last_autovacuum,
    last_autoanalyze
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC
LIMIT 20;

-- Index usage statistics
CREATE OR REPLACE VIEW index_usage AS
SELECT
    schemaname,
    relname AS table_name,
    indexrelname AS index_name,
    idx_scan AS scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC
LIMIT 20;

-- Cache hit ratio per table
CREATE OR REPLACE VIEW table_cache_hits AS
SELECT
    relname AS table_name,
    heap_blks_hit,
    heap_blks_read,
    CASE WHEN heap_blks_hit + heap_blks_read > 0
        THEN ROUND(heap_blks_hit::numeric / (heap_blks_hit + heap_blks_read) * 100, 2)
        ELSE 0
    END AS cache_hit_pct
FROM pg_statio_user_tables
WHERE heap_blks_hit + heap_blks_read > 0
ORDER BY cache_hit_pct ASC
LIMIT 20;

-- Lock monitoring
CREATE OR REPLACE VIEW active_locks AS
SELECT
    pg_locks.pid,
    pg_stat_activity.usename,
    pg_locks.locktype,
    pg_locks.mode,
    pg_locks.granted,
    pg_stat_activity.query,
    pg_stat_activity.state,
    age(now(), pg_stat_activity.query_start) AS query_age
FROM pg_locks
JOIN pg_stat_activity ON pg_locks.pid = pg_stat_activity.pid
WHERE NOT pg_locks.granted
ORDER BY query_age DESC;

-- WAL generation rate
CREATE OR REPLACE VIEW wal_stats AS
SELECT
    pg_current_wal_lsn() AS current_lsn,
    pg_walfile_name(pg_current_wal_lsn()) AS current_wal_file,
    pg_size_pretty(
        pg_wal_lsn_diff(pg_current_wal_lsn(), '0/0')
    ) AS total_wal_generated;
