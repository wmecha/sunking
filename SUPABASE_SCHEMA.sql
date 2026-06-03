-- ============================================================
-- Sun King Location Intelligence — Supabase PostgreSQL Schema
-- Run this entire file in your Supabase SQL Editor (once)
-- ============================================================

-- GBP snapshot metadata (one row per CSV import)
CREATE TABLE IF NOT EXISTS gbp_snapshots (
  id              BIGSERIAL PRIMARY KEY,
  filename        TEXT        NOT NULL,
  imported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_count     INTEGER     DEFAULT 0,
  published_count INTEGER     DEFAULT 0,
  not_published_count INTEGER DEFAULT 0,
  duplicate_count INTEGER     DEFAULT 0,
  notes           TEXT
);

-- Individual GBP listing rows (linked to a snapshot)
CREATE TABLE IF NOT EXISTS gbp_locations (
  id            BIGSERIAL PRIMARY KEY,
  snapshot_id   BIGINT NOT NULL REFERENCES gbp_snapshots(id) ON DELETE CASCADE,
  store_code    TEXT,
  business_name TEXT,
  status        TEXT,
  address       TEXT,
  city          TEXT,
  country       TEXT
);

-- Master tracker (one row per location)
CREATE TABLE IF NOT EXISTS tracker_locations (
  id             BIGSERIAL PRIMARY KEY,
  store_code     TEXT UNIQUE,
  business_name  TEXT,
  country        TEXT,
  location_type  TEXT,
  ov             TEXT,
  ou             TEXT,
  claiming_issue TEXT,
  action_taken   TEXT,
  address        TEXT,
  city           TEXT, -- Locality
  latitude       DOUBLE PRECISION,
  longitude      DOUBLE PRECISION,
  google_maps_url TEXT,
  logo_photo_url TEXT,
  cover_photo_url TEXT,
  other_photo_urls JSONB,
  primary_phone TEXT,
  website TEXT,
  primary_category TEXT,
  monday_hours TEXT,
  tuesday_hours TEXT,
  wednesday_hours TEXT,
  thursday_hours TEXT,
  friday_hours TEXT,
  saturday_hours TEXT,
  sunday_hours TEXT,
  tracker_status TEXT,
  duplicate_flag TEXT,
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  sheet_synced_at TIMESTAMPTZ
);

-- Existing deployments may already have tracker_locations. Keep these
-- additive so applying the schema file remains safe.
ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS google_maps_url TEXT;
ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS logo_photo_url TEXT;
ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS cover_photo_url TEXT;
ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS other_photo_urls JSONB;
ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS primary_phone TEXT;
ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS primary_category TEXT;
ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS monday_hours TEXT;
ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS tuesday_hours TEXT;
ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS wednesday_hours TEXT;
ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS thursday_hours TEXT;
ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS friday_hours TEXT;
ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS saturday_hours TEXT;
ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS sunday_hours TEXT;
ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS sheet_synced_at TIMESTAMPTZ;
ALTER TABLE tracker_locations ADD COLUMN IF NOT EXISTS duplicate_flag TEXT;

-- Reconciliation run history
CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id                    BIGSERIAL PRIMARY KEY,
  run_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snapshot_id           BIGINT      NOT NULL REFERENCES gbp_snapshots(id),
  total_gbp             INTEGER,
  total_tracker         INTEGER,
  matched               INTEGER,
  ov_confirmed          INTEGER,
  ou_confirmed          INTEGER,
  missing_from_tracker  INTEGER,
  status_mismatches     INTEGER
);

-- CSV export log
CREATE TABLE IF NOT EXISTS export_history (
  id             BIGSERIAL PRIMARY KEY,
  exported_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  filename       TEXT,
  filter_country TEXT,
  filter_status  TEXT,
  row_count      INTEGER
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_logs (
  id           BIGSERIAL PRIMARY KEY,
  action       TEXT        NOT NULL,
  entity_type  TEXT,
  entity_id    TEXT,
  details      TEXT,
  performed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tracker_country    ON tracker_locations(country);
CREATE INDEX IF NOT EXISTS idx_tracker_status     ON tracker_locations(tracker_status);
CREATE INDEX IF NOT EXISTS idx_tracker_store_code ON tracker_locations(store_code);
CREATE INDEX IF NOT EXISTS idx_gbp_snapshot       ON gbp_locations(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_gbp_store_code     ON gbp_locations(store_code);
CREATE INDEX IF NOT EXISTS idx_audit_performed_at ON audit_logs(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action       ON audit_logs(action);

-- ── Disable Row Level Security (internal tool — no public access) ─
ALTER TABLE gbp_snapshots       DISABLE ROW LEVEL SECURITY;
ALTER TABLE gbp_locations       DISABLE ROW LEVEL SECURITY;
ALTER TABLE tracker_locations   DISABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE export_history      DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs          DISABLE ROW LEVEL SECURITY;
