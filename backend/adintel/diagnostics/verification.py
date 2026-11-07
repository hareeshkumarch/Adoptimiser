from dataclasses import dataclass
from typing import Callable

import numpy as np
import pandas as pd

from adintel.analytics.metrics import pct_change, totals


@dataclass(frozen=True)
class Evidence:
    metrics: pd.DataFrame
    store: pd.DataFrame


def _finite(val: float | int | None, default: float = 0.0) -> float:
    if val is None or not np.isfinite(val):
        return default
    return float(val)


def _safe_div(num: float | int | None, den: float | int | None) -> float | None:
    if num is None or den is None or not np.isfinite(num) or not np.isfinite(den) or den == 0:
        return None
    return float(num / den)


def _check(name: str, label: str, passed: bool, detail: str, required: bool = True) -> dict:
    return {"name": name, "label": label, "passed": bool(passed), "detail": detail, "required": required}


def _periods(frame: pd.DataFrame, f: dict) -> tuple[pd.DataFrame, pd.DataFrame]:
    if frame.empty or "date" not in frame.columns:
        return frame.iloc[0:0], frame.iloc[0:0]
    rs, bs = pd.Timestamp(f["recent_start"]), pd.Timestamp(f["base_start"])
    end = pd.Timestamp(f["end"])
    return frame[(frame["date"] >= rs) & (frame["date"] <= end)], frame[(frame["date"] >= bs) & (frame["date"] < rs)]


def _entity(ev: Evidence, f: dict) -> pd.DataFrame:
    entity_ids = f.get("entity_ids") or []
    if ev.metrics.empty or not entity_ids:
        return ev.metrics.iloc[0:0]
    return ev.metrics[ev.metrics["adset_id"].isin(entity_ids)]


def _compare(frame: pd.DataFrame, f: dict, metric: str) -> tuple[float, float, float | None]:
    if frame.empty:
        return 0.0, 0.0, None
    recent, base = _periods(frame, f)
    rt = totals(recent) if not recent.empty else pd.Series(dtype=float)
    bt = totals(base) if not base.empty else pd.Series(dtype=float)
    r, b = _finite(rt.get(metric)), _finite(bt.get(metric))
    return r, b, pct_change(r, b)


def _daily(frame: pd.DataFrame, f: dict, column: str) -> tuple[float, float, float | None]:
    if frame.empty or column not in frame.columns:
        return 0.0, 0.0, None
    recent, base = _periods(frame, f)
    r = _finite(recent.groupby("date")[column].sum().mean() if not recent.empty else 0.0)
    b = _finite(base.groupby("date")[column].sum().mean() if not base.empty else 0.0)
    return r, b, pct_change(r, b)


def landing_page_health(ev: Evidence, f: dict) -> dict:
    r, b, ch = _compare(_entity(ev, f), f, "lp_cvr")
    passed = ch is not None and ch >= -0.1
    return _check(
        "verify_landing_page",
        "Landing page CVR healthy",
        passed,
        f"Server-side LP CVR {b:.2%} → {r:.2%} ({_finite(ch):+.0%})",
    )


def tracking_integrity(ev: Evidence, f: dict) -> dict:
    recent, base = _periods(_entity(ev, f), f)
    ratio_r = _safe_div(recent["conversions"].sum() if not recent.empty else 0.0, recent["lp_conversions"].sum() if not recent.empty else 0.0)
    ratio_b = _safe_div(base["conversions"].sum() if not base.empty else 0.0, base["lp_conversions"].sum() if not base.empty else 0.0)
    ch = pct_change(ratio_r, ratio_b)
    if ratio_r is None or ratio_b is None or ch is None:
        return _check(
            "verify_tracking",
            "Pixel vs server conversions aligned",
            False,
            "Insufficient server-side LP conversions to verify pixel alignment",
        )
    return _check(
        "verify_tracking",
        "Pixel vs server conversions aligned",
        abs(ch) <= 0.15,
        f"Platform/server conversion ratio {ratio_b:.2f} → {ratio_r:.2f} ({ch:+.0%})",
    )


def auction_pressure(ev: Evidence, f: dict) -> dict:
    r, b, ch = _compare(_entity(ev, f), f, "cpm")
    return _check(
        "verify_auction",
        "No auction pressure (CPM stable)",
        _finite(ch) < 0.2,
        f"CPM ${b:.2f} → ${r:.2f} ({_finite(ch):+.0%})",
    )


