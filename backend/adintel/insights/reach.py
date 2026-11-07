import asyncio

import numpy as np
import pandas as pd

from adintel.analytics.dataset import load_frame
from adintel.analytics.metrics import aggregate, apply_window, jsonable, split_periods
from adintel.models import Scope

BUCKETS = [(0, 1.5, "1\u20131.5"), (1.5, 2.0, "1.5\u20132"), (2.0, 2.5, "2\u20132.5"), (2.5, 3.0, "2.5\u20133"), (3.0, 3.5, "3\u20133.5"), (3.5, 4.5, "3.5\u20134.5"), (4.5, 99, "4.5+")]


def _f(v) -> float:
    try:
        v = float(v)
    except (TypeError, ValueError):
        return 0.0
    return v if np.isfinite(v) else 0.0


def _reach_cols(g: pd.DataFrame) -> pd.DataFrame:
    g = g.copy()
    g["reach"] = g["freq_imps"] / g["frequency"].replace(0, np.nan)
    g["cost_per_1k_reach"] = g["spend"] / g["reach"].replace(0, np.nan) * 1000
    return g


def _curve(frame: pd.DataFrame) -> list[dict]:
    rows = frame[frame["freq_imps"] > 0].copy()
    rows["f"] = rows["freq_w"] / rows["freq_imps"]
    out = []
    for lo, hi, label in BUCKETS:
        b = rows[(rows["f"] >= lo) & (rows["f"] < hi)]
        if b.empty:
            continue
        sp, conv, clk, imp = b["spend"].sum(), b["conversions"].sum(), b["clicks"].sum(), b["impressions"].sum()
        out.append({"bucket": label, "lo": lo, "cpa": sp / conv if conv else None, "ctr": clk / imp if imp else None, "roas": b["revenue"].sum() / sp if sp else None, "spend": sp})
    return out


def _sweet_spot(curve: list[dict]) -> dict:
    valid = [c for c in curve if c["cpa"] and c["spend"] > 0]
    if not valid:
        return {}
    best = min(valid, key=lambda c: c["cpa"])
    worst = max(valid, key=lambda c: c["cpa"])
    return {"bucket": best["bucket"], "cpa": best["cpa"], "worst_bucket": worst["bucket"], "worst_cpa": worst["cpa"], "penalty": worst["cpa"] / best["cpa"] - 1 if best["cpa"] else None}


def _trend(frame: pd.DataFrame) -> list[dict]:
    end = frame["date"].max()
    recent = frame[(frame["date"] > end - pd.Timedelta(days=30)) & (frame["freq_imps"] > 0)]
    g = recent.groupby(["date", "platform"])[["freq_w", "freq_imps"]].sum().reset_index()
    g["frequency"] = g["freq_w"] / g["freq_imps"]
    piv = g.pivot(index="date", columns="platform", values="frequency").sort_index()
    return [{"date": d.date().isoformat(), **{p: _f(v) or None for p, v in row.items()}} for d, row in piv.iterrows()]


def _headroom(freq: float, ctr: float, ctr_base: float) -> str:
    if freq >= 4 or (ctr_base and ctr < ctr_base * 0.8 and freq >= 3):
        return "Saturated"
    if freq >= 3:
        return "Tiring"
    return "Room to grow"


def _compute(frame: pd.DataFrame) -> dict:
    cur, base, _ = split_periods(frame, "previous_period")
    cur_r, base_r = cur[cur["freq_imps"] > 0], base[base["freq_imps"] > 0]
    if cur_r.empty:
        return {"available": False}
    tc = _reach_cols(aggregate(cur_r.assign(k=1), ["k"])).iloc[0]
    tb = _reach_cols(aggregate(base_r.assign(k=1), ["k"])).iloc[0] if not base_r.empty else tc
    plat = _reach_cols(aggregate(cur_r, ["platform"]))
    keys = ["platform", "campaign", "adset_id", "adset"]
    ad = _reach_cols(aggregate(cur_r, keys)).merge(_reach_cols(aggregate(base_r, keys))[["adset_id", "reach", "frequency", "ctr", "cost_per_1k_reach"]], on="adset_id", how="left", suffixes=("", "_base"))
    adsets = []
    for r in ad.sort_values("spend", ascending=False).to_dict("records"):
        adsets.append({
            "adset_id": r["adset_id"], "adset": r["adset"], "campaign": r["campaign"], "platform": r["platform"], "spend": r["spend"],
            "reach": r["reach"], "reach_delta": (r["reach"] / r["reach_base"] - 1) if _f(r.get("reach_base")) else None,
            "frequency": r["frequency"], "frequency_base": r.get("frequency_base"), "ctr": r["ctr"], "cpa": r["cpa"],
            "cost_per_1k_reach": r["cost_per_1k_reach"], "status": _headroom(_f(r["frequency"]), _f(r["ctr"]), _f(r.get("ctr_base"))),
        })
    curve = _curve(frame[frame["date"] > frame["date"].max() - pd.Timedelta(days=30)])
    sweet = _sweet_spot(curve)
    saturated = [a for a in adsets if a["status"] == "Saturated"]
    return jsonable({
        "available": True,
        "totals": {
            "reach": tc["reach"], "reach_base": tb["reach"], "frequency": tc["frequency"], "frequency_base": tb["frequency"],
            "cost_per_1k_reach": tc["cost_per_1k_reach"], "cost_per_1k_reach_base": tb["cost_per_1k_reach"], "impressions": tc["freq_imps"],
            "saturated_spend": sum(_f(a["spend"]) for a in saturated), "saturated_count": len(saturated),
        },
        "platforms": [{"platform": r["platform"], "reach": r["reach"], "frequency": r["frequency"], "cost_per_1k_reach": r["cost_per_1k_reach"], "spend": r["spend"], "ctr": r["ctr"]} for r in plat.to_dict("records")],
        "adsets": adsets,
        "curve": curve,
        "sweet_spot": sweet,
        "trend": _trend(frame),
        "note": "Reach is estimated as impressions \u00f7 average frequency, per ad set, for the last 7 days. Google Search does not report reach.",
    })


async def build_reach(scope: Scope) -> dict:
    frame = await load_frame(scope)
    return await asyncio.to_thread(_compute, apply_window(frame, "7d_click"))
