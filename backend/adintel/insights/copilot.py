import json
import logging
import uuid
from datetime import datetime, timezone
from typing import AsyncIterator

from adintel.agents.llm import LlmGateway
from adintel.agents.orchestrator import GOAL_LABEL
from adintel.analytics.metrics import jsonable
from adintel.analytics.pulse import build_breakdown, build_pulse
from adintel.db import db
from adintel.insights.opportunities import build_opportunities
from adintel.insights.reach import build_reach
from adintel.models import Scope

logger = logging.getLogger(__name__)

COPILOT_SYSTEM = (
    "You are Quorum Copilot, a senior performance-marketing strategist with READ-ONLY access to the user's ad accounts "
    "(Meta, Google, TikTok, LinkedIn). You cannot change campaigns; you advise. Answer using ONLY the data snapshot provided. "
    "Be specific: name campaigns, ad sets and creatives, quote numbers, and give concrete next steps the user can do in the ad platform. "
    "When asked for creative ideas, give named concepts with a hook line, format and why it should work based on the data. "
    "Use short paragraphs and simple markdown lists with bold labels. Keep it under 260 words unless asked for more. "
    "Money values in the snapshot are USD."
)


async def build_context(scope: Scope) -> dict:
    pulse = await build_pulse(scope, "7d_click", "previous_period")
    ops = await build_opportunities(scope)
    creatives = (await build_breakdown(scope, "7d_click", "previous_period", "creative"))["rows"][:14]
    reach = await build_reach(scope)
    ws = await db.workspace.find_one({"key": "default"}, {"_id": 0}) or {}
    run = await db.agent_runs.find_one({"status": "completed"}, {"_id": 0, "findings": 1, "prescriptions": 1}, sort=[("created_at", -1)]) or {}
    pacing = dict(pulse["pacing"])
    if ws.get("monthly_budget") and not (scope.platform or scope.account_id):
        pacing["month_budget"] = ws["monthly_budget"]
        pacing["pace"] = pacing["projected_spend"] / ws["monthly_budget"] if pacing.get("projected_spend") else None
    goal = {k: ws.get(k) for k in ("goal", "target_roas", "monthly_budget", "business_name")}
    goal["goal"] = GOAL_LABEL.get(goal["goal"], goal["goal"])
    return jsonable({
        "goal": goal,
        "kpis_7d": {k["key"]: {"value": k["value"], "delta_pct": k["delta_pct"]} for k in pulse["kpis"]},
        "platforms_7d": pulse["platforms"],
        "pacing": pacing,
        "opportunities": [{k: o[k] for k in ("title", "why", "impact_usd", "category", "entity", "platform")} for o in ops["opportunities"][:10]],
        "weekday": ops["weekday"],
        "creatives_7d": [{k: c.get(k) for k in ("platform", "campaign", "adset", "name", "spend", "roas", "cpa", "ctr", "hook_rate", "hold_rate", "frequency")} for c in creatives],
        "reach": {"totals": reach.get("totals"), "sweet_spot": reach.get("sweet_spot"), "adsets": (reach.get("adsets") or [])[:8]},
        "verified_findings": [{"title": f.get("title"), "entity": f.get("entity_name"), "headline": f.get("headline"), "impact": f.get("dollar_impact")} for f in run.get("findings", [])[:6]],
        "top_prescriptions": [p.get("title") for p in run.get("prescriptions", [])[:5]],
    })


def _fallback(question: str, ctx: dict) -> str:
    ops = ctx.get("opportunities", [])[:3]
    lines = [f"Here is what the data says for: **{question}**", ""]
    for o in ops:
        lines.append(f"- **{o['title']}** \u2014 {o['why']} (~${o['impact_usd']:,.0f}/week)")
    lines.append("\nThe AI copilot is temporarily unavailable, so this answer is built from your ranked suggestions.")
    return "\n".join(lines)


async def ask_stream(llm: LlmGateway, question: str, scope: Scope, thread_id: str | None) -> AsyncIterator[dict]:
    thread_id = thread_id or uuid.uuid4().hex[:12]
    yield {"type": "thread", "thread_id": thread_id}
    yield {"type": "status", "label": "Reading your accounts"}
    ctx = await build_context(scope)
    history = await db.copilot_messages.find({"thread_id": thread_id}, {"_id": 0}).sort("created_at", 1).to_list(20)
    convo = "".join(f"{m['role'].upper()}: {m['content'][:900]}\n" for m in history[-6:])
    prompt = f"DATA SNAPSHOT (read-only):\n{json.dumps(ctx)}\n\n{('CONVERSATION SO FAR:' + chr(10) + convo) if convo else ''}USER QUESTION: {question}"
    yield {"type": "status", "label": "Thinking"}
    parts: list[str] = []
    try:
        async for chunk in llm.stream_live(f"copilot:{thread_id}", COPILOT_SYSTEM, prompt, max_tokens=4000):
            parts.append(chunk)
            yield {"type": "delta", "delta": chunk}
    except Exception as exc:
        logger.warning("copilot stream %s failed after %d chunks: %s", thread_id, len(parts), exc)
    if not "".join(parts).strip():
        text = _fallback(question, ctx)
        parts = [text]
        yield {"type": "delta", "delta": text}
    answer = "".join(parts)
    now = datetime.now(timezone.utc).isoformat()
    await db.copilot_messages.insert_many([
        {"thread_id": thread_id, "role": "user", "content": question, "created_at": now},
        {"thread_id": thread_id, "role": "assistant", "content": answer, "created_at": now},
    ])
    yield {"type": "done", "thread_id": thread_id}
