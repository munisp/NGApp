# Banking CRM Data Architecture for AI Telephony

## 🏦 **Comprehensive Banking Data Integration Strategy**

### **📊 Data Sources and Schema Design**

#### **1. Agent Banking/Network Data Sources**

##### **Agent Profile Data**
```json
{
  "agent_profile": {
    "agent_id": "string (UUID)",
    "agent_code": "string (unique identifier)",
    "agent_name": "string",
    "phone_number": "string (E.164 format)",
    "email": "string",
    "location": {
      "latitude": "decimal",
      "longitude": "decimal",
      "address": "string",
      "state": "string",
      "lga": "string",
      "ward": "string"
    },
    "territory": {
      "territory_id": "string",
      "territory_name": "string",
      "coverage_radius_km": "number"
    },
    "performance_metrics": {
      "monthly_transactions": "number",
      "monthly_volume": "decimal",
      "customer_acquisition_count": "number",
      "service_quality_score": "decimal (0-10)",
      "customer_satisfaction_rating": "decimal (0-5)",
      "compliance_score": "decimal (0-100)"
    },
    "capabilities": {
      "languages_spoken": ["english", "hausa", "yoruba", "igbo", "pidgin"],
      "specializations": ["account_opening", "loan_processing", "complaints", "kyc_verification"],
      "certifications": ["string array"],
      "training_completed": ["string array"]
    },
    "operational_status": {
      "status": "enum (active, inactive, suspended, training)",
      "working_hours": {
        "monday": {"start": "08:00", "end": "17:00"},
        "tuesday": {"start": "08:00", "end": "17:00"},
        "wednesday": {"start": "08:00", "end": "17:00"},
        "thursday": {"start": "08:00", "end": "17:00"},
        "friday": {"start": "08:00", "end": "17:00"},
        "saturday": {"start": "09:00", "end": "14:00"},
        "sunday": {"start": null, "end": null}
      },
      "last_active": "datetime",
      "device_info": {
        "device_id": "string",
        "device_type": "string",
        "app_version": "string",
        "os_version": "string"
      }
    },
    "financial_metrics": {
      "commission_earned": "decimal",
      "float_balance": "decimal",
      "transaction_limits": {
        "daily_limit": "decimal",
        "per_transaction_limit": "decimal"
      }
    }
  }
}
```

##### **Agent Transaction Data**
```json
{
  "agent_transaction": {
    "transaction_id": "string (UUID)",
    "agent_id": "string (UUID)",
    "customer_id": "string (UUID)",
    "transaction_type": "enum (deposit, withdrawal, transfer, bill_payment, airtime, data)",
    "amount": "decimal",
    "currency": "string (NGN)",
    "fee": "decimal",
    "commission": "decimal",
    "timestamp": "datetime (ISO 8601)",
    "location": {
      "latitude": "decimal",
      "longitude": "decimal",
      "accuracy": "number"
    },
    "status": "enum (pending, completed, failed, reversed)",
    "failure_reason": "string (nullable)",
    "reference_number": "string",
    "external_reference": "string (nullable)",
    "channel": "enum (agent_app, ussd, pos)",
    "device_info": {
      "device_id": "string",
      "imei": "string",
      "serial_number": "string"
    },
    "risk_score": "decimal (0-100)",
    "fraud_indicators": ["string array"],
    "compliance_flags": ["string array"]
  }
}
```

##### **Agent Customer Interaction Data**
```json
{
  "agent_customer_interaction": {
    "interaction_id": "string (UUID)",
    "agent_id": "string (UUID)",
    "customer_id": "string (UUID)",
    "interaction_type": "enum (account_opening, kyc_update, complaint, inquiry, transaction_support)",
    "channel": "enum (face_to_face, phone, whatsapp, sms)",
    "duration_minutes": "number",
    "language_used": "enum (english, hausa, yoruba, igbo, pidgin)",
    "outcome": "enum (resolved, escalated, pending, cancelled)",
    "satisfaction_rating": "decimal (1-5, nullable)",
    "notes": "text",
    "documents_collected": ["string array"],
    "follow_up_required": "boolean",
    "follow_up_date": "datetime (nullable)",
    "created_at": "datetime",
    "updated_at": "datetime"
  }
}
```

#### **2. NeoBank - All Digital Bank Data Sources**

