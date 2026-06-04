#!/usr/bin/env python3
"""Parse a Sun King Google Account CSV export and (optionally) diff it against a
previous export. Stdlib only — runs in any harness via Bash.

Usage:
    python parse_export.py <new_export.csv> [<previous_export.csv>]

Prints:
    - status counts (Published / Not published / Duplicate) + unique codes
    - if a previous export is given: codes ADDED, REMOVED, and STATUS-CHANGED
These are the exact adjustments to apply to the sheet (I/K/L) and then mirror to the DB.
"""
import csv, sys, json

def load(path):
    g, counts = {}, {}
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            code = (row.get("Shop code") or "").strip().upper()
            status = (row.get("Status") or "").strip()
            counts[status] = counts.get(status, 0) + 1
            if code:
                g[code] = {"status": status,
                           "name": row.get("Business name", ""),
                           "country": row.get("Country/Region", ""),
                           "locality": row.get("Locality", "")}
    return g, counts

def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    new, ncnt = load(sys.argv[1])
    print("NEW export:", sys.argv[1])
    print("  status counts:", ncnt, "| unique codes:", len(new))
    pub = sum(1 for v in new.values() if v["status"] == "Published")
    npub = sum(1 for v in new.values() if v["status"] == "Not published")
    dup = sum(1 for v in new.values() if v["status"] == "Duplicate")
    print(f"  targets -> Owned&Verified(I)={pub}  Owned&Unverified(K)={npub}  DUPLICATE(L)={dup}  in-account={pub+npub+dup}")

    if len(sys.argv) >= 3:
        old, _ = load(sys.argv[2])
        added = sorted(set(new) - set(old))
        removed = sorted(set(old) - set(new))
        changed = [(c, old[c]["status"], new[c]["status"]) for c in (set(new) & set(old)) if old[c]["status"] != new[c]["status"]]
        print("\nDIFF vs", sys.argv[2])
        print(f"  ADDED ({len(added)}):")
        for c in added: print(f"    + {c}  {new[c]['status']}  {new[c]['name']}")
        print(f"  REMOVED ({len(removed)}):")
        for c in removed: print(f"    - {c}  {old[c]['status']}  {old[c]['name']}")
        print(f"  STATUS CHANGED ({len(changed)}):")
        for c, o, n in changed: print(f"    ~ {c}  {o} -> {n}  {new[c]['name']}")

    # machine-readable map for downstream steps
    out = {c: v["status"] for c, v in new.items()}
    with open("_gbp_status.json", "w", encoding="utf-8") as f:
        json.dump(out, f)
    print("\nwrote _gbp_status.json (code -> status) for downstream steps")

if __name__ == "__main__":
    main()
