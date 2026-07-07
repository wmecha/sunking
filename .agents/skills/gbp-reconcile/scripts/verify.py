"""
Read-only consistency check (run in COMPOSIO_REMOTE_WORKBENCH). Confirms the
sheet's I/K/L counts equal the DB's, and (optionally) equal the export targets.
Set SS and DB (see reconcile_engine.py). No writes.
"""
import subprocess, sys, ssl
subprocess.run([sys.executable, "-m", "pip", "install", "-q", "pg8000"], check=False)
import pg8000.native

def _verify():
    def c(row, i): return row[i] if i < len(row) else ""
    def isT(v): return v is True or str(v).strip().upper() == "TRUE"
    r, _ = run_composio_tool(tool_slug="GOOGLESHEETS_BATCH_GET",
        arguments={"spreadsheet_id": SS,
                   "ranges": ["'Master Tracker'!I5:I1000", "'Master Tracker'!K5:K1000", "'Master Tracker'!L5:L1000", "'Master Tracker'!A5:A1000"],
                   "valueRenderOption": "UNFORMATTED_VALUE"})
    vr = r["data"]["valueRanges"]
    def count(idx): return sum(1 for row in vr[idx].get("values", []) if row and isT(row[0]))
    si, sk, sl = count(0), count(1), count(2)
    srows = sum(1 for row in vr[3].get("values", []) if row and str(c(row, 0)).strip())
    ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
    con = pg8000.native.Connection(ssl_context=ctx, **DB)
    di = con.run("SELECT COUNT(*) FROM tracker_locations WHERE UPPER(ov)='TRUE'")[0][0]
    dk = con.run("SELECT COUNT(*) FROM tracker_locations WHERE UPPER(ou)='TRUE'")[0][0]
    dl = con.run("SELECT COUNT(*) FROM tracker_locations WHERE duplicate_flag IS NOT NULL AND duplicate_flag<>''")[0][0]
    dt = con.run("SELECT COUNT(*) FROM tracker_locations")[0][0]
    con.close()
    print(f"SHEET  rows={srows}  OV(I)={si}  OU(K)={sk}  DUP(L)={sl}")
    print(f"DB     rows={dt}  OV={di}  OU={dk}  DUP={dl}")
    ok = (srows == dt and si == di and sk == dk and sl == dl)
    print("MATCH ✅" if ok else "MISMATCH ❌ — run reconcile_engine.py with APPLY=True")

_verify()