##### **Digital Customer Profile**
```json
{
  "digital_customer": {
    "customer_id": "string (UUID)",
    "account_number": "string",
    "bvn": "string (11 digits)",
    "nin": "string (11 digits)",
    "personal_info": {
      "first_name": "string",
      "middle_name": "string (nullable)",
      "last_name": "string",
      "date_of_birth": "date",
      "gender": "enum (male, female, other)",
      "marital_status": "enum (single, married, divorced, widowed)",
      "nationality": "string",
      "state_of_origin": "string",
      "lga_of_origin": "string"
    },
    "contact_info": {
      "primary_phone": "string (E.164 format)",
      "secondary_phone": "string (nullable)",
      "email": "string",
      "preferred_language": "enum (english, hausa, yoruba, igbo)",
      "communication_preferences": {
        "sms": "boolean",
        "email": "boolean",
        "push_notifications": "boolean",
        "whatsapp": "boolean",
        "voice_calls": "boolean"
      }
    },
    "address_info": {
      "current_address": {
        "street": "string",
        "city": "string",
        "state": "string",
        "postal_code": "string",
        "country": "string",
        "coordinates": {
          "latitude": "decimal",
          "longitude": "decimal"
        }
      },
      "permanent_address": {
        "street": "string",
        "city": "string",
        "state": "string",
        "postal_code": "string",
        "country": "string"
      }
    },
    "employment_info": {
      "employment_status": "enum (employed, self_employed, unemployed, student, retired)",
      "employer_name": "string (nullable)",
      "job_title": "string (nullable)",
      "industry": "string (nullable)",
      "monthly_income": "decimal (nullable)",
      "income_source": "string (nullable)"
    },
    "digital_behavior": {
      "app_usage_frequency": "enum (daily, weekly, monthly, rarely)",
      "preferred_features": ["string array"],
      "last_login": "datetime",
      "login_frequency": "number (per month)",
      "device_preferences": ["android", "ios", "web"],
      "transaction_patterns": {
        "peak_hours": ["string array"],
        "preferred_channels": ["string array"],
        "average_transaction_amount": "decimal"
      }
    },
    "kyc_status": {
      "tier": "enum (tier1, tier2, tier3)",
      "verification_status": "enum (pending, verified, rejected, expired)",
      "documents_submitted": ["string array"],
      "verification_date": "datetime (nullable)",
      "next_review_date": "datetime (nullable)"
    },
    "account_status": {
      "status": "enum (active, inactive, suspended, closed)",
      "reason": "string (nullable)",
      "created_at": "datetime",
      "last_updated": "datetime"
    }
  }
}
```

##### **Digital Banking Transactions**
```json
{
  "digital_transaction": {
    "transaction_id": "string (UUID)",
    "customer_id": "string (UUID)",
    "account_number": "string",
    "transaction_type": "enum (transfer, payment, deposit, withdrawal, airtime, bills, investment)",
    "sub_type": "string (e.g., 'bank_transfer', 'card_payment', 'bill_payment')",
    "amount": "decimal",
    "currency": "string (NGN)",
    "fee": "decimal",
    "vat": "decimal",
    "net_amount": "decimal",
    "balance_before": "decimal",
    "balance_after": "decimal",
    "timestamp": "datetime (ISO 8601)",
    "value_date": "date",
    "channel": "enum (mobile_app, web, ussd, api, card)",
    "device_info": {
      "device_id": "string",
      "device_type": "enum (android, ios, web)",
      "app_version": "string",
      "ip_address": "string",
      "user_agent": "string",
      "location": {
        "latitude": "decimal",
        "longitude": "decimal",
        "accuracy": "number"
      }
    },
    "counterparty": {
      "account_number": "string (nullable)",
      "account_name": "string (nullable)",
      "bank_code": "string (nullable)",
      "bank_name": "string (nullable)"
    },
    "status": "enum (pending, processing, completed, failed, reversed)",
    "status_history": [
      {
        "status": "string",
        "timestamp": "datetime",
        "reason": "string (nullable)"
      }
    ],
    "reference_number": "string",
    "external_reference": "string (nullable)",
    "narration": "string",
    "merchant_info": {
      "merchant_id": "string (nullable)",
      "merchant_name": "string (nullable)",
      "merchant_category": "string (nullable)",
      "terminal_id": "string (nullable)"
    },
    "risk_assessment": {
      "risk_score": "decimal (0-100)",
      "risk_level": "enum (low, medium, high, critical)",
      "fraud_indicators": ["string array"],
      "ml_model_version": "string",
      "decision": "enum (approve, decline, review)",
      "decision_reason": "string"
    },
    "compliance_info": {
      "aml_status": "enum (clear, flagged, under_review)",
      "sanctions_check": "boolean",
      "pep_check": "boolean",
      "transaction_monitoring_alerts": ["string array"]
    }
  }
}
```

