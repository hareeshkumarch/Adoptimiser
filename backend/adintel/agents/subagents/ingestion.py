import asyncio

import pandas as pd

from adintel.agents.base import SubAgent
from adintel.agents.state import RunState
from adintel.analytics.dataset import load_raw, load_store, normalize_currency
from adintel.analytics.metrics import aggregate, apply_window, to_records
from adintel.models import Scope
from adintel.sandbox.catalog import FX_TO_USD

PLATFORMS = ["meta", "google", "tiktok", "linkedin"]


class IngestionAgent(SubAgent):
    name = "ingestion"
    title = "Ingestion & Normalization"
    mandate = "Pull Meta, Google, TikTok and LinkedIn metrics, normalize currency and attribution window, write the unified frame."

    async def _fetch(self, state: RunState, platform: str) -> pd.DataFrame:
        scope = Scope(platform=platform, account_id=state.scope.account_id if state.scope.platform == platform else None)
        return await state.call_tool(
            self.name,
            "fetch_platform_metrics",
            {"platform": platform, "days": 60},
            lambda: load_raw(scope),
            lambda f: f"{len(f)} creative-day rows · {f['creative_id'].nunique()} creatives · {f['currency'].iloc[0]}",
        )

    async def run(self, state: RunState) -> None:
        platforms = [state.scope.platform] if state.scope.platform else PLATFORMS
        frames = await asyncio.gather(*(self._fetch(state, p) for p in platforms))
        raw = pd.DataFrame([row for f in frames for row in f.to_dict("records")])
        raw["date"] = pd.to_datetime(raw["date"])
        normalized = await state.call_tool(
            self.name,
            "normalize_currency",
            {"target": "USD", "fx": FX_TO_USD},
            lambda: normalize_currency(raw),
            lambda f: f"converted {f['currency'].nunique()} currencies to USD",
        )
        windowed = await state.call_tool(
            self.name,
            "apply_attribution_window",
            {"window": state.window},
            lambda: apply_window(normalized, state.window),
            lambda f: f"conversions/revenue mapped to {state.window}",
        )
        store = await state.call_tool(
            self.name,
            "fetch_store_orders",
            {"source": "first-party orders", "days": 60},
            load_store,
            lambda f: f"{len(f)} days · {f['orders'].sum():,.0f} orders",
        )
        state.frames["metrics"] = windowed
        state.frames["store"] = store
        coverage = {
            "platforms": platforms,
            "rows": len(windowed),
            "date_range": [windowed["date"].min(), windowed["date"].max()],
            "currencies": sorted(raw["currency"].unique().tolist()),
            "window": state.window,
            "metrics": ["spend", "roas", "cpa", "cpm", "ctr", "hook_rate", "hold_rate", "frequency", "is_lost"],
        }
        await state.write_file("/ingestion/coverage.json", self.name, "json", coverage)
        summary = aggregate(windowed[windowed["date"] > windowed["date"].max() - pd.Timedelta(days=7)], ["platform"])
        await state.write_file(
            "/ingestion/platform_last7d.table",
            self.name,
            "table",
            to_records(summary, ["platform", "spend", "revenue", "roas", "cpa", "cpm", "ctr", "hook_rate", "frequency"]),
        )
