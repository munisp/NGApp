//! Database store for security operations.

use sqlx::PgPool;
use tracing;

pub struct SecurityStore {
    pool: PgPool,
}

impl SecurityStore {
    pub async fn new(database_url: &str) -> Result<Self, sqlx::Error> {
        let pool = PgPool::connect(database_url).await?;

        // Run migrations
        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS security_incidents (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title VARCHAR(500) NOT NULL,
                severity VARCHAR(20) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'open',
                category VARCHAR(100),
                description TEXT,
                affected_systems TEXT[],
                source_ip VARCHAR(50),
                mitre_attack_ids TEXT[],
                assigned_to VARCHAR(255),
                detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                acknowledged_at TIMESTAMPTZ,
                resolved_at TIMESTAMPTZ,
                resolution_notes TEXT,
                naicom_notified BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS security_vulnerabilities (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                cve_id VARCHAR(50),
                title VARCHAR(500) NOT NULL,
                severity VARCHAR(20) NOT NULL,
                affected_component VARCHAR(255),
                description TEXT,
                remediation TEXT,
                status VARCHAR(20) DEFAULT 'open',
                discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                remediated_at TIMESTAMPTZ,
                scan_source VARCHAR(100)
            );

            CREATE TABLE IF NOT EXISTS security_pentest_schedule (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                test_type VARCHAR(100) NOT NULL,
                scope TEXT,
                scheduled_date DATE NOT NULL,
                status VARCHAR(20) DEFAULT 'scheduled',
                vendor VARCHAR(255),
                findings_count INT DEFAULT 0,
                report_url TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS security_compliance_controls (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                framework VARCHAR(50) NOT NULL,
                control_id VARCHAR(50) NOT NULL,
                title VARCHAR(500) NOT NULL,
                description TEXT,
                status VARCHAR(20) DEFAULT 'not_implemented',
                evidence TEXT,
                last_assessed TIMESTAMPTZ,
                UNIQUE(framework, control_id)
            );

            CREATE INDEX IF NOT EXISTS idx_incidents_status ON security_incidents(status, severity);
            CREATE INDEX IF NOT EXISTS idx_vulnerabilities_severity ON security_vulnerabilities(severity, status);
            CREATE INDEX IF NOT EXISTS idx_compliance_framework ON security_compliance_controls(framework, status);
        "#)
        .execute(&pool)
        .await?;

        tracing::info!("Security operations database initialized");
        Ok(Self { pool })
    }

    pub fn pool(&self) -> &PgPool {
        &self.pool
    }
}
