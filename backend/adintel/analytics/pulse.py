import asyncio

import numpy as np
import pandas as pd

from adintel.analytics.dataset import load_frame, load_store
from adintel.analytics.metrics import LEVEL_KEYS, aggregate, apply_window, jsonable, pct_change, split_periods, totals
from adintel.models import Scope

KPIS = [
    ("spend", "Spend", "currency"),
    ("revenue", "Attributed Revenue", "currency"),
    ("roas", "ROAS", "ratio"),
    ("mer", "Blended MER", "ratio"),
    ("cpa", "CPA", "currency"),
    ("cpm", "CPM", "currency"),
    ("ctr", "CTR", "pct"),
    ("hook_rate", "Hook Rate", "pct"),
]
BREAKDOWN_METRICS = ["spend", "revenue", "conversions", "roas", "cpa", "cpm", "ctr", "hook_rate", "hold_rate", "frequency", "is_lost"]


def _mer_series(all_daily: pd.DataFrame, store: pd.DataFrame) -> pd.Series:
    merged = all_daily.merge(store, on="date", suffixes=("", "_store"))
    sp = merged.set_index("date")["spend"].replace(0, np.nan)
    return merged.set_index("date")["revenue_store"] / sp


def _pacing(frame: pd.DataFrame) -> dict:
    end = frame["date"].max()
    month = frame[frame["date"] >= end.replace(day=1)]
    days_in_month = end.days_in_month
    daily_budget = frame[frame["date"] == end]["daily_budget"].sum()
    mtd_spend = month["spend"].sum()
    projected = mtd_spend / end.day * days_in_month
    budget = daily_budget * days_in_month
    return jsonable(
        {
            "mtd_spend": mtd_spend,
            "month_budget": budget,
            "projected_spend": projected,
            "pace": projected / budget if budget else None,
            "day": end.day,
            "days_in_month": days_in_month,
        }
    )


def _daily_series(frame: pd.DataFrame, full: pd.DataFrame, store: pd.DataFrame) -> list[dict]:
    end = frame["date"].max()
    window_30 = frame[frame["date"] > end - pd.Timedelta(days=30)].copy()
    daily = aggregate(window_30, ["date"]).sort_values("date")
    full_daily = aggregate(full[full["date"] > end - pd.Timedelta(days=30)], ["date"])
    mer_map = _mer_series(full_daily, store)
    daily["mer"] = daily["date"].map(mer_map)

    plat_pivot = window_30.groupby(["date", "platform"])["spend"].sum().unstack(fill_value=0.0)
    roll = daily["cpa"].rolling(14, min_periods=5)
    med = roll.median().bfill()
    mad = roll.apply(lambda x: np.median(np.abs(x - np.median(x))), raw=True).bfill() * 1.4826
    scale = np.maximum(mad, med * 0.03)
    daily["cpa_median"] = med
    daily["cpa_upper"] = med + 2.5 * scale
    daily["cpa_z"] = (daily["cpa"] - med) / np.maximum(scale, 1e-6)

    out = []
    for row in daily.to_dict("records"):
        dt = row["date"]
        p_row = plat_pivot.loc[dt] if dt in plat_pivot.index else {}
        out.append({
            "date": dt.date().isoformat() if hasattr(dt, "date") else str(dt),
            "spend": row["spend"],
            "revenue": row["revenue"],
            "roas": row["roas"],
            "mer": row["mer"],
            "cpa": row["cpa"],
            "cpa_median": row["cpa_median"],
            "cpa_upper": row["cpa_upper"],
            "cpa_z": row["cpa_z"],
            "meta_spend": float(p_row.get("meta", 0.0)),
            "google_spend": float(p_row.get("google", 0.0)),
            "tiktok_spend": float(p_row.get("tiktok", 0.0)),
            "linkedin_spend": float(p_row.get("linkedin", 0.0)),
        })
    return jsonable(out)


async def build_pulse(scope: Scope, window: str, compare: str) -> dict:
    frame, full, store = await asyncio.gather(load_frame(scope), load_frame(Scope()), load_store())
    return await asyncio.to_thread(_pulse, apply_window(frame, window), apply_window(full, window), store, window, compare)


def _pulse(frame: pd.DataFrame, full: pd.DataFrame, store: pd.DataFrame, window: str, compare: str) -> dict:
    current, base, scale = split_periods(frame, compare)
    ct, bt = totals(current), totals(base, scale)
    full_cur, full_base, _ = split_periods(full, compare)
    store_cur = store[store["date"].isin(full_cur["date"].unique())]["revenue"].sum()
    store_base = store[store["date"].isin(full_base["date"].unique())]["revenue"].sum() * scale
    f_cur_s = full_cur["spend"].sum()
    f_base_s = full_base["spend"].sum() * scale
    ct["mer"] = (store_cur / f_cur_s) if f_cur_s > 0 else None
    bt["mer"] = (store_base / f_base_s) if f_base_s > 0 else None
    daily = aggregate(frame[frame["date"] > frame["date"].max() - pd.Timedelta(days=30)], ["date"])
    daily["mer"] = daily["date"].map(_mer_series(aggregate(full, ["date"]), store))
    kpis = [
        {"key": key, "label": label, "format": fmt, "value": ct[key], "baseline": bt[key], "delta_pct": pct_change(ct[key], bt[key]), "spark": daily[key].tolist()}
        for key, label, fmt in KPIS
    ]
    platforms = aggregate(current, ["platform"])
    tot_plat_spend = platforms["spend"].sum()
    platforms["share"] = (platforms["spend"] / tot_plat_spend) if tot_plat_spend > 0 else 0.0
    return jsonable({
        "period": {"start": current["date"].min(), "end": current["date"].max(), "compare": compare, "window": window},
        "kpis": kpis,
        "platforms": platforms[["platform", "spend", "revenue", "roas", "cpa", "share"]].to_dict("records"),
        "pacing": _pacing(frame),
        "store": {"revenue": store_cur, "orders": store[store["date"].isin(full_cur["date"].unique())]["orders"].sum()},
        "series": _daily_series(frame, full, store),
    })


async def build_breakdown(scope: Scope, window: str, compare: str, level: str) -> dict:
    return await asyncio.to_thread(_breakdown, apply_window(await load_frame(scope), window), compare, level)


def _breakdown(frame: pd.DataFrame, compare: str, level: str) -> dict:
    keys = LEVEL_KEYS[level]
    current, base, scale = split_periods(frame, compare)
    cur = aggregate(current, keys)
    base_agg = aggregate(base, keys)
    for column in ("spend", "revenue", "conversions"):
        base_agg[column] = base_agg[column] * scale
    merged = cur.merge(base_agg[keys + ["spend", "roas", "cpa", "revenue"]], on=keys, how="left", suffixes=("", "_base"))
    rows = []
    for record in merged.sort_values("spend", ascending=False).to_dict("records"):
        row = {k: record[k] for k in keys + BREAKDOWN_METRICS}
        row["id"] = record[keys[-2]] if level != "platform" else record["platform"]
        row["name"] = record[keys[-1]]
        row["delta"] = {m: pct_change(record[m], record.get(f"{m}_base")) for m in ("spend", "roas", "cpa", "revenue")}
        rows.append(row)
    return jsonable({"level": level, "rows": rows})
