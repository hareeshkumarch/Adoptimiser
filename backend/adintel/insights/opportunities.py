import asyncio

import numpy as np
import pandas as pd

from adintel.analytics.dataset import load_frame, load_store
from adintel.analytics.metrics import aggregate, apply_window, jsonable, split_periods
from adintel.db import db
from adintel.models import Scope

WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def _f(v) -> float:
    try:
        v = float(v)
    except (TypeError, ValueError):
        return 0.0
    return v if np.isfinite(v) else 0.0


def _usd(v: float) -> str:
    v = _f(v)
    if abs(v) >= 1_000_000:
        return f"${v / 1_000_000:.1f}M"
    if abs(v) >= 10_000:
        return f"${v / 1000:.1f}K"
    return f"${v:,.0f}"


def _opp(oid, category, title, why, impact, effort, confidence, entity, platform, evidence, agent_query, ask_prompt):
    return {
        "id": oid, "category": category, "title": title, "why": why, "impact_usd": round(max(0.0, impact), 2),
        "effort": effort, "confidence": round(confidence, 2), "entity": entity, "platform": platform,
        "evidence": evidence, "agent_query": agent_query, "ask_prompt": ask_prompt,
    }


def _creative_ops(cur: pd.DataFrame, base: pd.DataFrame, avg_roas: float) -> list[dict]:
    keys = ["platform", "campaign", "adset", "adset_id", "creative_id", "creative"]
    c = aggregate(cur, keys)
    b = aggregate(base, keys)[["creative_id", "hook_rate", "ctr", "cpa", "roas"]]
    m = c.merge(b, on="creative_id", how="left", suffixes=("", "_base"))
    out = []
    for r in m.to_dict("records"):
        hook, hook_b = _f(r["hook_rate"]), _f(r["hook_rate_base"])
        if hook and hook_b and hook < hook_b * 0.8:
            drop = 1 - hook / hook_b
            out.append(_opp(
                f"creative-refresh-{r['creative_id']}", "Creative", f"Refresh \u201c{r['creative']}\u201d before it burns more budget",
                f"3-second hook rate fell {drop:.0%} week over week ({hook_b:.0%} \u2192 {hook:.0%}) while it still takes {_usd(r['spend'])}/week.",
                _f(r["spend"]) * drop * 0.6, "Medium", 0.82, r["creative"], r["platform"],
                [f"Hook {hook_b:.1%} \u2192 {hook:.1%}", f"CTR {_f(r['ctr_base']):.2%} \u2192 {_f(r['ctr']):.2%}", f"CPA {_usd(r['cpa_base'])} \u2192 {_usd(r['cpa'])}"],
                f"Isolate creative fatigue and hook decay on {r['creative']} in {r['adset']}.",
                f"Write 3 fresh opening hooks to replace \u201c{r['creative']}\u201d on {r['platform']}, keeping what made it work originally.",
            ))
    winners = m[(m["roas"] > avg_roas * 1.1) & (m["spend"] > 0) & (m["hook_rate"].fillna(0) > 0)].sort_values("roas", ascending=False).head(2)
    for r in winners.to_dict("records"):
        out.append(_opp(
            f"creative-clone-{r['creative_id']}", "Creative", f"Clone the winning angle of \u201c{r['creative']}\u201d",
            f"Returns {_f(r['roas']):.2f}x vs your {avg_roas:.2f}x average. New variants on the same angle usually extend a winner's life.",
            _f(r["spend"]) * 0.15 * _f(r["roas"]) * 0.5, "Medium", 0.7, r["creative"], r["platform"],
            [f"ROAS {_f(r['roas']):.2f}x", f"Hook {_f(r['hook_rate']):.1%}" if _f(r["hook_rate"]) else f"CTR {_f(r['ctr']):.2%}", f"Spend {_usd(r['spend'])}/wk"],
            f"Explain why {r['creative']} outperforms its siblings and how to scale it.",
            f"Brainstorm 4 new creative concepts that reuse the winning angle of \u201c{r['creative']}\u201d on {r['platform']}.",
        ))
    return out


