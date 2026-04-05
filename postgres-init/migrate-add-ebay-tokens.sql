-- Migration: Add eBay OAuth token columns to users table
-- Run this against existing databases (new installs get these via init-database.sql)

ALTER TABLE users ADD COLUMN IF NOT EXISTS ebay_access_token  TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ebay_refresh_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ebay_token_expiry  TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ebay_user_id       VARCHAR(255);
