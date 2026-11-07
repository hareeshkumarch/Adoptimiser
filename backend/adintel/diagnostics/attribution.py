import numpy as np
import pandas as pd

from adintel.analytics.metrics import pct_change
from adintel.diagnostics.anomaly import HORIZON_DAYS
from adintel.diagnostics.config import DETECTOR as C

ATTRIBUTION_DAYS = 14


def _safe_ratio(num: float, den: float, default: float = 0.0) -> float:
    if den is None or num is None or not np.isfinite(num) or not np.isfinite(den) or den == 0:
        return default
    return float(num / den)


def claimed_vs_store(metrics: pd.DataFrame, store: pd.DataFrame) -> pd.DataFrame:
    cols = ["date", "spend", "claimed", "store_revenue", "orders", "overlap_ratio", "mer"]
    if metrics.empty or store.empty:
        return pd.DataFrame(columns=cols)
    daily = metrics.groupby(["date", "platform"])["revenue"].sum().unstack(fill_value=0.0)
    daily["claimed"] = daily.sum(axis=1)
    daily["spend"] = metrics.groupby("date")["spend"].sum()
    merged = daily.reset_index().merge(
        store[["date", "revenue", "orders"]].rename(columns={"revenue": "store_revenue"}),
        on="date",
        how="inner",
    )
    if merged.empty:
        return pd.DataFrame(columns=cols)
    merged["overlap_ratio"] = merged["claimed"] / merged["store_revenue"].replace(0, np.nan)
    merged["mer"] = merged["store_revenue"] / merged["spend"].replace(0, np.nan)
    return merged


def lagged_correlation(metrics: pd.DataFrame) -> dict | None:
    if metrics.empty or "role" not in metrics.columns:
        return None
    driver = metrics[(metrics["platform"] == "meta") & (metrics["role"] == "prospecting")].groupby("date")["impressions"].sum()
    target = metrics[(metrics["platform"] == "google") & (metrics["role"] == "brand")].groupby("date")["conversions"].sum()
    if len(driver) < 4 or len(target) < 4 or driver.std() == 0 or target.std() == 0:
        return None
    scores: dict[int, float] = {}
    for lag in range(4):
        shifted = driver.shift(lag)
        aligned = pd.concat([target.rename("t"), shifted.rename("d")], axis=1).dropna()
        if len(aligned) < 3 or aligned["t"].std() == 0 or aligned["d"].std() == 0:
            continue
        r = aligned["t"].corr(aligned["d"])
        if pd.notna(r) and np.isfinite(r):
            scores[lag] = float(r)
    if not scores:
        return None
    best = max(scores, key=scores.get)
    return {
        "driver": "Meta prospecting impressions",
        "target": "Google brand search conversions",
        "by_lag": scores,
        "best_lag": best,
        "corr": scores[best],
    }


def overlap_shift(daily: pd.DataFrame) -> dict:
    if daily.empty or "date" not in daily.columns:
        return {
            "recent_start": None, "base_start": None, "end": None,
            "ratio_base": 0.0, "ratio_recent": 0.0,
            "claimed_growth": 0.0, "store_growth": 0.0,
            "platform_growth": {}, "store_daily": 0.0,
            "aov_change": 0.0, "mer_base": 0.0, "mer_recent": 0.0,
        }
    end = daily["date"].max()
    recent_start = end - pd.Timedelta(days=ATTRIBUTION_DAYS - 1)
    base_start = recent_start - pd.Timedelta(days=ATTRIBUTION_DAYS)
    recent = daily[daily["date"] >= recent_start]
    base = daily[(daily["date"] >= base_start) & (daily["date"] < recent_start)]
    platforms = [c for c in ("meta", "google", "tiktok", "linkedin") if c in daily.columns]
    growth = {
        p: float(recent[p].sum() / base[p].sum() - 1)
        for p in platforms
        if base[p].sum() > 0
    }
    aov_recent = _safe_ratio(recent["store_revenue"].sum(), recent["orders"].sum())
    aov_base = _safe_ratio(base["store_revenue"].sum(), base["orders"].sum())
    aov_change = pct_change(aov_recent, aov_base)
    claimed_growth = pct_change(recent["claimed"].sum(), base["claimed"].sum())
    store_growth = pct_change(recent["store_revenue"].sum(), base["store_revenue"].sum())
    return {
        "recent_start": recent_start,
        "base_start": base_start,
        "end": end,
        "ratio_base": _safe_ratio(base["claimed"].sum(), base["store_revenue"].sum()),
        "ratio_recent": _safe_ratio(recent["claimed"].sum(), recent["store_revenue"].sum()),
        "claimed_growth": claimed_growth if claimed_growth is not None else 0.0,
        "store_growth": store_growth if store_growth is not None else 0.0,
        "platform_growth": growth,
        "store_daily": float(recent["store_revenue"].mean()) if not recent.empty else 0.0,
        "aov_change": aov_change if aov_change is not None else 0.0,
        "mer_base": _safe_ratio(base["store_revenue"].sum(), base["spend"].sum()),
        "mer_recent": _safe_ratio(recent["store_revenue"].sum(), recent["spend"].sum()),
    }


