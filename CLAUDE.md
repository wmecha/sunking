# CLAUDE.md — Sun King GBP tool

See **`AGENTS.md`** for the full agent guide (shared across Claude Code, Codex, Hermes).

## Skill: `gbp-reconcile`
When the user uploads/points to a new `Sun King Shops-*.csv` Google Account export — or
asks to reconcile locations / sync the tracker / refresh the dashboard — use the
**`gbp-reconcile`** skill (`.claude/skills/gbp-reconcile/SKILL.md`). It updates the
Master Tracker sheet from the export, mirrors the Supabase DB to the sheet exactly,
and refreshes the Summary Dashboard.

Key rules: sheet = source of truth; DB mirrors it; the newest CSV export decides the
adjustments; never merge duplicates (flag column L); write store codes RAW; escalate-to-Google
links go to `https://support.google.com/business/gethelp`. Requires the Composio MCP
(`googlesheets`, `admin@wallacemecha.com`) and `DATABASE_URL` in `.env.local` (Supabase
pooler `aws-1-eu-west-1`).

Improve the skill freely and `git push` — other harnesses pull it.
