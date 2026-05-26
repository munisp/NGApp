-- TDengine Schema Initialization — Oil & Gas Telemetry
-- Spec: FRQ-009 — High-frequency sensor time-series storage
-- Run via: taos -f /etc/taos/init.sql

-- Create database with 90-day hot / 365-day warm / 5-year cold retention
CREATE DATABASE IF NOT EXISTS og_telemetry
  KEEP 90,365,1825
  DURATION 10
  BUFFER 256
  MINROWS 100
  MAXROWS 4096
  COMP 2
  PRECISION 'ms'
  REPLICA 1
  WAL_LEVEL 2
  WAL_FSYNC_PERIOD 3000;

USE og_telemetry;

-- Super table for well sensor readings (one sub-table per sensor per well)
CREATE STABLE IF NOT EXISTS sensor_readings (
  ts          TIMESTAMP,
  value       DOUBLE,
  quality     TINYINT COMMENT '0=BAD 1=UNCERTAIN 2=GOOD',
  raw_value   FLOAT
) TAGS (
  well_id     NCHAR(32),
  sensor_id   NCHAR(64),
  sensor_type NCHAR(32),
  unit        NCHAR(16),
  field       NCHAR(64)
);

-- Super table for production daily summaries
CREATE STABLE IF NOT EXISTS production_daily (
  ts              TIMESTAMP,
  oil_bbls        DOUBLE,
  gas_mmscf       DOUBLE,
  water_bbls      DOUBLE,
  injection_bbls  DOUBLE,
  uptime_hours    FLOAT,
  downtime_hours  FLOAT
) TAGS (
  well_id   NCHAR(32),
  field     NCHAR(64),
  operator  NCHAR(64)
);

-- Super table for alarm events (time-indexed for fast range queries)
CREATE STABLE IF NOT EXISTS alarm_events (
  ts          TIMESTAMP,
  severity    TINYINT COMMENT '1=LOW 2=MEDIUM 3=HIGH 4=CRITICAL',
  value       DOUBLE,
  threshold   DOUBLE,
  message     NCHAR(256),
  acknowledged BOOL
) TAGS (
  well_id     NCHAR(32),
  alarm_type  NCHAR(32),
  sensor_id   NCHAR(64)
);

-- Continuous aggregation query — 1-minute rolling average per sensor
-- (TDengine continuous query equivalent)
CREATE TABLE IF NOT EXISTS sensor_1min_avg AS
  SELECT FIRST(ts), AVG(value), MAX(value), MIN(value), COUNT(value)
  FROM sensor_readings
  INTERVAL(1m) SLIDING(1m);

-- Create sample sub-tables for well W-001 pressure sensor
CREATE TABLE IF NOT EXISTS w001_pressure USING sensor_readings
  TAGS ('W-001', 'PRESS-W001-001', 'PRESSURE', 'psi', 'Permian Basin');

CREATE TABLE IF NOT EXISTS w001_temperature USING sensor_readings
  TAGS ('W-001', 'TEMP-W001-001', 'TEMPERATURE', 'degC', 'Permian Basin');

CREATE TABLE IF NOT EXISTS w001_flow_rate USING sensor_readings
  TAGS ('W-001', 'FLOW-W001-001', 'FLOW_RATE', 'bbl/d', 'Permian Basin');

-- Create user for platform access
CREATE USER IF NOT EXISTS og_platform PASS 'OG_Platform_2025!';
GRANT ALL ON og_telemetry.* TO og_platform;
