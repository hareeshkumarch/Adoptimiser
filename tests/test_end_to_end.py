import io
import json
import os
import pathlib
import subprocess
import sys
import tokenize
import unittest

import httpx

os.environ["USE_IN_MEMORY_DB"] = "1"
ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from server import app
from adintel.sandbox.seed import ensure_sandbox


class AdoptimiserEndToEndTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        await ensure_sandbox(force=False)
        transport = httpx.ASGITransport(app=app)
        self.client = httpx.AsyncClient(transport=transport, base_url="http://test")

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_01_health_accounts_and_pulse_with_30d_series(self):
        hr = await self.client.get("/api/v1/health")
        self.assertEqual(hr.status_code, 200)
        self.assertEqual(hr.json()["status"], "ok")

        r = await self.client.get("/api/v1/accounts")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertGreaterEqual(len(body["accounts"]), 4)
        self.assertIn("USD", body["fx_to_usd"])

        for window in ("1d_click", "7d_click", "data_driven"):
            for compare in ("previous_period", "rolling_30d"):
                pr = await self.client.get("/api/v1/pulse", params={"window": window, "compare": compare})
                self.assertEqual(pr.status_code, 200)
                pdata = pr.json()
                self.assertEqual(len(pdata["kpis"]), 8)
                self.assertEqual(len(pdata["platforms"]), 4)
                self.assertEqual(len(pdata["series"]), 30)
                self.assertIn("cpa_z", pdata["series"][-1])
                self.assertGreater(pdata["store"]["orders"], 0)

    async def test_02_hierarchical_breakdown_drilldown(self):
        for level in ("platform", "campaign", "adset", "creative"):
            r = await self.client.get("/api/v1/breakdown", params={"level": level, "window": "7d_click"})
            self.assertEqual(r.status_code, 200)
            rows = r.json()["rows"]
            self.assertGreater(len(rows), 0)

        r_camp = await self.client.get("/api/v1/breakdown", params={"level": "adset", "platform": "meta", "campaign": "Prospecting · Advantage+"})
        self.assertEqual(r_camp.status_code, 200)
        adsets = r_camp.json()["rows"]
        self.assertEqual(len(adsets), 2)

        r_cre = await self.client.get("/api/v1/breakdown", params={"level": "creative", "platform": "meta", "adset_id": adsets[0]["id"]})
        self.assertEqual(r_cre.status_code, 200)
        creatives = r_cre.json()["rows"]
        self.assertEqual(len(creatives), 2)

    async def test_03_recursion_safe_langgraph_and_realtime_progress(self):
        topo_r = await self.client.get("/api/v1/deep-agent/graph")
        self.assertEqual(topo_r.status_code, 200)
        topo = topo_r.json()
        self.assertEqual(topo["control_plane"]["max_supersteps"], 12)
        self.assertEqual(topo["control_plane"]["recursion_limit"], 16)
        node_ids = {n["id"] for n in topo["nodes"]}
        self.assertEqual(
            node_ids,
            {"router", "planner", "ingestion", "anomaly", "attribution", "forensics", "critic", "deep_dive", "optimizer", "orchestrator"},
        )

        start_r = await self.client.post(
            "/api/v1/deep-agent/run",
            json={"query": "Isolate creative fatigue and 3s hook drop-off on video ad sets", "scope": {"platform": None, "account_id": None}, "window": "7d_click"},
        )
        self.assertEqual(start_r.status_code, 202)
        run_id = start_r.json()["run_id"]

        ev_r = await self.client.get(f"/api/v1/deep-agent/runs/{run_id}/events")
        self.assertEqual(ev_r.status_code, 200)
        events = []
        for block in ev_r.text.split("\n\n"):
            for line in block.splitlines():
                if line.startswith("data: "):
                    events.append(json.loads(line[6:]))
        progress_events = [e for e in events if e["type"] == "agent_progress"]
        self.assertGreaterEqual(len(progress_events), 10)
        self.assertEqual(progress_events[-1]["percentage"], 100)
        self.assertIn("recursion_guard", progress_events[-1])
        self.assertIn("Superstep", progress_events[-1]["recursion_guard"]["superstep_label"])

        run_r = await self.client.get(f"/api/v1/deep-agent/runs/{run_id}")
        self.assertEqual(run_r.status_code, 200)
        run = run_r.json()["run"]
        self.assertEqual(len(run["findings"]), 5)
        self.assertEqual(len(run["rejected"]), 1)
        self.assertEqual(len(run["prescriptions"]), 5)
        self.assertEqual(len(run["forensics"]), 4)
        self.assertEqual(len(run["curves"]["meta"]["grid"]), 13)
        self.assertEqual(run["graph_meta"]["max_supersteps"], 12)
        self.assertEqual(len(run["graph_meta"]["checkpoints"]), 10)

    async def test_04_multi_step_connection_wizard_and_60d_backfill(self):
        cand_r = await self.client.get("/api/v1/connectors/meta/candidates")
        self.assertEqual(cand_r.status_code, 200)
        cands = cand_r.json()
        self.assertIn("ads_read", cands["scopes"])
        unlinked = [c["account_id"] for c in cands["candidates"] if not c["already_linked"]]
        self.assertIn("act_884920", unlinked)

        wiz_r = await self.client.post("/api/v1/connectors/meta/wizard-connect", json={"account_ids": ["act_884920", "act_221048"]})
        self.assertEqual(wiz_r.status_code, 200)
        wiz = wiz_r.json()
        self.assertGreater(wiz["backfilled_rows"], 0)
        self.assertEqual(wiz["partitions_synced"], 6)
        conn_id = wiz["connection"]["connection_id"]
        self.assertIn("act_221048", wiz["connection"]["skipped_accounts"])

        acc_r = await self.client.get("/api/v1/accounts")
        acc_ids = {a["account_id"] for a in acc_r.json()["accounts"]}
        self.assertIn("act_884920", acc_ids)

        pulse_r = await self.client.get("/api/v1/pulse", params={"platform": "meta", "account_id": "act_884920"})
        self.assertEqual(pulse_r.status_code, 200)
        self.assertEqual(len(pulse_r.json()["kpis"]), 8)

        sync_r = await self.client.post(f"/api/v1/connections/{conn_id}/sync")
        self.assertEqual(sync_r.status_code, 200)
        self.assertEqual(sync_r.json()["status"], "synced_active")

        del_r = await self.client.delete(f"/api/v1/connections/{conn_id}")
        self.assertEqual(del_r.status_code, 200)

    async def test_05_typescript_transpilation_docker_no_emergent_no_comments(self):
        self.assertFalse((ROOT / ".emergent").exists())
        for path in ("backend/Dockerfile", "frontend/Dockerfile", "frontend/nginx.conf", "docker-compose.yml", ".env", ".env.example", "backend/.env", "frontend/.env", "backend/.dockerignore", "frontend/.dockerignore"):
            self.assertTrue((ROOT / path).exists(), f"Missing {path}")

        for f in ROOT.rglob("*"):
            if f.is_file() and f.name != "test_end_to_end.py" and f.suffix in (".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".html", ".yml", ".md", ".conf"):
                text = f.read_text(errors="ignore").lower()
                self.assertNotIn("emergent", text, f"Found emergent reference in {f}")

        for py_file in (ROOT / "backend").rglob("*.py"):
            tokens = list(tokenize.generate_tokens(io.StringIO(py_file.read_text()).readline))
            comments = [t for t in tokens if t.type == tokenize.COMMENT]
            self.assertEqual(len(comments), 0, f"Found comments in {py_file}")

        for ts_file in (ROOT / "frontend/src").rglob("*"):
            if ts_file.suffix in (".ts", ".tsx", ".js", ".jsx"):
                for line in ts_file.read_text().splitlines():
                    self.assertFalse(line.lstrip().startswith("//"), f"Found comment in {ts_file}: {line}")

        node_script = """
        const babel = require("@babel/core");
        const fs = require("fs");
        const path = require("path");
        const exts = [".ts", ".tsx", ".js", ".jsx"];
        function walk(dir) {
          let out = [];
          for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) out = out.concat(walk(p));
            else if (exts.includes(path.extname(e.name))) out.push(p);
          }
          return out;
        }
        const files = walk(process.argv[1]);
        for (const f of files) {
          const code = fs.readFileSync(f, "utf8");
          babel.transformSync(code, {
            filename: f,
            presets: [
              ["@babel/preset-typescript", { isTSX: f.endsWith(".tsx") || f.endsWith(".jsx"), allExtensions: true }],
              ["@babel/preset-react", { runtime: "automatic" }],
            ],
          });
        }
        console.log("TS_OK:" + files.length);
        """
        proc = subprocess.run(
            ["node", "-e", node_script, str(ROOT / "frontend/src")],
            env={**os.environ, "NODE_PATH": "/usr/share/nodejs"},
            capture_output=True,
            text=True,
            check=True,
        )
        self.assertIn("TS_OK:102", proc.stdout)

    async def test_06_edge_cases_and_db_operator_parity(self):
        import pandas as pd
        from adintel.db import db
        from adintel.diagnostics.anomaly import window_stats, spike_scan
        from adintel.diagnostics.attribution import claimed_vs_store, lagged_correlation, overlap_shift, detect_overlap
        from adintel.diagnostics.optimizer import response_curves, solve_portfolio_allocation
        from adintel.diagnostics.verification import Evidence, run_checks, verdict

        empty_df = pd.DataFrame(columns=["date", "platform", "account_id", "campaign", "adset_id", "adset", "creative_id", "creative", "spend", "impressions", "clicks", "conversions", "revenue", "hook_rate", "hold_rate", "frequency", "is_lost", "lp_cvr", "cpa", "roas", "ctr", "cpm", "cpc"])
        empty_store = pd.DataFrame(columns=["date", "revenue", "orders"])
        self.assertEqual(window_stats(empty_df), [])
        self.assertEqual(spike_scan(empty_df, set()), [])
        self.assertTrue(claimed_vs_store(empty_df, empty_store).empty)
        self.assertIsNone(lagged_correlation(empty_df))
        shift = overlap_shift(pd.DataFrame())
        self.assertIsNone(detect_overlap(shift, None, empty_df))
        self.assertEqual(response_curves(empty_df), {})
        self.assertEqual(solve_portfolio_allocation({})["total_spend"], 0.0)
        ev = Evidence(metrics=empty_df, store=empty_store)
        checks = run_checks(ev, {"kind": "creative_fatigue", "entity_ids": [], "recent_start": "2026-01-10", "base_start": "2026-01-01", "end": "2026-01-15"})
        status, conf = verdict({"kind": "creative_fatigue"}, checks)
        self.assertEqual(status, "rejected")
        self.assertGreater(conf, 0.0)

        wiz_r = await self.client.post("/api/v1/connectors/meta/wizard-connect", json={"account_ids": ["act_884920"]})
        self.assertEqual(wiz_r.status_code, 200)
        conn_id = wiz_r.json()["connection"]["connection_id"]

        await ensure_sandbox(force=True)
        preserved = await db.metrics_daily.count_documents({"account_id": "act_884920"})
        self.assertGreater(preserved, 0)

        docs = await db.metrics_daily.find(
            {"account_id": {"$in": ["act_884920"]}, "spend": {"$gte": 0}},
            {"_id": 0, "account_id": 1},
        ).to_list(5)
        self.assertGreater(len(docs), 0)

        await self.client.delete(f"/api/v1/connections/{conn_id}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