##### **Digital Customer Behavior Analytics**
```json
{
  "customer_behavior": {
    "customer_id": "string (UUID)",
    "analysis_date": "date",
    "session_data": {
      "total_sessions": "number",
      "average_session_duration": "number (minutes)",
      "bounce_rate": "decimal",
      "pages_per_session": "number",
      "most_used_features": ["string array"],
      "feature_usage_frequency": {
        "balance_inquiry": "number",
        "transfer": "number",
        "bill_payment": "number",
        "airtime": "number",
        "investment": "number",
        "loan": "number"
      }
    },
    "transaction_behavior": {
      "transaction_frequency": "number (per month)",
      "average_transaction_amount": "decimal",
      "preferred_transaction_times": ["string array"],
      "preferred_channels": ["string array"],
      "transaction_categories": {
        "transfers": "decimal (percentage)",
        "bills": "decimal (percentage)",
        "airtime": "decimal (percentage)",
        "shopping": "decimal (percentage)",
        "savings": "decimal (percentage)"
      }
    },
    "engagement_metrics": {
      "notification_open_rate": "decimal",
      "email_open_rate": "decimal",
      "sms_response_rate": "decimal",
      "customer_service_interactions": "number",
      "complaint_frequency": "number",
      "satisfaction_score": "decimal (1-10)"
    },
    "financial_health": {
      "average_balance": "decimal",
      "balance_volatility": "decimal",
      "savings_rate": "decimal",
      "spending_categories": {
        "food": "decimal",
        "transport": "decimal",
        "utilities": "decimal",
        "entertainment": "decimal",
        "healthcare": "decimal",
        "education": "decimal",
        "other": "decimal"
      },
      "credit_utilization": "decimal (nullable)",
      "payment_behavior": "enum (excellent, good, fair, poor)"
    },
    "predictive_insights": {
      "churn_probability": "decimal (0-1)",
      "next_best_action": "string",
      "product_affinity": {
        "savings": "decimal",
        "investment": "decimal",
        "loan": "decimal",
        "insurance": "decimal",
        "card": "decimal"
      },
      "lifetime_value": "decimal",
      "risk_category": "enum (low, medium, high)"
    }
  }
}
```

#### **3. Core Banking Platform Data Sources**

##### **Core Account Information**
```json
{
  "core_account": {
    "account_id": "string (UUID)",
    "account_number": "string (10 digits)",
    "customer_id": "string (UUID)",
    "account_type": "enum (savings, current, fixed_deposit, loan, credit_card)",
    "product_code": "string",
    "product_name": "string",
    "currency": "string (NGN)",
    "branch_code": "string",
    "branch_name": "string",
    "account_officer": {
      "officer_id": "string",
      "officer_name": "string",
      "phone": "string",
      "email": "string"
    },
    "balance_info": {
      "available_balance": "decimal",
      "ledger_balance": "decimal",
      "cleared_balance": "decimal",
      "uncleared_balance": "decimal",
      "hold_amount": "decimal",
      "minimum_balance": "decimal",
      "overdraft_limit": "decimal (nullable)"
    },
    "account_status": {
      "status": "enum (active, inactive, dormant, closed, frozen, restricted)",
      "status_reason": "string (nullable)",
      "restriction_type": "enum (debit, credit, both, none)",
      "restriction_reason": "string (nullable)",
      "last_transaction_date": "date",
      "dormancy_date": "date (nullable)"
    },
    "interest_info": {
      "interest_rate": "decimal",
      "interest_accrued": "decimal",
      "last_interest_date": "date",
      "interest_frequency": "enum (daily, monthly, quarterly, annually)"
    },
    "limits_and_controls": {
      "daily_debit_limit": "decimal",
      "daily_credit_limit": "decimal",
      "monthly_debit_limit": "decimal",
      "monthly_credit_limit": "decimal",
      "per_transaction_limit": "decimal",
      "channel_limits": {
        "atm": "decimal",
        "pos": "decimal",
        "internet": "decimal",
        "mobile": "decimal",
        "ussd": "decimal"
      }
    },
    "created_at": "datetime",
    "last_updated": "datetime"
  }
}
```

