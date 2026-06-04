# Sun King — Agent Guide (Claude Code · Codex · Hermes)

Internal tool that reconciles ~486 Google Business Profile locations across three
systems: the **Master Tracker Google Sheet** (source of truth), the **Google
Account CSV export** (drives adjustments), and the **Supabase app DB** (mirrors the
sheet). Next.js 14 + Supabase (postgres.js) + Composio.

## Skills in this repo (portable across harnesses — push here, pull there)

### `gbp-reconcile`  → `.claude/skills/gbp-reconcile/SKILL.md`
Run it **whenever a new `Sun King Shops-*.csv` Google export is provided**, or when
asked to "reconcile / sync the tracker / refresh the dashboard". It updates the
sheet (I=Owned&Verified, K=Owned&Unverified, L=DUPLICATE) from the export, mirrors
the DB to the sheet exactly, and refreshes the Summary Dashboard. Full playbook,
column map, and gotchas are in that folder. Scripts:
- `scripts/parse_export.py` — local CSV parse + diff (stdlib).
- `scripts/reconcile_engine.py` — sheet→DB exact-mirror (runs in the Composio workbench via pg8000).
- `scripts/verify.py` — read-only consistency check.
- `reference/structure.md` — sheet/DB/dashboard layout + hard-won gotchas.

**Codex / Hermes:** these harnesses don't auto-load `.claude/skills`, so treat the
SKILL.md as the procedure to follow — read `.claude/skills/gbp-reconcile/SKILL.md`
when the trigger above fires, and run the scripts the same way.

## Required setup in every harness
1. **Composio MCP** with the `googlesheets` toolkit connected as `admin@wallacemecha.com`
   (alias `sunking-master-tracker`). The reconcile uses Composio for all sheet I/O and
   runs DB work inside the Composio remote workbench (`pip install pg8000`).
   - Add it from the same Composio account used here. See `.mcp.json.example` for the
     Claude Code shape; for Codex add the equivalent under its MCP config
     (`~/.codex/config.toml` → `[mcp_servers.composio]`); for Hermes, add the same
     remote MCP URL in its MCP settings. **Paste your Composio MCP URL/key** — it's
     tied to your account and is not committed here.
2. **`DATABASE_URL`** in `sunking/.env.local` (gitignored) pointing at the Supabase
   pooler **`aws-1-eu-west-1`** (not `aws-0`). The reconcile reads it from there.

## Conventions / guardrails
- Sheet = source of truth; DB mirrors it exactly; the newest CSV export decides the changes.
- Never merge duplicates — flag them (column L). Write store codes RAW (USER_ENTERED corrupts long numeric Place IDs).
- Dry-run destructive steps and show counts first.
- Escalate-to-Google links must point to `https://support.google.com/business/gethelp`.
- Commit improvements to the skill and **push to `origin/main`** so other harnesses pull them.
