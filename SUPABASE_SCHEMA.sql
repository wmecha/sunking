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
  city           TEXT,
  tracker_status TEXT,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

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