##### **Core Banking Transactions**
```json
{
  "core_transaction": {
    "transaction_id": "string (UUID)",
    "account_number": "string",
    "customer_id": "string (UUID)",
    "transaction_code": "string",
    "transaction_type": "enum (debit, credit)",
    "transaction_category": "string",
    "amount": "decimal",
    "currency": "string (NGN)",
    "exchange_rate": "decimal (nullable)",
    "local_amount": "decimal",
    "balance_before": "decimal",
    "balance_after": "decimal",
    "value_date": "date",
    "transaction_date": "datetime",
    "posting_date": "datetime",
    "reference_number": "string",
    "external_reference": "string (nullable)",
    "narration": "string",
    "teller_id": "string (nullable)",
    "branch_code": "string",
    "channel": "enum (branch, atm, pos, internet, mobile, ussd, agent, cheque)",
    "counterparty": {
      "account_number": "string (nullable)",
      "account_name": "string (nullable)",
      "bank_code": "string (nullable)",
      "sort_code": "string (nullable)"
    },
    "instrument_info": {
      "instrument_type": "enum (cash, cheque, card, transfer, standing_order)",
      "instrument_number": "string (nullable)",
      "instrument_date": "date (nullable)",
      "clearing_date": "date (nullable)"
    },
    "status": "enum (pending, posted, reversed, cancelled)",
    "reversal_info": {
      "is_reversed": "boolean",
      "reversal_date": "datetime (nullable)",
      "reversal_reason": "string (nullable)",
      "reversed_by": "string (nullable)"
    },
    "fees_and_charges": {
      "commission": "decimal",
      "vat": "decimal",
      "stamp_duty": "decimal",
      "other_charges": "decimal",
      "total_charges": "decimal"
    },
    "regulatory_info": {
      "cot_applicable": "boolean",
      "cot_amount": "decimal",
      "reporting_code": "string (nullable)",
      "regulatory_category": "string (nullable)"
    }
  }
}
```

##### **Customer Relationship Data**
```json
{
  "customer_relationship": {
    "customer_id": "string (UUID)",
    "relationship_number": "string",
    "customer_type": "enum (individual, corporate, sme, government)",
    "customer_segment": "enum (mass_market, affluent, private_banking, corporate)",
    "risk_rating": "enum (low, medium, high, very_high)",
    "kyc_tier": "enum (tier1, tier2, tier3)",
    "relationship_manager": {
      "rm_id": "string",
      "rm_name": "string",
      "rm_phone": "string",
      "rm_email": "string"
    },
    "accounts": [
      {
        "account_number": "string",
        "account_type": "string",
        "balance": "decimal",
        "status": "string"
      }
    ],
    "total_relationship_balance": "decimal",
    "credit_facilities": [
      {
        "facility_id": "string",
        "facility_type": "string",
        "limit": "decimal",
        "outstanding": "decimal",
        "status": "string"
      }
    ],
    "investment_products": [
      {
        "product_id": "string",
        "product_type": "string",
        "value": "decimal",
        "maturity_date": "date (nullable)"
      }
    ],
    "relationship_metrics": {
      "tenure_months": "number",
      "profitability_score": "decimal",
      "cross_sell_ratio": "decimal",
      "service_utilization": "decimal",
      "complaint_frequency": "number",
      "satisfaction_score": "decimal (1-10)"
    },
    "life_events": [
      {
        "event_type": "enum (marriage, birth, job_change, relocation, retirement)",
        "event_date": "date",
        "impact_on_banking": "string"
      }
    ]
  }
}
```

#### **4. Payment Processing Platform Data Sources**

##### **Payment Transaction Data**
```json
{
  "payment_transaction": {
    "payment_id": "string (UUID)",
    "merchant_id": "string",
    "customer_id": "string (UUID, nullable)",
    "transaction_type": "enum (purchase, refund, reversal, chargeback)",
    "payment_method": "enum (card, bank_transfer, wallet, ussd, qr_code, nfc)",
    "card_info": {
      "card_type": "enum (debit, credit, prepaid)",
      "card_scheme": "enum (visa, mastercard, verve, americanexpress)",
      "masked_pan": "string",
      "expiry_month": "string",
      "expiry_year": "string",
      "issuer_bank": "string",
      "card_country": "string"
    },
    "amount_info": {
      "transaction_amount": "decimal",
      "currency": "string (NGN)",
      "exchange_rate": "decimal (nullable)",
      "settlement_amount": "decimal",
      "settlement_currency": "string",
      "merchant_fee": "decimal",
      "interchange_fee": "decimal",
      "scheme_fee": "decimal",
      "processing_fee": "decimal",
      "net_settlement": "decimal"
    },
    "transaction_details": {
      "reference_number": "string",
      "merchant_reference": "string",
      "authorization_code": "string (nullable)",
      "retrieval_reference": "string",
      "terminal_id": "string (nullable)",
      "merchant_category_code": "string",
      "transaction_description": "string"
    },
    "timestamp_info": {
      "transaction_time": "datetime (ISO 8601)",
      "authorization_time": "datetime (nullable)",
      "settlement_time": "datetime (nullable)",
      "local_time": "datetime"
    },
    "location_info": {
      "merchant_location": {
        "address": "string",
        "city": "string",
        "state": "string",
        "country": "string",
        "postal_code": "string"
      },
      "transaction_location": {
        "latitude": "decimal (nullable)",
        "longitude": "decimal (nullable)",
        "ip_address": "string (nullable)"
      }
    },
    "status_info": {
      "transaction_status": "enum (pending, approved, declined, failed, cancelled, settled)",
      "response_code": "string",
      "response_message": "string",
      "decline_reason": "string (nullable)",
      "settlement_status": "enum (pending, settled, failed, disputed)"
    },
    "security_info": {
      "authentication_method": "enum (pin, otp, biometric, 3ds, none)",
      "3ds_status": "enum (authenticated, attempted, failed, not_enrolled, unavailable)",
      "cvv_result": "enum (match, no_match, not_processed, not_present)",
      "avs_result": "string (nullable)",
      "risk_score": "decimal (0-100)",
      "fraud_indicators": ["string array"]
    },
    "device_info": {
      "device_type": "enum (pos, mobile, web, atm, kiosk)",
      "device_id": "string (nullable)",
      "device_model": "string (nullable)",
      "os_version": "string (nullable)",
      "app_version": "string (nullable)",
      "browser_info": "string (nullable)"
    }
  }
}
```

