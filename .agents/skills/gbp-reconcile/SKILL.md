---
name: gbp-reconcile
description: >-
  Reconcile Sun King Google Business Profile locations across the three systems
  (Master Tracker Google Sheet, the Google Account CSV export, and the Supabase
  app DB) and refresh the Summary Dashboard. TRIGGER when the user uploads / points
  to a new "Sun King Shops-*.csv" Google Account export, or says "reconcile the
  locations / GBP sync / update the tracker from the export / sync the dashboard".
  Source of truth = the Master Tracker sheet; the DB is made to mirror it exactly;
  the new CSV export determines the adjustments applied to both.
---

# GBP Location Reconciliation (Sun King)

Portable skill — works in any harness (Claude Code, Codex, Hermes) that has the
**Composio MCP** (`googlesheets` toolkit, connected as `admin@wallacemecha.com`)
and network access to Supabase. All sheet I/O goes through Composio; the DB is
reached from the Composio **remote workbench** via `pg8000`. Nothing here needs a
local Google service account.

## Golden rules (decided with the client)
1. **Master Tracker sheet = source of truth.** The Supabase DB is made to match it **exactly** (same rows, same shared-field values). DB-only fields (photos, etc.) are preserved.
2. **The newest Google CSV export determines the adjustments.** It is authoritative for account state: `Published → Owned&Verified`, `Not published → Owned&Unverified`, `Duplicate → DUPLICATE`. Listings absent from the export are claim-pending (driven by the sheet's Claiming Exercise Issue Category).
3. **Never merge duplicates** — flag them (column L `DUPLICATE = TRUE`). If Google removes a duplicate listing in a later export, clear the flag / drop the stale row.
4. **Write store codes as RAW**, never USER_ENTERED — long numeric Place IDs corrupt to scientific notation otherwise (we have repaired this twice).
5. Dry-run every destructive step (DB delete/overwrite, sheet column delete, formula rewrites); show counts before applying.

## Key facts
- **Spreadsheet ID:** `1DGAHE9zJ3Dy2VVgs_Jx9lMKYeW4Ox8FLSK7nRgJzWVY`  · tab **`Master Tracker`** (`sheetId 776833613`), header row **4**, data rows **5+**.
- **Supabase:** pooler host **`aws-1-eu-west-1.pooler.supabase.com`** (NOT `aws-0` — that bug crashed prod), port 5432, db `postgres`, user `postgres.bzpeyrhkfjbdjojkaetr`, `prepare:false`, SSL with cert-verify OFF. Get the full `DATABASE_URL` from `sunking/.env.local` (gitignored) — do not hardcode the password in committed code.
- **Master Tracker column map (current, A–AA):** see `reference/structure.md` (client added V `Images?` / W `Images link(s)` in 2026-07; Maps Link is now **X**, Maps Lat/Lng **Y/Z**, Initial Claim Status **AA**). The reconciliation-driving columns are: **I = Owned & Verified (bool)**, **K = Owned & Unverified (bool)**, **L = DUPLICATE (bool)**, **F = Claiming Exercise Issue Category** (`⏳ Awaiting Response`, `🚫 No Claim Option`, `✅ No Issue`, …).
- **Live targets from the latest export (2026-07-07 / file 170616):** Published 415 only → sheet I=415, K=29, L=0; outside account 92 (submitted 84 + no-claim 2 + 3 Google-removed duplicates + 3 other); total tracked 536.
- **The 29 K=TRUE rows are the country-led verification pipeline** (moved into per-location Google location groups 22–29 Jun 2026; central account stays Primary Owner, so they no longer appear in the central export). They are "verification in progress", NOT plain unverified, and NOT complete until Published in a later export. Detail lives on the **`Verification Pipeline` tab**; keep it and the Summary Dashboard exec block (rows 25–48) in sync with the country email threads.

## Workflow (run in order)

### 0. Parse & diff the new export
Run locally: `python .claude/skills/gbp-reconcile/scripts/parse_export.py <new.csv> [<prev.csv>]`.
It prints status counts (Published / Not published / Duplicate), unique codes, and — if a previous export is given — codes added, removed, and status-changed. This tells you exactly what to apply.

### 1. Update the sheet (source of truth) from the export — via Composio
For each store code in the export, set the sheet's **I/K/L** to match its status
(Published→I TRUE,K FALSE,L FALSE · Not published→I FALSE,K TRUE,L FALSE · Duplicate→I FALSE,K FALSE,L TRUE).
For listings **removed** from the export that were duplicates, delete the stale sheet row (or clear L). Use `GOOGLESHEETS_UPDATE_VALUES_BATCH` with **`valueInputOption: RAW`** and **boolean** values for I/K/L (the cells are checkboxes/booleans). Map each code to its row by reading column A first.

### 2. Make the DB mirror the sheet exactly — via the Composio workbench
Run `scripts/reconcile_engine.py` inside `COMPOSIO_REMOTE_WORKBENCH` (it `pip install`s `pg8000`, reads `'Master Tracker'!A5:Y1000`, derives each row, and UPSERTs the DB + deletes rows not in the sheet). Pass the `DATABASE_URL` you read from `.env.local`. It does a dry-run summary first; re-run with `APPLY=True`. Verify it ends with `OV / OU / DUPLICATE` matching the export. **Note the 180s workbench limit** — if it times out mid-loop, re-run; it's idempotent and only updates rows that still differ.

### 3. Refresh & verify the Summary Dashboard
The dashboard auto-calculates from the Master Tracker. Two recurring pitfalls to check:
- **Truncated formula ranges.** Many formulas have hardcoded end rows (we've seen `482, 490, 499, 599, 991`). Any `'Master Tracker'!<col><start>:<col><end>` whose end is below the data extent under-counts. Scan all dashboard formulas and normalize every Master Tracker range end to **`991`** (covers the ~487 data rows; sheet has 993 rows). Keep start row = 5.
- **Issue-Category breakdown must sum to the total.** Rows whose column **E** value isn't one of the listed categories fall out. Set blanks to `No Issues Detected` (or the real category, e.g. `MISSING ADDRESS LINE 1` if Address Line 1 / col R is blank).
Then read the top "Live Progress" block (rows ~1–23) and confirm it ties: `total = in-account (V+NV+DUP) + not-in-account (submitted+no-claim)`.

### 4. Report
Summarise: status deltas vs the previous export, sheet rows changed, DB rows updated/inserted/deleted, dashboard figures, and any data gaps surfaced (e.g. a blank address). Offer the Conflict-Map / escalation outputs if disputed-listing counts changed (escalation link: `https://support.google.com/business/gethelp`).

## Reference & scripts
- `reference/structure.md` — full column map, dashboard layout, status-derivation rules, known gotchas.
- `scripts/parse_export.py` — CSV parse + diff (local, stdlib only).
- `scripts/reconcile_engine.py` — sheet→DB exact-mirror engine (runs in the Composio workbench).
- `scripts/verify.py` — read-only consistency check (sheet I/K/L counts vs DB vs export).

## Updating this skill
This skill is committed to the repo (`.claude/skills/gbp-reconcile/`). Improve it freely and `git push`; other harnesses `git pull` to get the latest. See `AGENTS.md` (repo root) for how Codex/Hermes load it and the Composio MCP setup.
