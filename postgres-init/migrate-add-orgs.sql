-- Migration: Add multi-tenancy (organizations + org_id)
-- Run this once against an existing database that was created before the init-database.sql update.
-- Safe to run multiple times (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS organizations (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    plan VARCHAR(50) NOT NULL DEFAULT 'trial',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS org_id VARCHAR(255) REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE auction_items
    ADD COLUMN IF NOT EXISTS org_id VARCHAR(255) REFERENCES organizations(id) ON DELETE SET NULL;

-- Index for fast org filtering
CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(org_id);
CREATE INDEX IF NOT EXISTS idx_auction_items_org_id ON auction_items(org_id);
