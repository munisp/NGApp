-- PostgreSQL Initialization Script for Payment Switch Platform
-- Creates databases for all services: main app, Keycloak, and Permify

-- Create databases
CREATE DATABASE payment_switch_portal;
CREATE DATABASE keycloak;
CREATE DATABASE permify;

-- Create user for application access
CREATE USER payment_user WITH PASSWORD 'payment_pass_2024';

-- Grant privileges on payment_switch_portal
GRANT ALL PRIVILEGES ON DATABASE payment_switch_portal TO payment_user;

-- Grant privileges on keycloak
GRANT ALL PRIVILEGES ON DATABASE keycloak TO payment_user;

-- Grant privileges on permify
GRANT ALL PRIVILEGES ON DATABASE permify TO payment_user;

-- Connect to payment_switch_portal and set up schema
\c payment_switch_portal

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO payment_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO payment_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO payment_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO payment_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO payment_user;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Connect to keycloak and set up schema
\c keycloak

GRANT ALL ON SCHEMA public TO payment_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO payment_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO payment_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO payment_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO payment_user;

-- Connect to permify and set up schema
\c permify

GRANT ALL ON SCHEMA public TO payment_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO payment_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO payment_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO payment_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO payment_user;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
