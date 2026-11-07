# Quorum: insights (opportunities, reach, copilot SSE), workspace, and regression of pulse/deep-agent
import json
import os
import time

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api/v1"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    return sess


@pytest.fixture(scope="module", autouse=True)
def restore_workspace(s):
    original = s.get(f"{API}/workspace").json()["workspace"]
    yield
    body = {
        "goal": original.get("goal") or "cut_waste",
        "business_name": original.get("business_name"),
        "target_roas": original.get("target_roas"),
        "monthly_budget": original.get("monthly_budget"),
        "onboarded": True,
    }
    s.put(f"{API}/workspace", json=body)


# --- Opportunities ---
class TestOpportunities:
    def test_opportunities_structure(self, s):
        r = s.get(f"{API}/insights/opportunities")
        assert r.status_code == 200
        d = r.json()
        assert d["summary"]["count"] == len(d["opportunities"])
        assert d["summary"]["count"] > 0
        assert isinstance(d["summary"]["weekly_upside"], (int, float))
        o = d["opportunities"][0]
        for k in ("id", "category", "title", "why", "impact_usd", "agent_query", "ask_prompt", "rank"):
            assert k in o
        assert len(d["weekday"]) == 7
        cats = d["summary"]["categories"]
        for c, n in cats.items():
            assert n == sum(1 for x in d["opportunities"] if x["category"] == c)

    def test_opportunities_sorted_by_rank(self, s):
        d = s.get(f"{API}/insights/opportunities").json()
        ranks = [o["rank"] for o in d["opportunities"]]
        assert ranks == sorted(ranks)

    @pytest.mark.parametrize("platform", ["meta", "google", "tiktok", "linkedin"])
    def test_opportunities_platform_scope(self, s, platform):
        r = s.get(f"{API}/insights/opportunities", params={"platform": platform})
        assert r.status_code == 200
        d = r.json()
        for o in d["opportunities"]:
            assert o.get("platform") in (platform, None, "all", "cross", "multi")

    def test_opportunities_account_scope(self, s):
        r = s.get(f"{API}/insights/opportunities", params={"platform": "meta", "account_id": "act_221048"})
        assert r.status_code == 200


# --- Reach ---
class TestReach:
    def test_reach_all(self, s):
        r = s.get(f"{API}/insights/reach")
        assert r.status_code == 200
        d = r.json()
        assert d["available"] is True
        assert d["totals"]["reach"] > 0
        assert len(d["adsets"]) > 0
        assert len(d["curve"]) > 0
        assert len(d["trend"]) > 0
        assert all(a["status"] in ("Saturated", "Tiring", "Room to grow") for a in d["adsets"])

    def test_reach_google_unavailable(self, s):
        r = s.get(f"{API}/insights/reach", params={"platform": "google"})
        assert r.status_code == 200
        assert r.json()["available"] is False

    def test_reach_meta_account(self, s):
        r = s.get(f"{API}/insights/reach", params={"platform": "meta", "account_id": "act_221048"})
        assert r.status_code == 200
        d = r.json()
        assert d["available"] is True
        assert all(a["platform"] == "meta" for a in d["adsets"])

    def test_reach_unknown_account(self, s):
        r = s.get(f"{API}/insights/reach", params={"account_id": "nope_000"})
        assert r.status_code in (200, 404)


# --- Workspace ---
class TestWorkspace:
    def test_put_and_get_workspace(self, s):
        body = {"goal": "grow_revenue", "business_name": "TEST_Biz", "target_roas": 3.5, "monthly_budget": 20000, "onboarded": True}
        r = s.put(f"{API}/workspace", json=body)
        assert r.status_code == 200
        assert r.json()["workspace"]["goal"] == "grow_revenue"
        g = s.get(f"{API}/workspace").json()["workspace"]
        assert g["business_name"] == "TEST_Biz"
        assert g["target_roas"] == 3.5
        assert g["onboarded"] is True
        assert "_id" not in g

    def test_put_invalid_goal(self, s):
        r = s.put(f"{API}/workspace", json={"goal": "bogus"})
        assert r.status_code == 422

    def test_put_invalid_roas(self, s):
        r = s.put(f"{API}/workspace", json={"goal": "cut_waste", "target_roas": 999})
        assert r.status_code == 422


# --- Copilot SSE ---
def _ask(s, question, thread_id=None, scope=None):
    events = []
    with s.post(f"{API}/insights/ask", json={"question": question, "thread_id": thread_id, "scope": scope or {}}, stream=True, timeout=120) as r:
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/event-stream")
        for line in r.iter_lines(decode_unicode=True):
            if line and line.startswith("data: "):
                events.append(json.loads(line[6:]))
    return events


class TestCopilot:
    def test_ask_stream_and_followup(self, s):
        ev = _ask(s, "Where am I wasting the most money?")
        types = [e["type"] for e in ev]
        assert types[0] == "thread"
        assert "delta" in types
        assert types[-1] == "done"
        tid = ev[0]["thread_id"]
        text = "".join(e.get("delta", "") for e in ev if e["type"] == "delta")
        assert len(text) > 40
        print("ANSWER1:", text[:300])
        ev2 = _ask(s, "Summarise your previous answer in one sentence.", thread_id=tid)
        assert ev2[0]["thread_id"] == tid
        t2 = "".join(e.get("delta", "") for e in ev2 if e["type"] == "delta")
        assert len(t2) > 10
        assert "temporarily unavailable" not in text, "LLM fallback used"

    def test_ask_validation(self, s):
        r = s.post(f"{API}/insights/ask", json={"question": "x"})
        assert r.status_code == 422


# --- Regression ---
class TestRegression:
    def test_pulse(self, s):
        r = s.get(f"{API}/pulse")
        assert r.status_code == 200
        assert "kpis" in r.json()

    def test_deep_agent_run(self, s):
        r = s.post(f"{API}/deep-agent/run", json={"query": "TEST_ quick diagnostic of waste"})
        assert r.status_code in (202, 409)
        if r.status_code == 202:
            rid = r.json()["run_id"]
        else:
            rid = r.json()["detail"]["run_id"]
        deadline = time.time() + 150
        status = None
        while time.time() < deadline:
            g = s.get(f"{API}/deep-agent/runs/{rid}")
            if g.status_code == 200:
                status = g.json()["run"].get("status")
                if status in ("completed", "failed", "error"):
                    break
            time.sleep(4)
        assert status == "completed", f"run status {status}"