##### **Merchant Data**
```json
{
  "merchant": {
    "merchant_id": "string (UUID)",
    "merchant_code": "string",
    "business_info": {
      "business_name": "string",
      "trading_name": "string",
      "business_type": "enum (sole_proprietorship, partnership, limited_company, plc)",
      "industry": "string",
      "sub_industry": "string",
      "merchant_category_code": "string",
      "business_registration_number": "string",
      "tax_identification_number": "string"
    },
    "contact_info": {
      "primary_contact": {
        "name": "string",
        "phone": "string",
        "email": "string",
        "position": "string"
      },
      "business_address": {
        "street": "string",
        "city": "string",
        "state": "string",
        "postal_code": "string",
        "country": "string"
      },
      "settlement_address": {
        "street": "string",
        "city": "string",
        "state": "string",
        "postal_code": "string",
        "country": "string"
      }
    },
    "banking_info": {
      "settlement_account": {
        "account_number": "string",
        "account_name": "string",
        "bank_code": "string",
        "bank_name": "string"
      },
      "settlement_frequency": "enum (daily, weekly, monthly)",
      "settlement_currency": "string (NGN)"
    },
    "business_metrics": {
      "monthly_volume": "decimal",
      "average_ticket_size": "decimal",
      "transaction_frequency": "number",
      "peak_hours": ["string array"],
      "seasonal_patterns": "object",
      "chargeback_rate": "decimal",
      "refund_rate": "decimal"
    },
    "risk_profile": {
      "risk_rating": "enum (low, medium, high, very_high)",
      "risk_factors": ["string array"],
      "monitoring_level": "enum (standard, enhanced, intensive)",
      "last_risk_review": "date"
    },
    "onboarding_info": {
      "onboarding_date": "date",
      "onboarded_by": "string",
      "kyb_status": "enum (pending, verified, rejected)",
      "documents_submitted": ["string array"],
      "verification_date": "date (nullable)"
    },
    "status": {
      "merchant_status": "enum (active, inactive, suspended, terminated)",
      "status_reason": "string (nullable)",
      "last_transaction_date": "date (nullable)"
    }
  }
}
```

##### **Payment Analytics Data**
```json
{
  "payment_analytics": {
    "merchant_id": "string (UUID)",
    "analysis_period": {
      "start_date": "date",
      "end_date": "date"
    },
    "transaction_metrics": {
      "total_transactions": "number",
      "total_volume": "decimal",
      "average_transaction_amount": "decimal",
      "success_rate": "decimal",
      "decline_rate": "decimal",
      "chargeback_rate": "decimal",
      "refund_rate": "decimal"
    },
    "channel_breakdown": {
      "card_transactions": {
        "count": "number",
        "volume": "decimal",
        "success_rate": "decimal"
      },
      "bank_transfer": {
        "count": "number",
        "volume": "decimal",
        "success_rate": "decimal"
      },
      "wallet": {
        "count": "number",
        "volume": "decimal",
        "success_rate": "decimal"
      },
      "ussd": {
        "count": "number",
        "volume": "decimal",
        "success_rate": "decimal"
      }
    },
    "time_patterns": {
      "hourly_distribution": "object",
      "daily_distribution": "object",
      "monthly_trends": "object",
      "seasonal_patterns": "object"
    },
    "customer_insights": {
      "unique_customers": "number",
      "repeat_customers": "number",
      "customer_retention_rate": "decimal",
      "average_customer_value": "decimal",
      "top_customer_segments": ["object array"]
    },
    "geographic_distribution": {
      "by_state": "object",
      "by_city": "object",
      "international_transactions": "object"
    },
    "risk_metrics": {
      "fraud_attempts": "number",
      "fraud_amount": "decimal",
      "blocked_transactions": "number",
      "false_positive_rate": "decimal",
      "risk_score_distribution": "object"
    }
  }
}
```

