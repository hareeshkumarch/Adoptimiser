import numpy as np
import pandas as pd

from adintel.agents.base import SubAgent
from adintel.agents.state import RunState
from adintel.analytics.metrics import LEVEL_KEYS, aggregate, to_records


def compute_funnel_forensics(metrics: pd.DataFrame) -> list[dict]:
    end = metrics["date"].max()
    recent_start = end - pd.Timedelta(days=6)
    base_start = recent_start - pd.Timedelta(days=21)
    recent = metrics[metrics["date"] >= recent_start]
    base = metrics[(metrics["date"] >= base_start) & (metrics["date"] < recent_start)]

    cur_plat = aggregate(recent, LEVEL_KEYS["platform"])
    base_plat = aggregate(base, LEVEL_KEYS["platform"])
    merged = cur_plat.merge(base_plat, on="platform", suffixes=("_cur", "_base"))

    diagnostics: list[dict] = []
    for row in merged.to_dict("records"):
        click_to_session_cur = row["sessions_cur"] / max(row["clicks_cur"], 1)
        click_to_session_base = row["sessions_base"] / max(row["clicks_base"], 1)
        pixel_to_lp_cur = row["conversions_cur"] / max(row["lp_conversions_cur"], 1e-6)
        pixel_to_lp_base = row["conversions_base"] / max(row["lp_conversions_base"], 1e-6)
        cpm_drift = (row["cpm_cur"] / row["cpm_base"] - 1) if row.get("cpm_base") else 0.0
        lp_cvr_drift = (row["lp_cvr_cur"] / row["lp_cvr_base"] - 1) if row.get("lp_cvr_base") else 0.0
        hook_drift = (row["hook_rate_cur"] / row["hook_rate_base"] - 1) if row.get("hook_rate_base") else None
        hold_drift = (row["hold_rate_cur"] / row["hold_rate_base"] - 1) if row.get("hold_rate_base") else None

        bottleneck = "healthy"
        if hook_drift is not None and hook_drift < -0.15:
            bottleneck = "creative_thumbstop_decay"
        elif cpm_drift > 0.18:
            bottleneck = "auction_cpm_inflation"
        elif lp_cvr_drift < -0.12:
            bottleneck = "landing_page_friction"
        elif abs(pixel_to_lp_cur - pixel_to_lp_base) > 0.2:
            bottleneck = "attribution_claim_inflation"

        diagnostics.append({
            "platform": row["platform"],
            "ctr_cur": round(float(row["ctr_cur"] or 0), 4),
            "click_to_session_rate": round(float(click_to_session_cur), 4),
            "click_to_session_delta": round(float(click_to_session_cur - click_to_session_base), 4),
            "lp_cvr_cur": round(float(row["lp_cvr_cur"] or 0), 4),
            "lp_cvr_delta": round(float(lp_cvr_drift), 4),
            "pixel_vs_server_ratio": round(float(pixel_to_lp_cur), 3),
            "cpm_delta": round(float(cpm_drift), 4),
            "hook_delta": round(float(hook_drift), 4) if hook_drift is not None and np.isfinite(hook_drift) else None,
            "hold_delta": round(float(hold_drift), 4) if hold_drift is not None and np.isfinite(hold_drift) else None,
            "primary_bottleneck": bottleneck,
        })
    return diagnostics


def compute_creative_cohorts(metrics: pd.DataFrame) -> pd.DataFrame:
    end = metrics["date"].max()
    recent = metrics[metrics["date"] > end - pd.Timedelta(days=7)]
    grouped = aggregate(recent, ["platform", "campaign", "adset", "creative"])
    grouped["efficiency_index"] = (grouped["roas"].fillna(0) * (1 - grouped["is_lost"].fillna(0))) / np.maximum(grouped["frequency"].fillna(1.5), 1.0)
    return grouped.sort_values("spend", ascending=False)


class ForensicsAgent(SubAgent):
    name = "forensics"
    title = "Creative & Funnel Forensics"
    mandate = "Decompose full-funnel stage conversion leakage (Impression → Click → Session → Server LP → Pixel) and creative cohort decay."

    async def run(self, state: RunState) -> None:
        metrics = state.frames["metrics"]
        funnel = await state.call_tool(
            self.name,
            "decompose_funnel_leakage",
            {"stages": ["impressions", "clicks", "sessions", "lp_conversions", "pixel_conversions"]},
            lambda: compute_funnel_forensics(metrics),
            lambda d: f"{len(d)} platforms audited across 5 funnel stages",
        )
        cohorts = await state.call_tool(
            self.name,
            "score_creative_cohorts",
            {"window": "7d", "metric": "efficiency_index"},
            lambda: compute_creative_cohorts(metrics),
            lambda df: f"scored {len(df)} active creatives by fatigue-adjusted ROAS",
        )
        await state.write_file("/forensics/funnel_integrity.json", self.name, "json", funnel)
        await state.write_file(
            "/forensics/creative_cohorts.table",
            self.name,
            "table",
            to_records(cohorts, ["platform", "adset", "creative", "spend", "roas", "cpa", "ctr", "hook_rate", "hold_rate", "frequency"], 20),
        )
