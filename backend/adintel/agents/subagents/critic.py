import pandas as pd

from adintel.agents.base import SubAgent
from adintel.agents.prompts import CRITIC_SYSTEM, build_critic_review_prompt
from adintel.agents.state import RunState
from adintel.analytics.metrics import jsonable
from adintel.diagnostics.verification import CHECKS, REJECTION_REASON, Evidence, verdict

CANDIDATE_FILES = ["/anomaly/candidates.json", "/attribution/candidates.json"]
DATE_FIELDS = ("recent_start", "base_start", "end")


def _rehydrate(finding: dict) -> dict:
    out = dict(finding)
    for key in DATE_FIELDS:
        out[key] = pd.Timestamp(out[key])
    if "dates" in out:
        out["dates"] = [pd.Timestamp(d) for d in out["dates"]]
    return out


class CriticAgent(SubAgent):
    name = "critic"
    title = "Adversarial Verifier & Critic"
    mandate = "Challenge every candidate in a second pass, rule out tracking drops, broken landing pages and auction pressure, filter false positives."

    async def _verify(self, state: RunState, evidence: Evidence, finding: dict) -> dict:
        checks = []
        for check in CHECKS[finding["kind"]]:
            result = await state.call_tool(
                self.name, check.__name__, {"finding": finding["id"]},
                lambda c=check: c(evidence, finding),
                lambda r: f"{'PASS' if r['passed'] else 'FAIL'} · {r['detail']}",
            )
            checks.append(result)
        status, confidence = verdict(finding, checks)
        return {**finding, "status": status, "confidence": confidence, "critic": {"checks": checks}}

    async def _review(self, state: RunState, findings: list[dict]) -> dict:
        payload = [{"id": f["id"], "title": f["title"], "headline": f["headline"], "entity": f["entity_name"], "status": f["status"], "confidence": f["confidence"],
                    "evidence": [e["label"] for e in f["evidence"]], "checks": [{"label": c["label"], "passed": c["passed"], "detail": c["detail"]} for c in f["critic"]["checks"]]} for f in findings]
        prompt = build_critic_review_prompt(jsonable(payload))
        result = await state.call_tool(
            self.name, "adversarial_llm_review", {"findings": len(findings)},
            lambda: self.llm.complete_json(self.session(state), CRITIC_SYSTEM, prompt),
            lambda r: f"{len(r.get('reviews', []))} adversarial reviews",
        )
        return {r["id"]: r for r in result.get("reviews", []) if "id" in r}

    async def run(self, state: RunState) -> None:
        candidates = [_rehydrate(f) for path in CANDIDATE_FILES for f in state.read_file(path)]
        evidence = Evidence(state.frames["metrics"], state.frames["store"])
        verified = [await self._verify(state, evidence, f) for f in candidates]
        reviews = await self._review(state, verified) if verified else {}
        confirmed, rejected = [], []
        for f in verified:
            review = reviews.get(f["id"], {})
            adjustment = max(-0.15, min(0.05, float(review.get("adjustment", 0))))
            f["confidence"] = round(max(0.05, min(0.99, f["confidence"] + adjustment)), 3)
            f["critic"] |= {"challenge": review.get("challenge", ""), "rationale": review.get("rationale", "")}
            step = "verified" if f["status"] == "confirmed" else "rejected"
            f["evidence"] += [{"step": step, "agent": "critic", "label": f"{c['label']}: {c['detail']}"} for c in f["critic"]["checks"]]
            if f["status"] == "rejected":
                f["critic"]["rejection_reason"] = REJECTION_REASON.get(f["kind"], "Required verification checks failed.")
            (confirmed if f["status"] == "confirmed" else rejected).append(f)
            await state.emit("verdict", self.name, id=f["id"], status=f["status"], confidence=f["confidence"], title=f["title"], headline=f["headline"], challenge=f["critic"]["challenge"])
        confirmed.sort(key=lambda f: f["dollar_impact"] * f["confidence"], reverse=True)
        await state.write_file("/critic/verdicts.json", self.name, "json", [{"id": f["id"], "status": f["status"], "confidence": f["confidence"], "challenge": f["critic"]["challenge"], "rationale": f["critic"]["rationale"]} for f in verified])
        await state.write_file("/critic/confirmed.json", self.name, "json", confirmed)
        await state.write_file("/critic/rejected.json", self.name, "json", rejected)
