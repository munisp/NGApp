-- NGApp Platform Seed Data
-- Run with: psql -U ngapp -d ngapp -f seed.sql

-- Notification templates
INSERT INTO templates (name, channel, language, subject, body, vars, created_at, updated_at)
VALUES
  ('policy_created', 'sms', 'en', '', 'Your policy {{policy_id}} has been created. Premium: {{currency}}{{amount}}. Thank you for choosing NGApp!', '["policy_id","currency","amount"]', NOW(), NOW()),
  ('policy_created', 'email', 'en', 'Policy Created - {{policy_id}}', '<h1>Policy Created</h1><p>Your policy {{policy_id}} has been created with a premium of {{currency}}{{amount}}.</p>', '["policy_id","currency","amount"]', NOW(), NOW()),
  ('claim_submitted', 'sms', 'en', '', 'Your claim {{claim_id}} has been submitted and is under review. Track status at ngapp.io/claims.', '["claim_id"]', NOW(), NOW()),
  ('payout_completed', 'sms', 'en', '', 'Your payout of {{currency}}{{amount}} has been sent to {{channel}}. Reference: {{reference}}', '["currency","amount","channel","reference"]', NOW(), NOW()),
  ('kyc_verified', 'sms', 'en', '', 'Your identity has been verified successfully. You now have full access to NGApp services.', '[]', NOW(), NOW()),
  ('policy_created', 'sms', 'ha', '', 'An yi wa inshora ku {{policy_id}}. Kudin: {{currency}}{{amount}}. Mun gode!', '["policy_id","currency","amount"]', NOW(), NOW()),
  ('policy_created', 'sms', 'yo', '', 'Iwe ileri {{policy_id}} ti ṣẹda. Owo: {{currency}}{{amount}}. E ṣe pupo!', '["policy_id","currency","amount"]', NOW(), NOW()),
  ('policy_created', 'sms', 'ig', '', 'Iwu gị {{policy_id}} emepụtala. Ego: {{currency}}{{amount}}. Daalụ!', '["policy_id","currency","amount"]', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Default languages
INSERT INTO languages (code, name, native_name, direction, is_active, completion, created_at, updated_at)
VALUES
  ('en', 'English', 'English', 'ltr', true, 100.0, NOW(), NOW()),
  ('ha', 'Hausa', 'Hausa', 'ltr', true, 85.0, NOW(), NOW()),
  ('yo', 'Yoruba', 'Yorùbá', 'ltr', true, 82.0, NOW(), NOW()),
  ('ig', 'Igbo', 'Igbo', 'ltr', true, 78.0, NOW(), NOW()),
  ('pcm', 'Pidgin', 'Naija Pidgin', 'ltr', true, 70.0, NOW(), NOW()),
  ('sw', 'Swahili', 'Kiswahili', 'ltr', true, 65.0, NOW(), NOW()),
  ('fr', 'French', 'Français', 'ltr', true, 90.0, NOW(), NOW()),
  ('ar', 'Arabic', 'العربية', 'rtl', true, 60.0, NOW(), NOW()),
  ('zu', 'Zulu', 'isiZulu', 'ltr', true, 45.0, NOW(), NOW()),
  ('xh', 'Xhosa', 'isiXhosa', 'ltr', true, 40.0, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Default compliance rules
INSERT INTO compliance_rules (rule_id, country, regulator, category, name, description, requirement, threshold, frequency, penalty, is_active, effective_date, created_at, updated_at)
VALUES
  ('NG-NAICOM-CAP-001', 'NG', 'NAICOM', 'capital', 'Minimum Capital Requirement', 'Life insurance companies must maintain minimum capital', '{"min_capital": 8000000000, "currency": "NGN"}', '{"warning": 0.9, "critical": 0.8}', 'quarterly', 'License revocation', true, '2024-01-01', NOW(), NOW()),
  ('NG-NAICOM-SOL-001', 'NG', 'NAICOM', 'solvency', 'Solvency Margin', 'Maintain 150% solvency ratio', '{"min_ratio": 1.5}', '{"warning": 1.6, "critical": 1.5}', 'quarterly', 'Corrective action plan required', true, '2024-01-01', NOW(), NOW()),
  ('KE-IRA-CAP-001', 'KE', 'IRA', 'capital', 'Minimum Paid-Up Capital', 'General insurance minimum KES 600M', '{"min_capital": 600000000, "currency": "KES"}', '{"warning": 0.9, "critical": 0.8}', 'annual', 'License suspension', true, '2024-01-01', NOW(), NOW()),
  ('GH-NIC-REP-001', 'GH', 'NIC', 'reporting', 'Quarterly Returns', 'Submit financial returns within 30 days', '{"deadline_days": 30}', '{"warning": 25, "critical": 30}', 'quarterly', 'Fine of GHS 10,000 per day', true, '2024-01-01', NOW(), NOW()),
  ('ZA-FSCA-TCF-001', 'ZA', 'FSCA', 'conduct', 'Treating Customers Fairly', 'TCF outcomes monitoring', '{"outcomes": ["fair_treatment","suitable_products","clear_info","advice_quality","performance","complaints"]}', '{}', 'annual', 'Administrative penalty', true, '2024-01-01', NOW(), NOW())
ON CONFLICT DO NOTHING;
