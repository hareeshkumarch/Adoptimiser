# Probe: run deep agent N times, report status, timeouts, narrative tail (iteration 2 truncation check)
import os, sys, time, requests
API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api/v1"
n = int(sys.argv[1]) if len(sys.argv) > 1 else 2
q = sys.argv[2] if len(sys.argv) > 2 else "TEST_ full cross-channel audit of waste and budget pacing"
for i in range(n):
    r = requests.post(f"{API}/deep-agent/run", json={"query": q})
    rid = r.json().get("run_id") or r.json()["detail"]["run_id"]
    t0 = time.time()
    while time.time() - t0 < 150:
        j = requests.get(f"{API}/deep-agent/runs/{rid}").json()
        if "run" not in j:
            time.sleep(2); continue
        run = j["run"]
        if run["status"] in ("completed", "failed", "error"):
            break
        time.sleep(3)
    cps = (run.get("graph_meta") or {}).get("checkpoints") or []
    cb = (run.get("graph_meta") or {}).get("circuit_breaker_events")
    durs = {c["node"]: c["duration_ms"] for c in cps if c["node"] in ("critic", "orchestrator")}
    nar = run.get("narrative") or ""
    print(f"RUN {rid} status={run['status']} took={time.time()-t0:.0f}s durs={durs} cb={cb} len={len(nar)}")
    print("  TAIL:", repr(nar[-160:]))
    print("  BUDGET mentions:", [s for s in nar.split(".") if "budget" in s.lower()][:3])
