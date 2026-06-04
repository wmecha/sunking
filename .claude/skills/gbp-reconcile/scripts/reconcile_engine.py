"""
Sheet -> DB exact-mirror engine for the Sun King GBP tracker.

RUN THIS INSIDE THE COMPOSIO REMOTE WORKBENCH (COMPOSIO_REMOTE_WORKBENCH), where
`run_composio_tool` is available and outbound network reaches Supabase. The
Master Tracker sheet is the source of truth; this makes tracker_locations match it
exactly (upsert all sheet rows, delete DB rows absent from the sheet), while
preserving DB-only fields (photos, etc.).

Before running, set:
    SS  = '1DGAHE9zJ3Dy2VVgs_Jx9lMKYeW4Ox8FLSK7nRgJzWVY'
    DB  = dict(user='postgres.bzpeyrhkfjbdjojkaetr', password='<from .env.local>',
              host='aws-1-eu-west-1.pooler.supabase.com', port=5432, database='postgres')
    APPLY = False   # set True to write; leave False for a dry-run summary

Master Tracker column indices (A=0 .. Y=24): 0 store_code, 1 business_name,
2 country, 3 location_type, 5 claiming_issue(F), 8 ov(I), 10 ou(K), 11 duplicate(L),
12/13 phil lat/lng, 14/15 storeloc lat/lng, 17 address(R), 18 phone(S), 19 locality(T),
21 maps_link(V), 22/23 maps lat/lng.
"""
import subprocess, sys, ssl
subprocess.run([sys.executable, "-m", "pip", "install", "-q", "pg8000"], check=False)
import pg8000.native

def _run():
    def c(row, i): return row[i] if i < len(row) else ""
    def s(v): return "" if v is None else str(v).strip()
    def bs(v): return "TRUE" if (v is True or s(v).upper() in ("TRUE", "YES", "1")) else "FALSE"
    def nf(*vs):
        for v in vs:
            try:
                if v not in (None, "") and s(v) != "": return round(float(v), 6)
            except Exception: pass
        return None
    def derive_status(F, ov, ou):
        f = s(F).lower()
        if "awaiting response" in f: return "Submitted Claim Awaiting Response"
        if "no claim option" in f: return "No claim Option"
        return "In account verified" if ov == "TRUE" else "In account not verified"

    r, _ = run_composio_tool(tool_slug="GOOGLESHEETS_BATCH_GET",
        arguments={"spreadsheet_id": SS, "ranges": ["'Master Tracker'!A5:Y1000"],
                   "valueRenderOption": "UNFORMATTED_VALUE"})
    rows = r["data"]["valueRanges"][0].get("values", [])
    targets = {}
    for row in rows:
        code = s(c(row, 0)).upper()
        if not code: continue
        ov, ou, dup = bs(c(row, 8)), bs(c(row, 10)), bs(c(row, 11))
        targets[code] = dict(
            store_code=s(c(row, 0)), business_name=s(c(row, 1)), country=s(c(row, 2)),
            location_type=s(c(row, 3)), claiming_issue=s(c(row, 5)), ov=ov, ou=ou,
            address=s(c(row, 17)), city=s(c(row, 19)), google_maps_url=s(c(row, 21)),
            primary_phone=s(c(row, 18)), latitude=nf(c(row, 12), c(row, 22), c(row, 14)),
            longitude=nf(c(row, 13), c(row, 23), c(row, 15)),
            tracker_status=derive_status(c(row, 5), ov, ou),
            duplicate_flag=("DUPLICATE" if dup == "TRUE" else ""))

    ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
    con = pg8000.native.Connection(ssl_context=ctx, **DB)
    fields = ["business_name", "country", "location_type", "claiming_issue", "ov", "ou",
              "address", "city", "google_maps_url", "primary_phone", "tracker_status", "duplicate_flag"]
    db = {}
    for row in con.run("SELECT UPPER(TRIM(store_code))," + ",".join(fields) + ",latitude,longitude FROM tracker_locations WHERE store_code IS NOT NULL"):
        d = {f: s(row[i + 1]) for i, f in enumerate(fields)}
        d["latitude"], d["longitude"] = nf(row[13]), nf(row[14]); db[row[0]] = d

    ins = [x for x in targets if x not in db]
    dele = [x for x in db if x not in targets]
    upd = []
    for code, t in targets.items():
        d = db.get(code)
        if d is None: continue
        if any(s(t[f]) != d[f] for f in fields) or nf(t["latitude"]) != d["latitude"] or nf(t["longitude"]) != d["longitude"]:
            upd.append(code)
    print(f"sheet rows={len(targets)} db rows={len(db)} | INSERT={len(ins)} DELETE={len(dele)} UPDATE={len(upd)}")
    print("  insert:", ins[:20]); print("  delete:", dele[:20])

    if APPLY:
        def write(code, t, insert):
            cols = "business_name,country,location_type,claiming_issue,ov,ou,address,city,google_maps_url,primary_phone,tracker_status,duplicate_flag,latitude,longitude"
            vals = dict(bn=t["business_name"] or None, co=t["country"] or None, lt=t["location_type"] or None,
                        ci=t["claiming_issue"] or None, ov=t["ov"], ou=t["ou"], ad=t["address"] or None,
                        c2=t["city"] or None, gm=t["google_maps_url"] or None, ph=t["primary_phone"] or None,
                        ts=t["tracker_status"] or None, df=t["duplicate_flag"] or None,
                        la=nf(t["latitude"]), ln=nf(t["longitude"]), code=t["store_code"])
            if insert:
                con.run("INSERT INTO tracker_locations (store_code," + cols + ") VALUES (:code,:bn,:co,:lt,:ci,:ov,:ou,:ad,:c2,:gm,:ph,:ts,:df,:la,:ln)", **vals)
            else:
                con.run("""UPDATE tracker_locations SET business_name=:bn,country=:co,location_type=:lt,claiming_issue=:ci,
                  ov=:ov,ou=:ou,address=:ad,city=:c2,google_maps_url=:gm,primary_phone=:ph,tracker_status=:ts,
                  duplicate_flag=:df,latitude=:la,longitude=:ln,updated_at=NOW() WHERE UPPER(TRIM(store_code))=:ucode""",
                  ucode=code, **vals)
        for code in upd: write(code, targets[code], insert=False)
        for code in ins: write(code, targets[code], insert=True)
        for code in dele: con.run("DELETE FROM tracker_locations WHERE UPPER(TRIM(store_code))=:c", c=code)
        tot = con.run("SELECT COUNT(*) FROM tracker_locations")[0][0]
        ov = con.run("SELECT COUNT(*) FROM tracker_locations WHERE UPPER(ov)='TRUE'")[0][0]
        ou = con.run("SELECT COUNT(*) FROM tracker_locations WHERE UPPER(ou)='TRUE'")[0][0]
        dp = con.run("SELECT COUNT(*) FROM tracker_locations WHERE duplicate_flag IS NOT NULL AND duplicate_flag<>''")[0][0]
        print(f"APPLIED. DB now rows={tot} OV={ov} OU={ou} DUPLICATE={dp}")
    else:
        print("DRY RUN — set APPLY=True to write. (Workbench 180s limit: if it times out mid-write, re-run; idempotent.)")
    con.close()

_run()
