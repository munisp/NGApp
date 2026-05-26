-- ══════════════════════════════════════════════════════════════════════════════
-- Rollback Migration 0022: Platform Improvements
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── Drop new tables ─────────────────────────────────────────────────────────
DROP TABLE IF EXISTS data_quality_violations;
DROP TABLE IF EXISTS data_quality_rules;
DROP TABLE IF EXISTS feature_flags;
DROP TABLE IF EXISTS idempotency_keys;

-- ─── Drop soft delete columns ────────────────────────────────────────────────
ALTER TABLE wells DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE alarms DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE devices DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE workovers DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE permits DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE financial_entries DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE hse_incidents DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE damage_assessments DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE repair_tickets DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE regulatory_reports DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE calibration_records DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE sil_assessments DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE cmms_work_orders DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE production_forecasts DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE drone_inspections DROP COLUMN IF EXISTS deleted_at;

-- ─── Drop partial indexes for soft delete ────────────────────────────────────
DROP INDEX IF EXISTS idx_wells_active;
DROP INDEX IF EXISTS idx_alarms_active;
DROP INDEX IF EXISTS idx_devices_active;
DROP INDEX IF EXISTS idx_workovers_active;

-- Note: Performance indexes are not dropped as they are non-destructive.
-- To fully rollback indexes, uncomment the following (not recommended):
-- DROP INDEX IF EXISTS idx_telemetry_well_id;
-- ... (all index drops)
