import numpy as np
import pandas as pd

from adintel.diagnostics.anomaly import HORIZON_DAYS

CURVE_DAYS = 14


def response_curves(metrics: pd.DataFrame) -> dict:
    if metrics.empty:
        return {}
    end = metrics["date"].max()
    recent = metrics[metrics["date"] > end - pd.Timedelta(days=CURVE_DAYS)]
    curves = {}
    multipliers = [round(0.4 + 0.1 * i, 2) for i in range(13)]
    for platform, g in metrics.groupby("platform"):
        daily = g.groupby("date")[["spend", "revenue"]].sum()
        daily = daily[(daily["spend"] > 0) & (daily["revenue"] > 0)]
        slope = np.polyfit(np.log(daily["spend"]), np.log(daily["revenue"]), 1)[0] if len(daily) > 10 else 0.6
        r = recent[recent["platform"] == platform]
        spend_wk = float(r["spend"].sum() / CURVE_DAYS * 7)
        rev_wk = float(r["revenue"].sum() / CURVE_DAYS * 7)
        elasticity = float(np.clip(slope, 0.35, 0.85))
        grid = []
        for mult in multipliers:
            sim_spend = spend_wk * mult
            sim_rev = rev_wk * (mult ** elasticity) if spend_wk > 0 else 0.0
            avg_roas = sim_rev / sim_spend if sim_spend > 0 else 0.0
            marg_roas = elasticity * avg_roas
            grid.append({
                "multiplier": mult,
                "spend": round(sim_spend, 2),
                "revenue": round(sim_rev, 2),
                "avg_roas": round(avg_roas, 3),
                "marginal_roas": round(marg_roas, 3),
            })
        curves[platform] = {
            "spend": spend_wk,
            "revenue": rev_wk,
            "elasticity": elasticity,
            "grid": grid,
        }
    return curves


def _marginal(curve: dict, spend: float | None = None) -> float:
    s = curve["spend"] if spend is None else spend
    if s <= 0 or curve["spend"] <= 0:
        return 0.0
    rev = curve["revenue"] * ((s / curve["spend"]) ** curve["elasticity"])
    return float(curve["elasticity"] * rev / s)


def solve_portfolio_allocation(curves: dict, max_shift_pct: float = 0.30) -> dict:
    if not curves:
        return {"total_spend": 0.0, "base_revenue": 0.0, "optimal_revenue": 0.0, "revenue_lift": 0.0, "base_roas": 0.0, "optimal_roas": 0.0, "allocations": []}
    platforms = list(curves.keys())
    base_spends = {p: float(curves[p]["spend"]) for p in platforms}
    alloc = dict(base_spends)
    min_spends = {p: base_spends[p] * (1.0 - max_shift_pct) for p in platforms}
    max_spends = {p: base_spends[p] * (1.0 + max_shift_pct) for p in platforms}
    total_spend = sum(base_spends.values())
    step_usd = max(50.0, total_spend * 0.005)

    for _ in range(120):
        donor_candidates = [p for p in platforms if alloc[p] - step_usd >= min_spends[p]]
        receiver_candidates = [p for p in platforms if alloc[p] + step_usd <= max_spends[p]]
        if not donor_candidates or not receiver_candidates:
            break
        donor = min(donor_candidates, key=lambda p: _marginal(curves[p], alloc[p]))
        receiver = max(receiver_candidates, key=lambda p: _marginal(curves[p], alloc[p]))
        if donor == receiver or _marginal(curves[receiver], alloc[receiver]) <= _marginal(curves[donor], alloc[donor]) + 0.02:
            break
        alloc[donor] -= step_usd
        alloc[receiver] += step_usd

    base_revenue = sum(curves[p]["revenue"] for p in platforms)
    optimal_revenue = sum(
        curves[p]["revenue"] * ((alloc[p] / base_spends[p]) ** curves[p]["elasticity"]) if base_spends[p] > 0 else 0.0
        for p in platforms
    )
    rows = []
    for p in platforms:
        b_spend = base_spends[p]
        o_spend = alloc[p]
        b_rev = float(curves[p]["revenue"])
        o_rev = float(b_rev * ((o_spend / b_spend) ** curves[p]["elasticity"])) if b_spend > 0 else 0.0
        rows.append({
            "platform": p,
            "base_spend": round(b_spend, 2),
            "optimal_spend": round(o_spend, 2),
            "delta_spend": round(o_spend - b_spend, 2),
            "delta_pct": round((o_spend - b_spend) / b_spend, 4) if b_spend > 0 else 0.0,
            "base_revenue": round(b_rev, 2),
            "optimal_revenue": round(o_rev, 2),
            "elasticity": round(float(curves[p]["elasticity"]), 3),
            "marginal_roas_base": round(_marginal(curves[p], b_spend), 3),
            "marginal_roas_optimal": round(_marginal(curves[p], o_spend), 3),
        })
    return {
        "total_spend": round(total_spend, 2),
        "base_revenue": round(base_revenue, 2),
        "optimal_revenue": round(optimal_revenue, 2),
        "revenue_lift": round(optimal_revenue - base_revenue, 2),
        "base_roas": round(base_revenue / total_spend, 3) if total_spend > 0 else 0.0,
        "optimal_roas": round(optimal_revenue / total_spend, 3) if total_spend > 0 else 0.0,
        "allocations": rows,
    }


