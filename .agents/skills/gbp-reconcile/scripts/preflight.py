#!/usr/bin/env python3
"""Read-only readiness checks before a Sun King GBP reconcile.

This script validates local setup only. It does not call Google Sheets, Supabase,
or Composio, and it does not print secrets.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[4]
EXPECTED_DB_HOST = "aws-1-eu-west-1.pooler.supabase.com"
EXPECTED_DB_PORT = 5432


def result(ok: bool, label: str, detail: str = "") -> bool:
    mark = "OK " if ok else "ERR"
    print(f"[{mark}] {label}" + (f" - {detail}" if detail else ""))
    return ok


def warn(label: str, detail: str = "") -> None:
    print(f"[WARN] {label}" + (f" - {detail}" if detail else ""))


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def check_database_url() -> bool:
    env_path = ROOT / ".env.local"
    env = read_env(env_path)
    db_url = env.get("DATABASE_URL", "")
    if not result(env_path.exists(), ".env.local exists", str(env_path)):
        return False
    if not result(bool(db_url), "DATABASE_URL is set"):
        return False

    parsed = urlparse(db_url)
    ok_host = parsed.hostname == EXPECTED_DB_HOST
    ok_port = (parsed.port or 5432) == EXPECTED_DB_PORT
    ok_scheme = parsed.scheme in {"postgres", "postgresql"}
    result(ok_scheme, "DATABASE_URL uses postgres scheme", parsed.scheme or "missing")
    result(ok_host, "DATABASE_URL uses aws-1 eu-west-1 pooler", parsed.hostname or "missing")
    result(ok_port, "DATABASE_URL uses port 5432", str(parsed.port or 5432))
    return ok_scheme and ok_host and ok_port


def check_codex_mcp() -> bool:
    config = Path.home() / ".codex" / "config.toml"
    if not result(config.exists(), "Codex config exists", str(config)):
        return False
    text = config.read_text(encoding="utf-8", errors="replace")
    has_section = re.search(r"(?im)^\[mcp_servers\.composio\]\s*$", text) is not None
    has_url = "mcp.composio.dev" in text or "connect.composio.dev/mcp" in text
    result(has_section, "Codex has [mcp_servers.composio]")
    result(has_url, "Codex Composio MCP URL is present")
    return has_section and has_url


def check_repo_mcp() -> bool:
    local = ROOT / ".mcp.json"
    example = ROOT / ".mcp.json.example"
    ok = True
    ok &= result(example.exists(), ".mcp.json.example exists", str(example))
    if local.exists():
        text = local.read_text(encoding="utf-8", errors="replace")
        ok &= result("mcp.composio.dev" in text and "<your-composio-mcp-server-id>" not in text, "repo .mcp.json has a real Composio endpoint")
    else:
        warn("repo .mcp.json is missing", "optional for Codex, useful for Claude/Hermes")
    return ok


def check_skill_files() -> bool:
    base = ROOT / ".agents" / "skills" / "gbp-reconcile"
    required = [
        base / "SKILL.md",
        base / "reference" / "structure.md",
        base / "scripts" / "parse_export.py",
        base / "scripts" / "reconcile_engine.py",
        base / "scripts" / "verify.py",
    ]
    return all(result(path.exists(), f"{path.relative_to(ROOT)} exists") for path in required)


def main() -> int:
    print(f"Sun King GBP reconcile preflight: {ROOT}")
    checks = [
        check_skill_files(),
        check_database_url(),
        check_codex_mcp(),
        check_repo_mcp(),
    ]
    print()
    if all(checks):
        print("READY: local files and configuration pointers are in place.")
        return 0
    print("NOT READY: fix the ERR items above before the next reconcile.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