def detect_overlap(shift: dict, correlation: dict | None, metrics: pd.DataFrame) -> dict | None:
    if not shift or shift.get("recent_start") is None or correlation is None:
        return None
    corr_val = correlation.get("corr")
    if corr_val is None or not np.isfinite(corr_val):
        return None
    delta = shift["ratio_recent"] - shift["ratio_base"]
    if delta < C.overlap_ratio_delta or corr_val < C.overlap_min_corr:
        return None
    brand = metrics[(metrics["platform"] == "google") & (metrics["role"] == "brand")]
    if brand.empty:
        return None
    platform_growth = shift.get("platform_growth") or {}
    top = max(platform_growth, key=platform_growth.get) if platform_growth else "google"
    top_growth = platform_growth.get(top, 0.0)

    brand_recent = brand[brand["date"] >= shift["recent_start"]]
    brand_base = brand[(brand["date"] >= shift["base_start"]) & (brand["date"] < shift["recent_start"])]
    brand_growth_raw = pct_change(brand_recent["revenue"].sum(), brand_base["revenue"].sum())
    brand_growth = brand_growth_raw if brand_growth_raw is not None else 0.0
    denom = 1.0 + brand_growth
    non_incremental = max(0.0, (brand_growth - shift["store_growth"]) / denom) if denom > 1e-6 else 0.0
    brand_savings = float(brand_recent["spend"].sum() / ATTRIBUTION_DAYS * HORIZON_DAYS * non_incremental)
    rel_change = _safe_ratio(delta, shift["ratio_base"])
    return {
        "id": "attribution_overlap:google-brand",
        "kind": "attribution_overlap",
        "title": "Attribution overlap & cannibalization",
        "severity": "warning",
        "platform": "multi",
        "platforms": ["meta", "google"],
        "account_id": None,
        "campaign": "Search · Brand",
        "entity_level": "campaign",
        "entity_ids": brand["adset_id"].unique().tolist(),
        "entity_name": "Google Search · Brand ↔ Meta Prospecting",
        "recent_start": shift["recent_start"],
        "base_start": shift["base_start"],
        "end": shift["end"],
        "headline": f"Claimed / store revenue {shift['ratio_base']:.2f}x → {shift['ratio_recent']:.2f}x",
        "metric": "overlap_ratio",
        "baseline": shift["ratio_base"],
        "recent": shift["ratio_recent"],
        "change": rel_change,
        "z": None,
        "evidence": [
            {"step": "detected", "agent": "attribution", "label": f"Platform-claimed revenue {shift['claimed_growth']:+.0%} vs first-party store revenue {shift['store_growth']:+.0%}"},
            {"step": "detected", "agent": "attribution", "label": f"Fastest-growing claimant: {top.title()} ({top_growth:+.0%})"},
            {"step": "detected", "agent": "attribution", "label": f"{correlation['target']} track {correlation['driver']} at lag {correlation['best_lag']}d (r = {corr_val:.2f})"},
            {"step": "detected", "agent": "attribution", "label": f"Blended MER {shift['mer_base']:.2f} → {shift['mer_recent']:.2f}"},
            {"step": "detected", "agent": "attribution", "label": f"Brand search claims {brand_growth:+.0%} → ~{non_incremental:.0%} of brand conversions non-incremental"},
        ],
        "correlation": correlation,
        "shift": shift,
        "action_savings": brand_savings,
        "dollar_impact": max(0.0, float(delta * shift["store_daily"] * HORIZON_DAYS)),
        "impact_type": "misattributed",
        "status": "candidate",
    }