def _best_target(curves: dict, exclude: set[str]) -> str:
    candidates = [p for p in curves if p not in exclude]
    if not candidates:
        return next(iter(curves))
    return max(candidates, key=lambda p: _marginal(curves[p]))


def _worst_source(curves: dict, exclude: set[str]) -> str:
    candidates = [p for p in curves if p not in exclude]
    if not candidates:
        return next(iter(curves))
    return min(candidates, key=lambda p: _marginal(curves[p]))


def _simulator(curves: dict, source: str, target: str, default_pct: float) -> dict | None:
    if source not in curves or target not in curves or source == target:
        return None
    return {"from": source, "to": target, "default_pct": default_pct, "max_pct": 0.6, "base_spend": curves[source]["spend"]}


def _fatigue(f: dict, curves: dict) -> dict:
    creative = (f.get("creative") or {}).get("creative", "top creative")
    return {
        "title": f"Rotate fresh hooks into {f['entity_name']} and cap frequency at 3.0",
        "steps": [
            f"Retire '{creative}' and launch 2–3 new opening hooks in the existing ad set",
            "Apply a 3.0 / 7-day frequency cap or widen the lookalike seed",
            "Hold scaling until hook rate recovers above baseline",
        ],
        "simulator": _simulator(curves, f["platform"], _best_target(curves, {f["platform"]}), 0.15),
    }


def _hook(f: dict, curves: dict) -> dict:
    creative = (f.get("creative") or {}).get("creative", "the lead creative")
    return {
        "title": f"Re-cut the first 2 seconds of '{creative}'",
        "steps": [
            "Shift spend to the strongest sibling creative while the re-cut is produced",
            "Test 3 hook variants (pattern interrupt, product-in-hand, creator face)",
            "Keep landing page and offer unchanged — verified healthy",
        ],
        "simulator": _simulator(curves, f["platform"], _best_target(curves, {f["platform"]}), 0.2),
    }


def _is_loss(f: dict, curves: dict) -> dict:
    return {
        "title": f"Lift {f['campaign']} budget to recover impression share",
        "steps": [
            "Raise daily budget on budget-limited ad groups, keep tROAS unchanged",
            "Fund the increase from the lowest marginal-ROAS channel",
            "Re-check lost IS (budget) after 72 hours",
        ],
        "simulator": _simulator(curves, _worst_source(curves, {"google"}), "google", 0.25),
    }


def _bleeder(f: dict, curves: dict) -> dict:
    return {
        "title": f"Pause {f['entity_name']} and reallocate its budget",
        "steps": [
            "Pause the saturated ad set — conversions have collapsed while spend climbs",
            "Refresh the audience (new job titles / company lists) before relaunch",
            "Move the freed budget to the highest marginal-ROAS channel",
        ],
        "simulator": _simulator(curves, f["platform"], _best_target(curves, {f["platform"]}), 0.5),
    }


def _overlap(f: dict, curves: dict) -> dict:
    return {
        "title": "Trim brand-search bids and judge Meta prospecting on blended MER",
        "steps": [
            "Lower brand tCPA / bid caps — brand clicks are being harvested from Meta-driven demand",
            "Report Meta prospecting on incremental MER, not platform ROAS",
            "Run a 2-week geo holdout on brand search to size true incrementality",
        ],
        "simulator": _simulator(curves, "google", "meta", 0.1),
    }


TEMPLATES = {
    "creative_fatigue": _fatigue,
    "hook_dropoff": _hook,
    "impression_share_loss": _is_loss,
    "silent_bleeder": _bleeder,
    "attribution_overlap": _overlap,
}


def prescribe(findings: list[dict], curves: dict) -> list[dict]:
    out = []
    for f in findings:
        template = TEMPLATES.get(f["kind"])
        if not template:
            continue
        rx = template(f, curves)
        impact = f.get("action_savings", f["dollar_impact"])
        impact_type = "savings" if "action_savings" in f else f["impact_type"]
        out.append({
            "id": f"rx:{f['id']}",
            "finding_id": f["id"],
            "kind": f["kind"],
            "platform": f["platform"],
            "platforms": f.get("platforms"),
            "severity": f["severity"],
            "dollar_impact": impact,
            "impact_type": impact_type,
            "confidence": f["confidence"],
            "score": impact * f["confidence"],
            "horizon_days": HORIZON_DAYS,
            **rx,
        })
    return sorted(out, key=lambda r: r["score"], reverse=True)
