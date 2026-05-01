import mysql from "mysql2/promise";
const url = process.env.DATABASE_URL;
const conn = await mysql.createConnection(url);
const now = Date.now();

const sqls = [
  [`CREATE TABLE IF NOT EXISTS dashboard_widget_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    layout JSON NOT NULL,
    widgets JSON NOT NULL,
    theme VARCHAR(20) NOT NULL DEFAULT 'default',
    created_at BIGINT NOT NULL DEFAULT 0,
    updated_at BIGINT NOT NULL DEFAULT 0,
    INDEX idx_user_id (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`, "dashboard_widget_configs"],

  [`CREATE TABLE IF NOT EXISTS support_chat_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    session_token VARCHAR(64) NOT NULL,
    status ENUM('active','resolved','escalated','closed') NOT NULL DEFAULT 'active',
    subject VARCHAR(255),
    category ENUM('technical','compliance','billing','general','urgent') NOT NULL DEFAULT 'general',
    priority ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
    assigned_to VARCHAR(100),
    ticket_number VARCHAR(20),
    resolved_at BIGINT,
    created_at BIGINT NOT NULL DEFAULT 0,
    updated_at BIGINT NOT NULL DEFAULT 0,
    UNIQUE KEY uniq_token (session_token),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`, "support_chat_sessions"],

  [`CREATE TABLE IF NOT EXISTS support_chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    role ENUM('user','assistant','system','agent') NOT NULL DEFAULT 'user',
    content TEXT NOT NULL,
    metadata JSON,
    created_at BIGINT NOT NULL DEFAULT 0,
    INDEX idx_session_id (session_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`, "support_chat_messages"],

  [`CREATE TABLE IF NOT EXISTS tutorial_progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    tutorial_id VARCHAR(50) NOT NULL,
    step_id VARCHAR(50) NOT NULL,
    completed TINYINT(1) NOT NULL DEFAULT 0,
    completed_at BIGINT,
    created_at BIGINT NOT NULL DEFAULT 0,
    UNIQUE KEY uniq_user_tut_step (user_id, tutorial_id, step_id),
    INDEX idx_user_id (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`, "tutorial_progress"],

  [`CREATE TABLE IF NOT EXISTS help_article_views (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    article_id VARCHAR(100) NOT NULL,
    viewed_at BIGINT NOT NULL DEFAULT 0,
    INDEX idx_article_id (article_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`, "help_article_views"]
];

for (const [sql, name] of sqls) {
  try { await conn.execute(sql); console.log("✅ Created:", name); }
  catch(e) { console.error("❌ Failed:", name, "-", e.message); }
}

// Seed widget config
try {
  await conn.execute(
    `INSERT IGNORE INTO dashboard_widget_configs (user_id, layout, widgets, theme, created_at, updated_at) VALUES (?,?,?,?,?,?)`,
    [1, '[]', JSON.stringify(["breach_count","compliance_score","pending_dsar","active_cases","sector_breakdown","risk_heatmap","deadline_countdown","recent_alerts","cert_status","nip_volume","fine_total","org_count"]), 'default', now, now]
  );
  console.log("✅ Seeded: widget_configs");
} catch(e) { console.error("❌", e.message); }

// Seed chat sessions
for (const [uid, tok, stat, subj, cat, pri, tkt] of [
  [1,'demo-session-001','resolved','How to submit a DSAR request','compliance','low','TKT-2026-001'],
  [1,'demo-session-002','active','Breach notification deadline clarification','compliance','high','TKT-2026-002'],
  [2,'demo-session-003','resolved','Certificate renewal process','technical','medium','TKT-2026-003']
]) {
  try {
    await conn.execute(
      `INSERT IGNORE INTO support_chat_sessions (user_id,session_token,status,subject,category,priority,ticket_number,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,
      [uid,tok,stat,subj,cat,pri,tkt,now,now]
    );
  } catch(e) { console.error("❌ session seed:", e.message); }
}
console.log("✅ Seeded: chat_sessions");

// Seed chat messages
const msgs = [
  [1,'user','How do I submit a DSAR request on behalf of a data subject?'],
  [1,'assistant','To submit a DSAR, navigate to /dsar-portal. Select "Submit on behalf of" and provide their NIN or BVN. The organisation has 30 days to respond under NDPA Section 35.'],
  [1,'user','Thank you, that was very helpful!'],
  [1,'assistant','You are welcome! Is there anything else I can help you with?'],
  [2,'user','We detected a breach 48 hours ago. Do we still have time to notify NDPC?'],
  [2,'assistant','Yes, you still have 24 hours remaining. Under NDPA Article 40, you must notify the NDPC within 72 hours. Go to /article-40-tracker to send the notification.']
];
for (const [sid,role,content] of msgs) {
  try { await conn.execute(`INSERT IGNORE INTO support_chat_messages (session_id,role,content,created_at) VALUES (?,?,?,?)`, [sid,role,content,now]); }
  catch(e) { console.error("❌ msg seed:", e.message); }
}
console.log("✅ Seeded: chat_messages");

// Seed tutorial progress
const tuts = [
  [1,'getting-started','welcome',1,now],
  [1,'getting-started','dashboard-tour',1,now],
  [1,'getting-started','first-org',1,now],
  [1,'getting-started','breach-workflow',0,null],
  [1,'ndpa-compliance','article-40',0,null],
  [1,'dpco-certification','apply',0,null]
];
for (const [uid,tid,sid,comp,cat] of tuts) {
  try { await conn.execute(`INSERT IGNORE INTO tutorial_progress (user_id,tutorial_id,step_id,completed,completed_at,created_at) VALUES (?,?,?,?,?,?)`, [uid,tid,sid,comp,cat,now]); }
  catch(e) { console.error("❌ tut seed:", e.message); }
}
console.log("✅ Seeded: tutorial_progress");

await conn.end();
console.log("\n✅ Phase 5 tables done");