### **🎯 Customer 360 Unified Data Model**

#### **Master Customer Record**
```json
{
  "customer_360": {
    "master_customer_id": "string (UUID)",
    "customer_identifiers": {
      "bvn": "string (11 digits)",
      "nin": "string (11 digits)",
      "phone_number": "string (E.164 format)",
      "email": "string",
      "alternate_identifiers": ["string array"]
    },
    "personal_profile": {
      "basic_info": {
        "first_name": "string",
        "middle_name": "string (nullable)",
        "last_name": "string",
        "date_of_birth": "date",
        "gender": "enum (male, female, other)",
        "marital_status": "enum (single, married, divorced, widowed)",
        "nationality": "string",
        "state_of_origin": "string",
        "lga_of_origin": "string"
      },
      "contact_preferences": {
        "preferred_language": "enum (english, hausa, yoruba, igbo, pidgin)",
        "preferred_channel": "enum (sms, email, voice, whatsapp, app_notification)",
        "best_contact_time": "string",
        "communication_frequency": "enum (daily, weekly, monthly, as_needed)"
      },
      "demographic_info": {
        "age_group": "enum (18-25, 26-35, 36-45, 46-55, 56-65, 65+)",
        "education_level": "enum (primary, secondary, tertiary, postgraduate)",
        "occupation": "string",
        "income_bracket": "enum (low, medium, high, very_high)",
        "family_size": "number"
      }
    },
    "financial_profile": {
      "account_summary": {
        "total_accounts": "number",
        "account_types": ["string array"],
        "total_balance": "decimal",
        "primary_account": "string",
        "relationship_tenure": "number (months)"
      },
      "transaction_behavior": {
        "monthly_transaction_volume": "decimal",
        "monthly_transaction_count": "number",
        "average_transaction_amount": "decimal",
        "preferred_channels": ["string array"],
        "transaction_patterns": "object",
        "spending_categories": "object"
      },
      "credit_profile": {
        "credit_score": "number (300-850)",
        "credit_history_length": "number (months)",
        "active_loans": "number",
        "total_credit_limit": "decimal",
        "credit_utilization": "decimal",
        "payment_behavior": "enum (excellent, good, fair, poor)",
        "default_history": "boolean"
      },
      "investment_profile": {
        "risk_tolerance": "enum (conservative, moderate, aggressive)",
        "investment_products": ["string array"],
        "total_investment_value": "decimal",
        "investment_horizon": "enum (short_term, medium_term, long_term)"
      }
    },
    "behavioral_profile": {
      "digital_engagement": {
        "digital_adoption_score": "decimal (0-100)",
        "app_usage_frequency": "enum (daily, weekly, monthly, rarely)",
        "feature_usage": "object",
        "support_channel_preference": "enum (self_service, chat, phone, branch)"
      },
      "service_interaction": {
        "complaint_frequency": "number",
        "complaint_categories": ["string array"],
        "resolution_satisfaction": "decimal (1-10)",
        "service_utilization": "object",
        "branch_visit_frequency": "enum (never, rarely, monthly, weekly)"
      },
      "product_affinity": {
        "current_products": ["string array"],
        "product_usage_intensity": "object",
        "cross_sell_opportunities": ["string array"],
        "upsell_opportunities": ["string array"],
        "churn_indicators": ["string array"]
      }
    },
    "risk_profile": {
      "overall_risk_score": "decimal (0-100)",
      "fraud_risk": "enum (low, medium, high, critical)",
      "credit_risk": "enum (low, medium, high, critical)",
      "aml_risk": "enum (low, medium, high, critical)",
      "operational_risk": "enum (low, medium, high, critical)",
      "risk_factors": ["string array"],
      "monitoring_level": "enum (standard, enhanced, intensive)"
    },
    "lifecycle_stage": {
      "customer_stage": "enum (prospect, new, growing, mature, declining, dormant, churned)",
      "onboarding_completion": "decimal (0-100)",
      "relationship_depth": "enum (transactional, developing, established, advocate)",
      "lifetime_value": "decimal",
      "predicted_churn_probability": "decimal (0-1)",
      "next_best_action": "string"
    },
    "interaction_history": {
      "total_interactions": "number",
      "recent_interactions": [
        {
          "interaction_id": "string",
          "channel": "string",
          "type": "string",
          "date": "datetime",
          "outcome": "string",
          "satisfaction": "decimal (nullable)"
        }
      ],
      "interaction_trends": "object",
      "escalation_history": ["object array"]
    },
    "preferences_and_insights": {
      "product_preferences": "object",
      "service_preferences": "object",
      "marketing_preferences": {
        "opt_in_marketing": "boolean",
        "preferred_offers": ["string array"],
        "offer_frequency": "enum (daily, weekly, monthly, quarterly)"
      },
      "predictive_insights": {
        "next_likely_transaction": "object",
        "product_recommendation": "string",
        "optimal_contact_time": "string",
        "churn_prevention_actions": ["string array"]
      }
    },
    "data_quality": {
      "completeness_score": "decimal (0-100)",
      "accuracy_score": "decimal (0-100)",
      "freshness_score": "decimal (0-100)",
      "consistency_score": "decimal (0-100)",
      "last_updated": "datetime",
      "data_sources": ["string array"],
      "validation_status": "enum (validated, pending, failed)"
    }
  }
}
```

