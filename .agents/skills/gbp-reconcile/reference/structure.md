# Reference — Sun King GBP tracker structure & gotchas

## Spreadsheet
- ID `1DGAHE9zJ3Dy2VVgs_Jx9lMKYeW4Ox8FLSK7nRgJzWVY`, tab **Master Tracker** (`sheetId 776833613`).
- Header on **row 4**, data **rows 5+**. Tabs: Summary Dashboard, Master Tracker, Store Locator, GBP Upload Sheet, Owned & Verified, ⏳ Awaiting Response, No Claim Option, Form Required, Coord Comparison, Pending & Flags. The non-tracker tabs are derived views (FILTER / per-cell refs into Master Tracker A:Y).

## Master Tracker columns (current, after the Z–AF cleanup → 25 cols A–Y)
| Col | Idx | Field | Notes |
|----|----|-------|-------|
| A | 0 | Store Code | Google Place ID once claimed, else internal SK code. Write RAW (numeric-looking → never USER_ENTERED). |
| B | 1 | Business Name | Google public name is canonical for matched listings. |
| C | 2 | Country | full name (Benin … Zambia), 11 countries |
| D | 3 | Location Type | Shop / Store / LPG Depot / Experience Center / Warehouse / Head Office |
| E | 4 | GBP Consolidation Issue Category | data-quality category; drives Issue-Category breakdown |
| F | 5 | Claiming Exercise Issue Category | `⏳ Awaiting Response`, `🚫 No Claim Option`, `✅ No Issue`, `✅ Newly Claimed` — drives claim status |
| G | 6 | Coord Flag | `✅ No Issue`, `📍 GMap Pin Wrong`, … |
| H | 7 | Phil Issue Notes | |
| **I** | 8 | **Owned & Verified** | boolean. = Google `Published`. |
| J | 9 | Business Video Needed | boolean |
| **K** | 10 | **Owned & Unverified** | boolean. = Google `Not published`. |
| **L** | 11 | **DUPLICATE** | boolean. = Google `Duplicate`. (Client added this; it drives the dashboard duplicate count.) |
| M / N | 12 / 13 | Phil Verified Lat / Lng | preferred coords |
| O / P | 14 / 15 | Store Loc Lat / Lng | |
| Q | 16 | Offset (km) | |
| R | 17 | Address Line 1 | |
| S | 18 | Phone | |
| T | 19 | Locality | → DB `city` |
| U | 20 | Tracker Status | workflow `✅ DONE` / `⬜ PENDING` (NOT in-account status) |
| V | 21 | Images? | client-added 2026-07 (`⬜ PENDING`/…) |
| W | 22 | Images link(s) | client-added 2026-07 |
| X | 23 | Google Maps Link | → DB `google_maps_url` |
| Y / Z | 24 / 25 | Google Maps Lat / Lng | |
| AA | 26 | Initial Claim Status | last column |

**Added 2026-07 (client):** V `Images?` and W `Images link(s)` — everything from the old V
onward shifted right by 2 (old V→X, W→Y, X→Z, Y→AA). Read `A5:AA1000`. If the engine
suddenly reports ~all rows UPDATE with `google_maps_url` diffs, re-check the header row —
that was the symptom when these columns appeared.

**Removed 2026-06-03** (don't reference): Z Action Taken, AA Claim Attempted Date, AB Claim Outcome, AC In Account Date, AD Claim Notes, AE (blank), AF Duplicate Flag (superseded by L). The app's `lib/sheet-sync.ts` no longer syncs `action_taken`.

## Status derivation (sheet → DB.tracker_status)
`F contains "awaiting response"` → **Submitted Claim Awaiting Response**;
`F contains "no claim option"` → **No claim Option**;
else `I (OV) = TRUE` → **In account verified**; else → **In account not verified**.
Account flags come from the export: Published→OV, Not published→OU, Duplicate→L (OV=OU=FALSE).

## DB (Supabase `tracker_locations`)
- Pooler **`aws-1-eu-west-1.pooler.supabase.com:5432`** (the `aws-0` subdomain in the old `DATABASE_URL` was the production-crash bug). `prepare:false`, SSL cert-verify off. `DATABASE_URL` lives in `sunking/.env.local` (gitignored).
- Mirror the sheet's shared fields; **preserve** DB-only fields: `logo_photo_url, cover_photo_url, other_photo_urls`, `latitude/longitude` when the sheet has none, `website`, `primary_category`, `monday_hours…sunday_hours`, `sheet_synced_at`.
- `lib/store-code-aliases.ts` maps superseded SK codes → claimed Google Place IDs (re-codes on claim). Add new pairs there as shops get claimed.

## Summary Dashboard
- Rows ~1–23 = the client's **Live Progress** block (TOTAL / IN ACCOUNT / VERIFIED / VERIFICATION-IN-PROGRESS / DUPLICATE / NOT-IN-ACCOUNT / SUBMITTED / NO-CLAIM) + per-country table. Driven by I/K/L/F. Since 2026-07-07: `D3` counts K directly (was `=E3+F3`), `G3 = A3-B3`, D-column labels renamed to "VERIFICATION IN PROGRESS (COUNTRY-LED)".
- Rows 25–48 = **Executive Summary block** (added 2026-07-07): KPI row 28/29 (total / verified / in-progress / combined / claims / no-claim / removed-dups / other), pipeline-by-country table rows 33–42 (static values from the email-derived workflow), immediate-actions rows 44–48. Chart helper ranges: `K28:L31` (status pie), `K33:L38` (pipeline categories bar), `P28:S39` (country column chart) — three floating charts anchored nearby.
- Rows 50+ = original analysis (headline, Issue-Category breakdown on col E, coordinate-offset per-country). Kept and made accurate.
- **`Verification Pipeline` tab** (sheetId `571502052`, added 2026-07-07): rows 4–33 = the 29 in-progress locations × 22 workflow fields (liaison, verifier, access dates, waiting-period end, blocker, next action, follow-up, priority, status); rows 36–40 = the 3 listings Google removed as duplicates (Luwero `05638313038998589285`, Bangwe `12422060149163512049`, Wote `SKKE159` — rows kept in Master Tracker with L cleared, ownership process required); rows 43–70 = team action tracker; rows 73–85 = follow-up queue. Update it from the country email threads whenever statuses move; the 29 rows correspond exactly to the K=TRUE rows in Master Tracker.
- **Gotcha — truncated ranges:** formulas have hardcoded end rows; we've found `482, 490, 499, 599, 991`. Normalize every `'Master Tracker'!<col>5:<col><END>` to `991`. Numbers under-count otherwise.
- **Gotcha — Issue-Category sum:** must equal TOTAL; set stray/blank col-E rows to `No Issues Detected` (or the real category, e.g. `MISSING ADDRESS LINE 1` when col R blank).

## Composio
- `googlesheets` toolkit, connection `admin@wallacemecha.com` (alias `sunking-master-tracker`). Tools: `GOOGLESHEETS_BATCH_GET`, `GOOGLESHEETS_UPDATE_VALUES_BATCH` (RAW for codes/booleans), `GOOGLESHEETS_DELETE_DIMENSION`, `GOOGLESHEETS_INSERT_DIMENSION`, `GOOGLESHEETS_GET_SPREADSHEET_INFO`. Rate limit ~60 reads / 60 writes per minute.
- The remote workbench (`COMPOSIO_REMOTE_WORKBENCH`) can `pip install pg8000` and connect to Supabase — use it to run `reconcile_engine.py` so sheet + DB work happen in one place.