def sample_size(ev: Evidence, f: dict) -> dict:
    recent, _ = _periods(_entity(ev, f), f)
    conv = _finite(recent["conversions"].sum() if not recent.empty else 0.0)
    return _check("verify_sample", "Sufficient conversion volume", conv >= 15, f"{conv:.0f} conversions in window", required=False)


def budget_capped(ev: Evidence, f: dict) -> dict:
    r, _, _ = _compare(_entity(ev, f), f, "budget_use")
    return _check("verify_budget_cap", "Campaign budget-capped", r >= 0.95, f"Budget utilisation {r:.0%}")


def demand_rising(ev: Evidence, f: dict) -> dict:
    ent = _entity(ev, f)
    if ent.empty:
        return _check("verify_demand", "Eligible search demand rising", False, "No impression telemetry in scope")
    denom = 1.0 - ent["is_lost_budget"].fillna(0.0).clip(upper=0.99)
    frame = ent.assign(available=ent["impressions"] / denom)
    r, b, ch = _daily(frame, f, "available")
    return _check(
        "verify_demand",
        "Eligible search demand rising",
        ch is not None and ch >= 0.1,
        f"Eligible impressions/day {b:,.0f} → {r:,.0f} ({_finite(ch):+.0%})",
    )


def cpc_stable(ev: Evidence, f: dict) -> dict:
    r, b, ch = _compare(_entity(ev, f), f, "cpc")
    return _check(
        "verify_bids",
        "Bids/CPC unchanged",
        abs(_finite(ch)) <= 0.15,
        f"CPC ${b:.2f} → ${r:.2f} ({_finite(ch):+.0%})",
    )


def sibling_tracking(ev: Evidence, f: dict) -> dict:
    entity_ids = f.get("entity_ids") or []
    siblings = ev.metrics[(ev.metrics["account_id"] == f.get("account_id")) & ~ev.metrics["adset_id"].isin(entity_ids)]
    if siblings.empty:
        return _check("verify_tracking", "Account conversion tracking healthy", False, "No sibling campaigns to compare")
    r, b, ch = _daily(siblings, f, "conversions")
    return _check(
        "verify_tracking",
        "Account conversion tracking healthy",
        ch is not None and ch >= -0.3,
        f"Sibling campaigns conversions/day {b:.1f} → {r:.1f} ({_finite(ch):+.0%})",
    )


def saturation(ev: Evidence, f: dict) -> dict:
    r, b, _ = _compare(_entity(ev, f), f, "frequency")
    return _check("verify_saturation", "Audience saturation", r >= 5.0, f"Frequency {b:.1f} → {r:.1f}", required=False)


def clicks_flowing(ev: Evidence, f: dict) -> dict:
    r, b, ch = _daily(_entity(ev, f), f, "clicks")
    return _check(
        "verify_traffic",
        "Paid traffic still flowing",
        ch is not None and ch >= -0.2,
        f"Clicks/day {b:.0f} → {r:.0f} ({_finite(ch):+.0%})",
    )


def _spike_vs_prior(series: pd.Series, f: dict) -> tuple[float, float, float | None]:
    raw_dates = f.get("dates") or []
    if series.empty or not raw_dates:
        return 0.0, 0.0, None
    days = sorted(pd.Timestamp(d) for d in raw_dates)
    prior_slice = series[(series.index < days[0]) & (series.index >= days[0] - pd.Timedelta(days=14))]
    spike_slice = series[series.index.isin(days)]
    prior = _finite(prior_slice.median() if not prior_slice.empty else 0.0)
    spike = _finite(spike_slice.mean() if not spike_slice.empty else 0.0)
    return spike, prior, pct_change(spike, prior)


def store_orders_dropped(ev: Evidence, f: dict) -> dict:
    if ev.store.empty or "orders" not in ev.store.columns:
        return _check("verify_store_orders", "First-party orders dropped too", False, "No first-party store order data available")
    spike, prior, ch = _spike_vs_prior(ev.store.set_index("date")["orders"], f)
    passed = ch is not None and ch <= -0.15
    return _check(
        "verify_store_orders",
        "First-party orders dropped too",
        passed,
        f"Store orders {prior:.0f} → {spike:.0f}/day ({_finite(ch):+.0%}) while platform CPA spiked",
    )


