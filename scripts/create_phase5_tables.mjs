import mysql from "mysql2/promise";
const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }
const conn = await mysql.createConnection(url);

const tables = [
  // Widget dashboard preferences
  `CREATE TABLE IF NOT EXISTS dashboard_widget_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    layout JSON NOT NULL COMMENT 'Array of widget positions and sizes',
    widgets JSON NOT NULL COMMENT 'Array of enabled widget IDs with config',
    theme VARCHAR(20) NOT NULL DEFAULT 'default',
    created_at BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()*1000),
    updated_at BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()*1000),
    INDEX idx_user_id (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Chat support sessions
  `CREATE TABLE IF NOT EXISTS support_chat_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    session_token VARCHAR(64) NOT NULL UNIQUE,
    status ENUM('active','resolved','escalated','closed') NOT NULL DEFAULT 'active',
    subject VARCHAR(255),
    category ENUM('technical','compliance','billing','general','urgent') NOT NULL DEFAULT 'general',
    priority ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
    assigned_to VARCHAR(100),
    ticket_number VARCHAR(20) UNIQUE,
    resolved_at BIGINT,
    created_at BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()*1000),
    updated_at BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()*1000),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_ticket_number (ticket_number)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Chat messages
  `CREATE TABLE IF NOT EXISTS support_chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    role ENUM('user','assistant','system','agent') NOT NULL DEFAULT 'user',
    content TEXT NOT NULL,
    metadata JSON COMMENT 'Extra data: suggested_actions, attachments, etc.',
    created_at BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()*1000),
    INDEX idx_session_id (session_id),
    INDEX idx_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Tutorial progress
  `CREATE TABLE IF NOT EXISTS tutorial_progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    tutorial_id VARCHAR(50) NOT NULL,
    step_id VARCHAR(50) NOT NULL,
    completed TINYINT(1) NOT NULL DEFAULT 0,
    completed_at BIGINT,
    created_at BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()*1000),
    UNIQUE KEY uniq_user_tutorial_step (user_id, tutorial_id, step_id),
    INDEX idx_user_id (user_id),
    INDEX idx_tutorial_id (tutorial_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Help article views (for analytics)
  `CREATE TABLE IF NOT EXISTS help_article_views (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    article_id VARCHAR(100) NOT NULL,
    viewed_at BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()*1000),
    INDEX idx_article_id (article_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
];

for (const sql of tables) {
  const name = sql.match(/TABLE IF NOT EXISTS (\w+)/)?.[1];
  try {
    await conn.execute(sql);
    console.log(`✅ Created: ${name}`);
  } catch (e) {
    console.error(`❌ Failed: ${name} — ${e.message}`);
  }
}

// Seed some demo widget configs
await conn.execute(`INSERT IGNORE INTO dashboard_widget_configs (user_id, layout, widgets, theme) VALUES
  (1, '[]', '["breach_count","compliance_score","pending_dsar","active_cases","sector_breakdown","risk_heatmap","deadline_countdown","recent_alerts","cert_status","nip_volume","fine_total","org_count"]', 'default')`);

// Seed demo chat sessions
await conn.execute(`INSERT IGNORE INTO support_chat_sessions (user_id, session_token, status, subject, category, priority, ticket_number) VALUES
  (1, 'demo-session-001', 'resolved', 'How to submit a DSAR request', 'compliance', 'low', 'TKT-2026-001'),
  (1, 'demo-session-002', 'active', 'Breach notification deadline clarification', 'compliance', 'high', 'TKT-2026-002'),
  (2, 'demo-session-003', 'resolved', 'Certificate renewal process', 'technical', 'medium', 'TKT-2026-003')`);

// Seed demo chat messages
await conn.execute(`INSERT IGNORE INTO support_chat_messages (session_id, role, content) VALUES
  (1, 'user', 'How do I submit a DSAR request on behalf of a data subject?'),
  (1, 'assistant', 'To submit a Data Subject Access Request (DSAR), navigate to the DSAR Public Portal at /dsar-portal. You can submit on behalf of a data subject by selecting "Submit on behalf of" and providing their NIN or BVN for identity verification. The organisation has 30 days to respond under NDPA Section 35.'),
  (1, 'user', 'Thank you, that was very helpful!'),
  (1, 'assistant', 'You are welcome! Is there anything else I can help you with?'),
  (2, 'user', 'We detected a breach 48 hours ago. Do we still have time to notify NDPC?'),
  (2, 'assistant', 'Yes, you still have 24 hours remaining. Under NDPA Article 40, you must notify the NDPC within 72 hours of becoming aware of a personal data breach. Please go to /breach-incidents to log the incident and use the Article 40 Tracker at /article-40-tracker to send the notification. I can help you draft the notification if needed.')`);

// Seed tutorial progress
await conn.execute(`INSERT IGNORE INTO tutorial_progress (user_id, tutorial_id, step_id, completed, completed_at) VALUES
  (1, 'getting-started', 'welcome', 1, UNIX_TIMESTAMP()*1000),
  (1, 'getting-started', 'dashboard-tour', 1, UNIX_TIMESTAMP()*1000),
  (1, 'getting-started', 'first-org', 1, UNIX_TIMESTAMP()*1000),
  (1, 'getting-started', 'breach-workflow', 0, NULL),
  (1, 'ndpa-compliance', 'article-40', 0, NULL),
  (1, 'dpco-certification', 'apply', 0, NULL)`);

await conn.end();
console.log("\n✅ Phase 5 tables created and seeded");