def _adset_ops(cur: pd.DataFrame, base: pd.DataFrame, avg_roas: float) -> list[dict]:
    keys = ["platform", "campaign", "adset_id", "adset"]
    c = aggregate(cur, keys)
    b = aggregate(base, keys)[["adset_id", "roas", "cpa", "frequency"]]
    m = c.merge(b, on="adset_id", how="left", suffixes=("", "_base"))
    total = _f(c["spend"].sum()) or 1.0
    out = []
    for r in m.to_dict("records"):
        roas, spend, freq, isl, use = _f(r["roas"]), _f(r["spend"]), _f(r["frequency"]), _f(r["is_lost"]), _f(r["budget_use"])
        if isl >= 0.12 and roas >= avg_roas * 0.9:
            out.append(_opp(
                f"scale-{r['adset_id']}", "Scale", f"Lift the budget cap on {r['adset']}",
                f"Losing {isl:.0%} of eligible searches to budget at {roas:.2f}x ROAS \u2014 demand is there, budget is not.",
                spend * isl * roas * 0.55, "Low", 0.86, r["adset"], r["platform"],
                [f"Lost IS (budget) {isl:.0%}", f"ROAS {roas:.2f}x", f"Budget used {use:.0%}"],
                f"Quantify budget-capped impression share loss on {r['adset']} and the optimal budget shift.",
                f"How much should I raise the budget on {r['adset']} and where should that money come from?",
            ))
        if spend / total > 0.03 and roas < avg_roas * 0.55:
            out.append(_opp(
                f"cut-{r['adset_id']}", "Save", f"Stop the bleed on {r['adset']}",
                f"Spending {_usd(spend)}/week at only {roas:.2f}x ROAS ({avg_roas:.2f}x account average).",
                spend * (1 - roas / avg_roas) * 0.7 if avg_roas else 0, "Low", 0.8, r["adset"], r["platform"],
                [f"ROAS {_f(r['roas_base']):.2f}x \u2192 {roas:.2f}x", f"CPA {_usd(r['cpa_base'])} \u2192 {_usd(r['cpa'])}", f"{spend / total:.0%} of spend"],
                f"Diagnose why {r['adset']} ROAS collapsed and whether to pause or restructure it.",
                f"Should I pause {r['adset']} or fix it? Give me a step-by-step plan.",
            ))
        if freq >= 3.5:
            out.append(_opp(
                f"freqcap-{r['adset_id']}", "Reach", f"Cap frequency on {r['adset']}",
                f"People see these ads {freq:.1f}x a week (was {_f(r['frequency_base']):.1f}x). Past ~3x returns usually fall off fast.",
                spend * min(0.35, (freq - 3) / freq), "Low", 0.78, r["adset"], r["platform"],
                [f"Frequency {_f(r['frequency_base']):.1f} \u2192 {freq:.1f}", f"CTR {_f(r['ctr']):.2%}", f"CPA {_usd(r['cpa'])}"],
                f"Audit audience saturation and frequency on {r['adset']}.",
                f"How do I expand reach on {r['adset']} without raising CPA? Suggest new audiences and a frequency cap.",
            ))
    return out


def _weekday_profile(frame: pd.DataFrame) -> list[dict]:
    end = frame["date"].max()
    recent = frame[frame["date"] > end - pd.Timedelta(days=28)].copy()
    recent["weekday"] = recent["date"].dt.weekday
    g = aggregate(recent, ["weekday"]).sort_values("weekday")
    return [{"day": WEEKDAYS[int(r["weekday"])], "spend": r["spend"] / 4, "revenue": r["revenue"] / 4, "roas": r["roas"], "cpa": r["cpa"]} for r in g.to_dict("records")]


def _timing_ops(profile: list[dict]) -> list[dict]:
    if len(profile) < 7:
        return []
    best = max(profile, key=lambda d: _f(d["roas"]))
    worst = min(profile, key=lambda d: _f(d["roas"]))
    gap = _f(best["roas"]) - _f(worst["roas"])
    if gap <= 0.15:
        return []
    shift = _f(worst["spend"]) * 0.2
    return [_opp(
        "timing-weekday", "Timing", f"Shift budget from {worst['day']} to {best['day']}",
        f"{best['day']} returns {_f(best['roas']):.2f}x vs {_f(worst['roas']):.2f}x on {worst['day']} over the last 4 weeks.",
        shift * gap, "Low", 0.64, "All campaigns", "multi",
        [f"Best: {best['day']} {_f(best['roas']):.2f}x", f"Worst: {worst['day']} {_f(worst['roas']):.2f}x", "28-day weekday average"],
        "Analyse day-of-week performance and recommend an ad schedule.",
        f"Build me a day-of-week ad schedule that leans into {best['day']} and trims {worst['day']}.",
    )]