### **📊 AI Telephony Event Triggers**

#### **Outbound Call Triggers**
```json
{
  "outbound_triggers": {
    "fraud_detection": {
      "trigger_conditions": [
        {
          "condition": "suspicious_transaction_detected",
          "threshold": {
            "amount_threshold": 50000,
            "velocity_threshold": 5,
            "time_window": "1_hour",
            "risk_score": 80
          },
          "priority": "critical",
          "call_within": "5_minutes"
        },
        {
          "condition": "unusual_location_transaction",
          "threshold": {
            "distance_from_usual": 100,
            "amount_threshold": 10000
          },
          "priority": "high",
          "call_within": "15_minutes"
        },
        {
          "condition": "multiple_failed_attempts",
          "threshold": {
            "failed_attempts": 3,
            "time_window": "30_minutes"
          },
          "priority": "medium",
          "call_within": "1_hour"
        }
      ],
      "call_script_template": "fraud_alert",
      "languages": ["english", "hausa", "yoruba", "igbo", "pidgin"],
      "escalation_rules": {
        "no_answer": "send_sms_and_email",
        "customer_confirms_fraud": "block_account_immediately",
        "customer_denies_fraud": "update_risk_profile"
      }
    },
    "product_promotion": {
      "trigger_conditions": [
        {
          "condition": "high_balance_no_investment",
          "threshold": {
            "balance_threshold": 500000,
            "no_investment_days": 30
          },
          "priority": "low",
          "call_within": "24_hours"
        },
        {
          "condition": "loan_eligibility",
          "threshold": {
            "credit_score": 650,
            "income_threshold": 100000,
            "relationship_tenure": 6
          },
          "priority": "medium",
          "call_within": "48_hours"
        },
        {
          "condition": "card_upgrade_eligible",
          "threshold": {
            "monthly_spend": 50000,
            "current_card_tier": "basic"
          },
          "priority": "low",
          "call_within": "72_hours"
        }
      ],
      "call_script_template": "product_offer",
      "languages": ["english", "hausa", "yoruba", "igbo", "pidgin"],
      "personalization": {
        "use_customer_name": true,
        "reference_transaction_history": true,
        "customize_offer_amount": true
      }
    },
    "account_maintenance": {
      "trigger_conditions": [
        {
          "condition": "kyc_expiry_reminder",
          "threshold": {
            "days_to_expiry": 30
          },
          "priority": "high",
          "call_within": "24_hours"
        },
        {
          "condition": "dormant_account_activation",
          "threshold": {
            "days_inactive": 90,
            "balance_threshold": 1000
          },
          "priority": "medium",
          "call_within": "48_hours"
        },
        {
          "condition": "negative_balance_alert",
          "threshold": {
            "negative_days": 3,
            "amount_threshold": -10000
          },
          "priority": "high",
          "call_within": "6_hours"
        }
      ],
      "call_script_template": "account_maintenance",
      "languages": ["english", "hausa", "yoruba", "igbo", "pidgin"]
    }
  }
}
```

