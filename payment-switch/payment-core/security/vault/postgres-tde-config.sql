-- PostgreSQL Transparent Data Encryption (TDE) Configuration
-- This script configures encryption at rest for the payment switch database

-- Enable pgcrypto extension for encryption functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create encryption key management table
CREATE TABLE IF NOT EXISTS encryption_keys (
    key_id SERIAL PRIMARY KEY,
    key_name VARCHAR(255) UNIQUE NOT NULL,
    encrypted_key BYTEA NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    rotated_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Function to encrypt sensitive data
CREATE OR REPLACE FUNCTION encrypt_data(data TEXT, key_name TEXT)
RETURNS BYTEA AS $$
DECLARE
    encryption_key BYTEA;
BEGIN
    SELECT encrypted_key INTO encryption_key
    FROM encryption_keys
    WHERE encryption_keys.key_name = $2 AND is_active = TRUE;
    
    IF encryption_key IS NULL THEN
        RAISE EXCEPTION 'Encryption key not found: %', key_name;
    END IF;
    
    RETURN pgp_sym_encrypt(data, encode(encryption_key, 'hex'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrypt sensitive data
CREATE OR REPLACE FUNCTION decrypt_data(encrypted_data BYTEA, key_name TEXT)
RETURNS TEXT AS $$
DECLARE
    encryption_key BYTEA;
BEGIN
    SELECT encrypted_key INTO encryption_key
    FROM encryption_keys
    WHERE encryption_keys.key_name = $2 AND is_active = TRUE;
    
    IF encryption_key IS NULL THEN
        RAISE EXCEPTION 'Encryption key not found: %', key_name;
    END IF;
    
    RETURN pgp_sym_decrypt(encrypted_data, encode(encryption_key, 'hex'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create encrypted columns for sensitive data
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS encrypted_card_number BYTEA;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS encrypted_cvv BYTEA;
ALTER TABLE users ADD COLUMN IF NOT EXISTS encrypted_ssn BYTEA;
ALTER TABLE users ADD COLUMN IF NOT EXISTS encrypted_account_number BYTEA;

-- Create audit log for encryption key operations
CREATE TABLE IF NOT EXISTS encryption_audit_log (
    audit_id SERIAL PRIMARY KEY,
    operation VARCHAR(50) NOT NULL,
    key_name VARCHAR(255) NOT NULL,
    performed_by VARCHAR(255),
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT
);

-- Trigger to log encryption key operations
CREATE OR REPLACE FUNCTION log_encryption_operation()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO encryption_audit_log (operation, key_name, performed_by)
    VALUES (TG_OP, NEW.key_name, current_user);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER encryption_key_audit
AFTER INSERT OR UPDATE OR DELETE ON encryption_keys
FOR EACH ROW EXECUTE FUNCTION log_encryption_operation();

-- Grant permissions
GRANT EXECUTE ON FUNCTION encrypt_data(TEXT, TEXT) TO payment_user;
GRANT EXECUTE ON FUNCTION decrypt_data(BYTEA, TEXT) TO payment_user;

COMMENT ON FUNCTION encrypt_data IS 'Encrypts sensitive data using AES-256';
COMMENT ON FUNCTION decrypt_data IS 'Decrypts sensitive data encrypted with encrypt_data';
