"""Add webhook tables for RustFS integration

Revision ID: 004_webhook_tables
Revises: 003_previous_migration
Create Date: 2025-12-27

This migration adds tables for:
- webhook_endpoints: Stores webhook endpoint configurations
- webhook_deliveries: Tracks webhook delivery attempts
- event_outbox: Transactional outbox for reliable event processing
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '004_webhook_tables'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'webhook_endpoints',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('merchant_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('url', sa.String(2048), nullable=False),
        sa.Column('secret', sa.String(256), nullable=False),
        sa.Column('events', postgresql.ARRAY(sa.String(64)), nullable=False, default=[]),
        sa.Column('enabled', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_index(
        'ix_webhook_endpoints_merchant_enabled',
        'webhook_endpoints',
        ['merchant_id', 'enabled'],
    )

    op.create_table(
        'webhook_deliveries',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('endpoint_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('webhook_endpoints.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('event_type', sa.String(64), nullable=False, index=True),
        sa.Column('payload', postgresql.JSONB(), nullable=False),
        sa.Column('status', sa.String(32), nullable=False, default='pending', index=True),
        sa.Column('attempts', sa.Integer(), nullable=False, default=0),
        sa.Column('max_attempts', sa.Integer(), nullable=False, default=5),
        sa.Column('last_attempt_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('next_retry_at', sa.DateTime(timezone=True), nullable=True, index=True),
        sa.Column('response_status', sa.Integer(), nullable=True),
        sa.Column('response_body', sa.Text(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_index(
        'ix_webhook_deliveries_status_next_retry',
        'webhook_deliveries',
        ['status', 'next_retry_at'],
        postgresql_where=sa.text("status = 'retrying'"),
    )

    op.create_table(
        'event_outbox',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('event_id', postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column('event_type', sa.String(64), nullable=False, index=True),
        sa.Column('aggregate_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('aggregate_type', sa.String(64), nullable=False),
        sa.Column('payload', postgresql.JSONB(), nullable=False),
        sa.Column('status', sa.String(32), nullable=False, default='pending', index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index(
        'ix_event_outbox_pending',
        'event_outbox',
        ['status', 'created_at'],
        postgresql_where=sa.text("status = 'pending'"),
    )


def downgrade():
    op.drop_table('event_outbox')
    op.drop_table('webhook_deliveries')
    op.drop_table('webhook_endpoints')