def server_conversions_dropped(ev: Evidence, f: dict) -> dict:
    ent = _entity(ev, f)
    if ent.empty:
        return _check("verify_tracking", "Server-side conversions dropped too", False, "No entity conversion telemetry in scope")
    series = ent.groupby("date")["lp_conversions"].sum()
    _, _, ch = _spike_vs_prior(series, f)
    _, _, pch = _spike_vs_prior(ent.groupby("date")["conversions"].sum(), f)
    ch_val, pch_val = _finite(ch), _finite(pch)
    passed = ch is not None and ch_val <= -0.15
    status_label = "tracking outage" if ch_val > -0.15 and pch_val < -0.4 else "consistent"
    return _check(
        "verify_tracking",
        "Server-side conversions dropped too",
        passed,
        f"Server conversions {ch_val:+.0%} vs pixel conversions {pch_val:+.0%} → {status_label}",
    )


def claims_outpace_store(ev: Evidence, f: dict) -> dict:
    s = f.get("shift") or {}
    claimed_g = _finite(s.get("claimed_growth"))
    store_g = _finite(s.get("store_growth"))
    gap = claimed_g - store_g
    return _check(
        "verify_incrementality",
        "Claims outpace real revenue",
        gap >= 0.1,
        f"Claimed {claimed_g:+.0%} vs store {store_g:+.0%} (gap {gap:+.0%})",
    )


def driver_correlation(ev: Evidence, f: dict) -> dict:
    c = f.get("correlation")
    if not c or c.get("corr") is None or not np.isfinite(c.get("corr")):
        return _check("verify_correlation", "Brand demand driven by Meta reach", False, "Cross-platform pair not in scope")
    corr = float(c["corr"])
    lag = int(c.get("best_lag", 0))
    return _check("verify_correlation", "Brand demand driven by Meta reach", corr >= 0.5, f"r = {corr:.2f} at {lag}d lag")


def aov_stable(ev: Evidence, f: dict) -> dict:
    s = f.get("shift") or {}
    ch = s.get("aov_change")
    if ch is None or not np.isfinite(ch):
        return _check("verify_promo", "No promo/AOV distortion", False, "Store AOV baseline unavailable")
    ch_val = float(ch)
    return _check("verify_promo", "No promo/AOV distortion", abs(ch_val) <= 0.08, f"Store AOV {ch_val:+.1%}")


CheckFn = Callable[[Evidence, dict], dict]

CHECKS: dict[str, list[CheckFn]] = {
    "creative_fatigue": [landing_page_health, tracking_integrity, auction_pressure, sample_size],
    "hook_dropoff": [landing_page_health, tracking_integrity, auction_pressure, sample_size],
    "impression_share_loss": [budget_capped, demand_rising, cpc_stable],
    "silent_bleeder": [sibling_tracking, clicks_flowing, saturation],
    "cpa_spike": [store_orders_dropped, server_conversions_dropped],
    "attribution_overlap": [claims_outpace_store, driver_correlation, aov_stable],
}

REJECTION_REASON = {
    "cpa_spike": "Tracking outage — pixel conversions fell while first-party orders and server conversions held steady.",
}


def verdict(f: dict, checks: list[dict]) -> tuple[str, float]:
    if not checks:
        return "rejected", 0.5
    required = [c for c in checks if c.get("required", True)]
    confirmed = bool(required) and all(c["passed"] for c in required)
    passed_ratio = sum(1 for c in checks if c["passed"]) / len(checks)
    raw_z = f.get("z")
    z_val = abs(float(raw_z)) if raw_z is not None and np.isfinite(raw_z) else 3.0
    z_term = min(1.0, z_val / 6.0)
    confidence = 0.45 + 0.4 * passed_ratio + 0.15 * z_term if confirmed else 0.9 - 0.4 * passed_ratio
    return ("confirmed" if confirmed else "rejected"), round(min(max(confidence, 0.05), 0.99), 3)


def run_checks(ev: Evidence, f: dict) -> list[dict]:
    return [check(ev, f) for check in CHECKS.get(f.get("kind", ""), [])]
