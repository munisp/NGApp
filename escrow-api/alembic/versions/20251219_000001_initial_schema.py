"""Initial schema for EscrowProtect Platform

Revision ID: 20251219_000001
Revises: 
Create Date: 2025-12-19 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '20251219_000001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users table
    op.create_table(
        'users',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('phone', sa.String(20), unique=True, nullable=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(255), nullable=True),
        sa.Column('user_type', sa.String(20), nullable=False, server_default='buyer'),
        sa.Column('kyc_level', sa.Integer, nullable=False, server_default='0'),
        sa.Column('kyc_verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('is_verified', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_users_email', 'users', ['email'])
    op.create_index('ix_users_phone', 'users', ['phone'])
    
    # Bank accounts table
    op.create_table(
        'bank_accounts',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('bank_code', sa.String(10), nullable=False),
        sa.Column('bank_name', sa.String(100), nullable=False),
        sa.Column('account_number', sa.String(20), nullable=False),
        sa.Column('account_name', sa.String(255), nullable=False),
        sa.Column('is_verified', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_primary', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_bank_accounts_user_id', 'bank_accounts', ['user_id'])
    
    # Escrows table
    op.create_table(
        'escrows',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('buyer_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('seller_id', sa.String(36), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('amount_kobo', sa.BigInteger, nullable=False),
        sa.Column('platform_fee_kobo', sa.BigInteger, nullable=False),
        sa.Column('insurance_fee_kobo', sa.BigInteger, nullable=False, server_default='0'),
        sa.Column('currency', sa.String(3), nullable=False, server_default='NGN'),
        sa.Column('status', sa.String(30), nullable=False, server_default='created'),
        sa.Column('listing_title', sa.String(500), nullable=False),
        sa.Column('listing_description', sa.Text, nullable=True),
        sa.Column('listing_image_url', sa.String(500), nullable=True),
        sa.Column('claim_token', sa.String(64), nullable=False),
        sa.Column('tigerbeetle_transfer_id', sa.String(64), nullable=True),
        sa.Column('payment_method', sa.String(30), nullable=True),
        sa.Column('payment_reference', sa.String(100), nullable=True),
        sa.Column('shipping_carrier', sa.String(100), nullable=True),
        sa.Column('tracking_number', sa.String(100), nullable=True),
        sa.Column('shipped_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('delivered_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('refunded_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('auto_release_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_escrows_buyer_id', 'escrows', ['buyer_id'])
    op.create_index('ix_escrows_seller_id', 'escrows', ['seller_id'])
    op.create_index('ix_escrows_status', 'escrows', ['status'])
    op.create_index('ix_escrows_created_at', 'escrows', ['created_at'])
    
    # Escrow timeline table
    op.create_table(
        'escrow_timeline',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('escrow_id', sa.String(36), sa.ForeignKey('escrows.id'), nullable=False),
        sa.Column('event_type', sa.String(50), nullable=False),
        sa.Column('event_data', sa.JSON, nullable=True),
        sa.Column('actor_id', sa.String(36), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_escrow_timeline_escrow_id', 'escrow_timeline', ['escrow_id'])
    
    # Ledger entries table (for TigerBeetle reconciliation)
    op.create_table(
        'ledger_entries',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('escrow_id', sa.String(36), sa.ForeignKey('escrows.id'), nullable=True),
        sa.Column('tigerbeetle_transfer_id', sa.String(64), nullable=False, unique=True),
        sa.Column('entry_type', sa.String(30), nullable=False),
        sa.Column('debit_account_id', sa.String(64), nullable=False),
        sa.Column('credit_account_id', sa.String(64), nullable=False),
        sa.Column('amount_kobo', sa.BigInteger, nullable=False),
        sa.Column('currency', sa.String(3), nullable=False, server_default='NGN'),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('idempotency_key', sa.String(64), nullable=True, unique=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_ledger_entries_escrow_id', 'ledger_entries', ['escrow_id'])
    op.create_index('ix_ledger_entries_tigerbeetle_transfer_id', 'ledger_entries', ['tigerbeetle_transfer_id'])
    
    # Account balances table (cache of TigerBeetle balances)
    op.create_table(
        'account_balances',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('account_type', sa.String(30), nullable=False),
        sa.Column('tigerbeetle_account_id', sa.String(64), nullable=False, unique=True),
        sa.Column('available_balance_kobo', sa.BigInteger, nullable=False, server_default='0'),
        sa.Column('pending_balance_kobo', sa.BigInteger, nullable=False, server_default='0'),
        sa.Column('currency', sa.String(3), nullable=False, server_default='NGN'),
        sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_account_balances_user_id', 'account_balances', ['user_id'])
    
    # Disputes table
    op.create_table(
        'disputes',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('escrow_id', sa.String(36), sa.ForeignKey('escrows.id'), nullable=False),
        sa.Column('opened_by', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('reason', sa.String(100), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('status', sa.String(30), nullable=False, server_default='open'),
        sa.Column('priority', sa.String(20), nullable=False, server_default='medium'),
        sa.Column('assigned_to', sa.String(36), nullable=True),
        sa.Column('resolution', sa.String(50), nullable=True),
        sa.Column('resolution_notes', sa.Text, nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('sla_response_deadline', sa.DateTime(timezone=True), nullable=True),
        sa.Column('sla_resolution_deadline', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_disputes_escrow_id', 'disputes', ['escrow_id'])
    op.create_index('ix_disputes_status', 'disputes', ['status'])
    
    # Dispute evidence table
    op.create_table(
        'dispute_evidence',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('dispute_id', sa.String(36), sa.ForeignKey('disputes.id'), nullable=False),
        sa.Column('submitted_by', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('evidence_type', sa.String(30), nullable=False),
        sa.Column('file_url', sa.String(500), nullable=True),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_dispute_evidence_dispute_id', 'dispute_evidence', ['dispute_id'])
    
    # Dispute messages table
    op.create_table(
        'dispute_messages',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('dispute_id', sa.String(36), sa.ForeignKey('disputes.id'), nullable=False),
        sa.Column('sender_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('message', sa.Text, nullable=False),
        sa.Column('is_internal', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_dispute_messages_dispute_id', 'dispute_messages', ['dispute_id'])
    
    # Fraud alerts table
    op.create_table(
        'fraud_alerts',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('escrow_id', sa.String(36), sa.ForeignKey('escrows.id'), nullable=True),
        sa.Column('alert_type', sa.String(50), nullable=False),
        sa.Column('risk_score', sa.Float, nullable=False),
        sa.Column('risk_factors', sa.JSON, nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('reviewed_by', sa.String(36), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('action_taken', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_fraud_alerts_user_id', 'fraud_alerts', ['user_id'])
    op.create_index('ix_fraud_alerts_escrow_id', 'fraud_alerts', ['escrow_id'])
    op.create_index('ix_fraud_alerts_status', 'fraud_alerts', ['status'])
    
    # Fraud patterns table
    op.create_table(
        'fraud_patterns',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('pattern_name', sa.String(100), nullable=False),
        sa.Column('pattern_type', sa.String(50), nullable=False),
        sa.Column('pattern_rules', sa.JSON, nullable=False),
        sa.Column('risk_weight', sa.Float, nullable=False, server_default='1.0'),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # Audit logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), nullable=True),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('resource_type', sa.String(50), nullable=False),
        sa.Column('resource_id', sa.String(36), nullable=True),
        sa.Column('old_values', sa.JSON, nullable=True),
        sa.Column('new_values', sa.JSON, nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_audit_logs_user_id', 'audit_logs', ['user_id'])
    op.create_index('ix_audit_logs_resource_type', 'audit_logs', ['resource_type'])
    op.create_index('ix_audit_logs_created_at', 'audit_logs', ['created_at'])
    
    # Seller tiers table
    op.create_table(
        'seller_tiers',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False, unique=True),
        sa.Column('tier', sa.String(20), nullable=False, server_default='bronze'),
        sa.Column('total_transactions', sa.Integer, nullable=False, server_default='0'),
        sa.Column('total_volume_kobo', sa.BigInteger, nullable=False, server_default='0'),
        sa.Column('success_rate', sa.Float, nullable=False, server_default='0'),
        sa.Column('average_rating', sa.Float, nullable=False, server_default='0'),
        sa.Column('tier_updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_seller_tiers_user_id', 'seller_tiers', ['user_id'])
    op.create_index('ix_seller_tiers_tier', 'seller_tiers', ['tier'])
    
    # Loyalty points table
    op.create_table(
        'loyalty_points',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False, unique=True),
        sa.Column('available_points', sa.Integer, nullable=False, server_default='0'),
        sa.Column('lifetime_points', sa.Integer, nullable=False, server_default='0'),
        sa.Column('redeemed_points', sa.Integer, nullable=False, server_default='0'),
        sa.Column('tier', sa.String(20), nullable=False, server_default='bronze'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_loyalty_points_user_id', 'loyalty_points', ['user_id'])


def downgrade() -> None:
    op.drop_table('loyalty_points')
    op.drop_table('seller_tiers')
    op.drop_table('audit_logs')
    op.drop_table('fraud_patterns')
    op.drop_table('fraud_alerts')
    op.drop_table('dispute_messages')
    op.drop_table('dispute_evidence')
    op.drop_table('disputes')
    op.drop_table('account_balances')
    op.drop_table('ledger_entries')
    op.drop_table('escrow_timeline')
    op.drop_table('escrows')
    op.drop_table('bank_accounts')
    op.drop_table('users')
