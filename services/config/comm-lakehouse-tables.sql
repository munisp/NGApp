-- Communication Channel Analytics Tables

-- WhatsApp Messages
CREATE TABLE IF NOT EXISTS lakehouse.comm.whatsapp_messages (
    message_id VARCHAR,
    phone_number VARCHAR,
    message_type VARCHAR,
    direction VARCHAR,
    status VARCHAR,
    template_name VARCHAR,
    conversation_id VARCHAR,
    created_at TIMESTAMP,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    error_message VARCHAR
);

-- WhatsApp Conversations
CREATE TABLE IF NOT EXISTS lakehouse.comm.whatsapp_conversations (
    conversation_id VARCHAR,
    phone_number VARCHAR,
    user_id VARCHAR,
    started_at TIMESTAMP,
    last_message_at TIMESTAMP,
    message_count INTEGER,
    state VARCHAR,
    resolution VARCHAR
);

-- Telegram Users
CREATE TABLE IF NOT EXISTS lakehouse.comm.telegram_users (
    user_id BIGINT,
    username VARCHAR,
    first_name VARCHAR,
    last_name VARCHAR,
    linked_account_id VARCHAR,
    first_interaction TIMESTAMP,
    last_interaction TIMESTAMP,
    total_messages INTEGER,
    language_code VARCHAR
);

-- Telegram Sessions
CREATE TABLE IF NOT EXISTS lakehouse.comm.telegram_sessions (
    session_id VARCHAR,
    chat_id BIGINT,
    user_id BIGINT,
    state VARCHAR,
    flow_type VARCHAR,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    outcome VARCHAR
);

-- USSD Sessions
CREATE TABLE IF NOT EXISTS lakehouse.comm.ussd_sessions (
    session_id VARCHAR,
    phone_number VARCHAR,
    service_code VARCHAR,
    network_code VARCHAR,
    state VARCHAR,
    level INTEGER,
    created_at TIMESTAMP,
    last_activity TIMESTAMP,
    duration_seconds DOUBLE,
    outcome VARCHAR
);

-- USSD Transactions (transfers, airtime, bills via USSD)
CREATE TABLE IF NOT EXISTS lakehouse.comm.ussd_transactions (
    transaction_id VARCHAR,
    session_id VARCHAR,
    phone_number VARCHAR,
    transaction_type VARCHAR,
    amount DOUBLE,
    currency VARCHAR,
    recipient VARCHAR,
    status VARCHAR,
    created_at TIMESTAMP
);

-- SMS Messages
CREATE TABLE IF NOT EXISTS lakehouse.comm.sms_messages (
    message_id VARCHAR,
    phone_number VARCHAR,
    direction VARCHAR,
    provider VARCHAR,
    template_id VARCHAR,
    status VARCHAR,
    segment_count INTEGER,
    created_at TIMESTAMP,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    error_message VARCHAR,
    user_id VARCHAR
);

-- SMS Campaigns (bulk sends)
CREATE TABLE IF NOT EXISTS lakehouse.comm.sms_campaigns (
    campaign_id VARCHAR,
    template_id VARCHAR,
    total_recipients INTEGER,
    sent_count INTEGER,
    delivered_count INTEGER,
    failed_count INTEGER,
    provider VARCHAR,
    created_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Channel Analytics Summary (daily aggregation)
CREATE TABLE IF NOT EXISTS lakehouse.comm.channel_analytics_daily (
    date DATE,
    channel VARCHAR,
    total_messages INTEGER,
    inbound_messages INTEGER,
    outbound_messages INTEGER,
    unique_users INTEGER,
    active_sessions INTEGER,
    avg_response_time_ms DOUBLE,
    delivery_rate DOUBLE,
    error_rate DOUBLE
);

-- Prebuilt analytics views
-- View: channel_usage_summary
-- SELECT channel, date, SUM(total_messages) as messages, COUNT(DISTINCT unique_users) as users
-- FROM lakehouse.comm.channel_analytics_daily GROUP BY channel, date ORDER BY date DESC;

-- View: delivery_performance
-- SELECT channel, provider, AVG(delivery_rate) as avg_delivery, AVG(error_rate) as avg_error
-- FROM lakehouse.comm.channel_analytics_daily GROUP BY channel, provider;

-- View: top_templates
-- SELECT template_id, COUNT(*) as usage_count, AVG(CASE WHEN status='delivered' THEN 1.0 ELSE 0.0 END) as delivery_rate
-- FROM lakehouse.comm.sms_messages WHERE template_id IS NOT NULL GROUP BY template_id ORDER BY usage_count DESC;

-- View: ussd_funnel
-- SELECT state, COUNT(*) as sessions, AVG(duration_seconds) as avg_duration
-- FROM lakehouse.comm.ussd_sessions GROUP BY state ORDER BY sessions DESC;