def _tracking_ops(cur: pd.DataFrame, store: pd.DataFrame) -> list[dict]:
    claimed = _f(cur["revenue"].sum())
    truth = _f(store[store["date"].isin(cur["date"].unique())]["revenue"].sum())
    spend = _f(cur["spend"].sum())
    if not claimed or not truth or claimed <= truth * 0.55:
        return []
    ratio = claimed / truth
    return [_opp(
        "tracking-overclaim", "Tracking", "Platforms claim more sales than your store recorded",
        f"Ad platforms claim {_usd(claimed)} in revenue vs {_usd(truth)} total store revenue \u2014 {ratio:.0%} of store sales.",
        spend * 0.05, "Medium", 0.72, "Cross-channel", "multi",
        [f"Claimed ROAS {claimed / spend:.2f}x" if spend else "Claimed ROAS \u2014", f"Store MER {truth / spend:.2f}x" if spend else "MER \u2014", "Likely double-counting"],
        "Audit Meta Prospecting to Google Brand Search attribution overlap against first-party store MER.",
        "Which channel is most likely over-claiming conversions and how do I run a simple holdout test to prove it?",
    )]


def _pacing_ops(frame: pd.DataFrame, monthly_budget: float | None) -> list[dict]:
    end = frame["date"].max()
    month = frame[frame["date"] >= end.replace(day=1)]
    budget = _f(monthly_budget) or _f(frame[frame["date"] == end]["daily_budget"].sum()) * end.days_in_month
    projected = _f(month["spend"].sum()) / end.day * end.days_in_month
    if not budget:
        return []
    pace = projected / budget
    if 0.95 <= pace <= 1.05:
        return []
    over = pace > 1
    return [_opp(
        "pacing-month", "Budget", "You will overspend this month" if over else "You are underspending this month",
        f"Projected month spend {_usd(projected)} vs {_usd(budget)} budget ({pace:.0%} pace).",
        abs(projected - budget) * 0.25, "Low", 0.9, "Monthly budget", "multi",
        [f"Pace {pace:.0%}", f"Day {end.day}/{end.days_in_month}", f"MTD {_usd(month['spend'].sum())}"],
        "Fit log-log response curves and compute optimal weekly budget shifts from bleeding ad sets to high-elasticity channels.",
        "How should I re-pace my budgets for the rest of the month to land on target?",
    )]


def _compute(frame: pd.DataFrame, store: pd.DataFrame, monthly_budget: float | None) -> dict:
    cur, base, _ = split_periods(frame, "previous_period")
    spend = _f(cur["spend"].sum())
    avg_roas = _f(cur["revenue"].sum()) / spend if spend else 0.0
    profile = _weekday_profile(frame)
    ops = _creative_ops(cur, base, avg_roas) + _adset_ops(cur, base, avg_roas) + _timing_ops(profile) + _tracking_ops(cur, store) + _pacing_ops(frame, monthly_budget)
    ops.sort(key=lambda o: o["impact_usd"] * o["confidence"], reverse=True)
    for i, o in enumerate(ops):
        o["rank"] = i + 1
    cats: dict[str, int] = {}
    for o in ops:
        cats[o["category"]] = cats.get(o["category"], 0) + 1
    return jsonable({
        "summary": {"weekly_upside": sum(o["impact_usd"] for o in ops), "count": len(ops), "avg_roas": avg_roas, "weekly_spend": spend, "categories": cats},
        "opportunities": ops,
        "weekday": profile,
    })


async def build_opportunities(scope: Scope) -> dict:
    frame, store = await asyncio.gather(load_frame(scope), load_store())
    ws = await db.workspace.find_one({"key": "default"}, {"_id": 0, "monthly_budget": 1}) or {}
    budget = ws.get("monthly_budget") if not (scope.platform or scope.account_id) else None
    return await asyncio.to_thread(_compute, apply_window(frame, "7d_click"), store, budget)
