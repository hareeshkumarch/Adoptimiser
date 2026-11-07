import math

import numpy as np
import pandas as pd

WINDOW_SUFFIX = {"1d_click": "1d", "7d_click": "7d", "data_driven": "dd"}
ADDITIVE = [
    "spend", "daily_budget", "impressions", "clicks", "conversions", "revenue", "video_3s", "video_15s",
    "video_imps", "sessions", "lp_conversions", "freq_w", "freq_imps", "is_w", "is_imps",
]
LEVEL_KEYS = {
    "platform": ["platform"],
    "campaign": ["platform", "account_id", "campaign_id", "campaign"],
    "adset": ["platform", "account_id", "campaign_id", "campaign", "adset_id", "adset"],
    "creative": ["platform", "account_id", "campaign_id", "campaign", "adset_id", "adset", "creative_id", "creative"],
}


def apply_window(frame: pd.DataFrame, window: str) -> pd.DataFrame:
    suffix = WINDOW_SUFFIX[window]
    out = frame.copy()
    out["conversions"] = out[f"conversions_{suffix}"]
    out["revenue"] = out[f"revenue_{suffix}"]
    v3 = pd.to_numeric(out["video_3s"], errors="coerce")
    v15 = pd.to_numeric(out["video_15s"], errors="coerce")
    freq = pd.to_numeric(out["frequency"], errors="coerce")
    isl = pd.to_numeric(out["is_lost_budget"], errors="coerce")
    out["video_imps"] = out["impressions"].where(v3.notna(), 0)
    out["freq_imps"] = out["impressions"].where(freq.notna(), 0)
    out["freq_w"] = freq.fillna(0.0) * out["impressions"]
    out["is_imps"] = out["impressions"].where(isl.notna(), 0)
    out["is_w"] = isl.fillna(0.0) * out["impressions"]
    out["video_3s"] = v3.fillna(0.0)
    out["video_15s"] = v15.fillna(0.0)
    return out


def _ratio(a, b):
    return a / b.replace(0, np.nan) if isinstance(b, pd.Series) else (a / b if b else np.nan)


def derive(g: pd.DataFrame) -> pd.DataFrame:
    g = g.copy()
    g["roas"] = _ratio(g["revenue"], g["spend"])
    g["cpa"] = _ratio(g["spend"], g["conversions"])
    g["cpm"] = _ratio(g["spend"], g["impressions"]) * 1000
    g["cpc"] = _ratio(g["spend"], g["clicks"])
    g["ctr"] = _ratio(g["clicks"], g["impressions"])
    g["hook_rate"] = _ratio(g["video_3s"], g["video_imps"])
    g["hold_rate"] = _ratio(g["video_15s"], g["video_3s"])
    g["frequency"] = _ratio(g["freq_w"], g["freq_imps"])
    g["is_lost"] = _ratio(g["is_w"], g["is_imps"])
    g["lp_cvr"] = _ratio(g["lp_conversions"], g["sessions"])
    g["budget_use"] = _ratio(g["spend"], g["daily_budget"])
    return g


def aggregate(frame: pd.DataFrame, keys: list[str]) -> pd.DataFrame:
    return derive(frame.groupby(keys, as_index=False)[ADDITIVE].sum())


def totals(frame: pd.DataFrame, scale: float = 1.0) -> pd.Series:
    return derive(pd.DataFrame([frame[ADDITIVE].sum() * scale])).iloc[0]


def split_periods(frame: pd.DataFrame, compare: str, days: int = 7) -> tuple[pd.DataFrame, pd.DataFrame, float]:
    end = frame["date"].max()
    cur_start = end - pd.Timedelta(days=days - 1)
    current = frame[frame["date"] >= cur_start]
    if compare == "previous_period":
        base_start = cur_start - pd.Timedelta(days=days)
        return current, frame[(frame["date"] >= base_start) & (frame["date"] < cur_start)], 1.0
    base_start = cur_start - pd.Timedelta(days=30)
    return current, frame[(frame["date"] >= base_start) & (frame["date"] < cur_start)], days / 30


def pct_change(current, baseline):
    if baseline is None or current is None or not np.isfinite(baseline) or not np.isfinite(current) or baseline == 0:
        return None
    return float(current / baseline - 1)


def jsonable(value):
    if isinstance(value, dict):
        return {str(k): jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [jsonable(v) for v in value]
    if isinstance(value, (pd.Timestamp,)):
        return value.date().isoformat()
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        v = float(value)
        return None if math.isnan(v) or math.isinf(v) else round(v, 6)
    if isinstance(value, np.bool_):
        return bool(value)
    return value


def to_records(frame: pd.DataFrame, columns: list[str], limit: int = 30) -> dict:
    return {"columns": columns, "rows": jsonable(frame[columns].head(limit).to_dict("records"))}
