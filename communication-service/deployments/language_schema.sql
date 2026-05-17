-- Language Support Database Schema

-- Language preferences table
CREATE TABLE IF NOT EXISTS language_preferences (
    customer_id VARCHAR(255) PRIMARY KEY,
    phone VARCHAR(50) NOT NULL,
    preferred_language VARCHAR(10) NOT NULL DEFAULT 'en',
    detected_language VARCHAR(10),
    auto_detect BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX idx_language_prefs_phone ON language_preferences(phone);
CREATE INDEX idx_language_prefs_language ON language_preferences(preferred_language);

-- Language usage statistics table
CREATE TABLE IF NOT EXISTS language_usage_stats (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    language VARCHAR(10) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    message_count INTEGER DEFAULT 0,
    ussd_session_count INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(date, language, channel)
);

CREATE INDEX idx_language_stats_date ON language_usage_stats(date);
CREATE INDEX idx_language_stats_language ON language_usage_stats(language);

-- Language detection logs table (for ML training)
CREATE TABLE IF NOT EXISTS language_detection_logs (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(50) NOT NULL,
    text_sample TEXT NOT NULL,
    detected_language VARCHAR(10) NOT NULL,
    confidence FLOAT NOT NULL,
    actual_language VARCHAR(10),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_language_detection_phone ON language_detection_logs(phone);
CREATE INDEX idx_language_detection_created_at ON language_detection_logs(created_at);

-- Insert default language preferences for existing customers
INSERT INTO language_preferences (customer_id, phone, preferred_language, auto_detect, created_at, updated_at)
SELECT id, phone, 'en', true, NOW(), NOW()
FROM customers
WHERE NOT EXISTS (
    SELECT 1 FROM language_preferences WHERE customer_id = customers.id
);

-- Create function to update language usage stats
CREATE OR REPLACE FUNCTION update_language_usage_stats()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO language_usage_stats (date, language, channel, message_count, created_at)
    VALUES (CURRENT_DATE, 
            COALESCE((SELECT preferred_language FROM language_preferences WHERE phone = NEW.recipient), 'en'),
            NEW.channel,
            1,
            NOW())
    ON CONFLICT (date, language, channel)
    DO UPDATE SET message_count = language_usage_stats.message_count + 1;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update language usage stats
CREATE TRIGGER trigger_update_language_stats
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_language_usage_stats();
