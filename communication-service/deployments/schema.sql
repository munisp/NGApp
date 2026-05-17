-- Communication Service Database Schema

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(255) PRIMARY KEY,
    channel VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    template_id VARCHAR(255),
    media_url TEXT,
    status VARCHAR(50) NOT NULL,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    failed_at TIMESTAMP,
    error_msg TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_recipient ON messages(recipient);
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_channel ON messages(channel);

-- Templates table
CREATE TABLE IF NOT EXISTS templates (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    content TEXT NOT NULL,
    variables TEXT NOT NULL DEFAULT '[]',
    category VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(name, channel)
);

CREATE INDEX idx_templates_channel ON templates(channel);
CREATE INDEX idx_templates_category ON templates(category);

-- Inbound messages table
CREATE TABLE IF NOT EXISTS inbound_messages (
    id VARCHAR(255) PRIMARY KEY,
    channel VARCHAR(50) NOT NULL,
    sender VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    media_url TEXT,
    metadata JSONB,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inbound_messages_sender ON inbound_messages(sender);
CREATE INDEX idx_inbound_messages_processed ON inbound_messages(processed);
CREATE INDEX idx_inbound_messages_created_at ON inbound_messages(created_at);

-- Message delivery logs table
CREATE TABLE IF NOT EXISTS message_delivery_logs (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(255) NOT NULL REFERENCES messages(id),
    status VARCHAR(50) NOT NULL,
    external_id VARCHAR(255),
    error_msg TEXT,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_delivery_logs_message_id ON message_delivery_logs(message_id);
CREATE INDEX idx_delivery_logs_created_at ON message_delivery_logs(created_at);

-- USSD sessions table (backup, primary storage is Redis)
CREATE TABLE IF NOT EXISTS ussd_sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    phone_number VARCHAR(50) NOT NULL,
    current_menu VARCHAR(100) NOT NULL,
    state JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_ussd_sessions_phone ON ussd_sessions(phone_number);
CREATE INDEX idx_ussd_sessions_expires_at ON ussd_sessions(expires_at);

-- USSD transaction logs table
CREATE TABLE IF NOT EXISTS ussd_transaction_logs (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    menu_id VARCHAR(100) NOT NULL,
    user_input TEXT,
    response TEXT,
    action VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ussd_logs_session_id ON ussd_transaction_logs(session_id);
CREATE INDEX idx_ussd_logs_phone ON ussd_transaction_logs(phone_number);
CREATE INDEX idx_ussd_logs_created_at ON ussd_transaction_logs(created_at);

-- Notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
    customer_id VARCHAR(255) PRIMARY KEY,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    whatsapp_enabled BOOLEAN DEFAULT TRUE,
    sms_enabled BOOLEAN DEFAULT TRUE,
    telegram_enabled BOOLEAN DEFAULT FALSE,
    telegram_chat_id VARCHAR(255),
    preferred_channel VARCHAR(50) DEFAULT 'sms',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_prefs_phone ON notification_preferences(phone);

-- Message statistics table
CREATE TABLE IF NOT EXISTS message_statistics (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    channel VARCHAR(50) NOT NULL,
    total_sent INTEGER DEFAULT 0,
    total_delivered INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(date, channel)
);

CREATE INDEX idx_message_stats_date ON message_statistics(date);
CREATE INDEX idx_message_stats_channel ON message_statistics(channel);