#### **Inbound Call Resolution Framework**
```json
{
  "inbound_resolution": {
    "blocked_account": {
      "identification_steps": [
        "verify_customer_identity",
        "check_account_status",
        "identify_block_reason",
        "assess_resolution_authority"
      ],
      "resolution_paths": {
        "fraud_block": {
          "verification_required": ["security_questions", "otp_verification", "document_upload"],
          "resolution_steps": ["verify_recent_transactions", "confirm_identity", "unblock_account"],
          "escalation_criteria": "high_risk_transactions_involved",
          "resolution_time": "15_minutes"
        },
        "kyc_block": {
          "verification_required": ["document_verification", "address_confirmation"],
          "resolution_steps": ["collect_documents", "schedule_verification", "temporary_unblock"],
          "escalation_criteria": "document_authenticity_concerns",
          "resolution_time": "30_minutes"
        },
        "regulatory_block": {
          "verification_required": ["compliance_check", "source_of_funds"],
          "resolution_steps": ["escalate_to_compliance", "schedule_interview"],
          "escalation_criteria": "always_escalate",
          "resolution_time": "24_hours"
        }
      },
      "languages": ["english", "hausa", "yoruba", "igbo", "pidgin"],
      "success_metrics": {
        "resolution_rate": "target_85_percent",
        "customer_satisfaction": "target_4_5_out_of_5",
        "first_call_resolution": "target_70_percent"
      }
    },
    "transaction_disputes": {
      "identification_steps": [
        "verify_customer_identity",
        "identify_disputed_transaction",
        "categorize_dispute_type",
        "assess_dispute_validity"
      ],
      "resolution_paths": {
        "unauthorized_transaction": {
          "verification_required": ["transaction_details", "location_verification", "device_verification"],
          "resolution_steps": ["block_card", "initiate_chargeback", "issue_provisional_credit"],
          "escalation_criteria": "amount_above_100000",
          "resolution_time": "immediate_provisional_credit"
        },
        "merchant_dispute": {
          "verification_required": ["receipt_verification", "merchant_contact"],
          "resolution_steps": ["contact_merchant", "mediate_resolution", "process_refund"],
          "escalation_criteria": "merchant_non_responsive",
          "resolution_time": "48_hours"
        },
        "duplicate_charge": {
          "verification_required": ["transaction_comparison", "merchant_confirmation"],
          "resolution_steps": ["verify_duplication", "process_reversal"],
          "escalation_criteria": "system_error_suspected",
          "resolution_time": "24_hours"
        }
      },
      "languages": ["english", "hausa", "yoruba", "igbo", "pidgin"]
    },
    "general_inquiries": {
      "categories": [
        "balance_inquiry",
        "transaction_history",
        "product_information",
        "service_requests",
        "technical_support"
      ],
      "resolution_framework": {
        "self_service_first": true,
        "knowledge_base_integration": true,
        "escalation_to_human": "complex_issues_only",
        "follow_up_required": "customer_satisfaction_below_4"
      },
      "languages": ["english", "hausa", "yoruba", "igbo", "pidgin"]
    }
  }
}
```

### **🎯 Data Integration Architecture**

#### **Real-time Data Streaming**
```yaml
data_streaming:
  kafka_topics:
    - name: "customer-transactions"
      partitions: 12
      replication_factor: 3
      retention_hours: 168
    - name: "fraud-alerts"
      partitions: 6
      replication_factor: 3
      retention_hours: 720
    - name: "customer-interactions"
      partitions: 8
      replication_factor: 3
      retention_hours: 168
    - name: "telephony-events"
      partitions: 4
      replication_factor: 3
      retention_hours: 72

  stream_processing:
    flink_jobs:
      - name: "customer-360-aggregator"
        parallelism: 8
        checkpointing_interval: "30s"
        state_backend: "rocksdb"
      - name: "fraud-detection-engine"
        parallelism: 12
        checkpointing_interval: "10s"
        state_backend: "rocksdb"
      - name: "telephony-trigger-processor"
        parallelism: 4
        checkpointing_interval: "15s"
        state_backend: "rocksdb"

  data_lake_integration:
    delta_lake:
      tables:
        - name: "customer_360_master"
          partition_by: ["date", "customer_segment"]
          optimize_frequency: "daily"
        - name: "transaction_history"
          partition_by: ["date", "transaction_type"]
          optimize_frequency: "hourly"
        - name: "telephony_interactions"
          partition_by: ["date", "call_type"]
          optimize_frequency: "daily"
```

This comprehensive data architecture provides the foundation for building rich customer datasets from all banking platforms, enabling sophisticated AI telephony agents to make intelligent outbound calls and handle complex inbound customer service scenarios in multiple Nigerian languages.

