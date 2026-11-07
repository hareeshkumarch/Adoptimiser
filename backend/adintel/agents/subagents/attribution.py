from adintel.agents.base import SubAgent
from adintel.agents.state import RunState
from adintel.analytics.metrics import to_records
from adintel.diagnostics import attribution as rules


class AttributionAgent(SubAgent):
    name = "attribution"
    title = "Cross-Channel Attribution & Cannibalization"
    mandate = "Compare platform-reported conversions vs. first-party blended MER and find where one platform takes credit for another's traffic."

    async def run(self, state: RunState) -> None:
        metrics, store = state.frames["metrics"], state.frames["store"]
        daily = await state.call_tool(
            self.name, "claimed_vs_store_revenue", {"window": state.window, "truth": "first-party orders"},
            lambda: rules.claimed_vs_store(metrics, store),
            lambda d: f"overlap ratio {d['overlap_ratio'].iloc[:14].mean():.2f}x → {d['overlap_ratio'].iloc[-14:].mean():.2f}x",
        )
        correlation = await state.call_tool(
            self.name, "lagged_correlation", {"driver": "meta.prospecting.impressions", "target": "google.brand.conversions", "lags": [0, 1, 2, 3]},
            lambda: rules.lagged_correlation(metrics),
            lambda c: f"best r = {c['corr']:.2f} at lag {c['best_lag']}d" if c else "platform pair not in scope",
        )
        shift = await state.call_tool(
            self.name, "overlap_ratio_shift", {"days": rules.ATTRIBUTION_DAYS},
            lambda: rules.overlap_shift(daily),
            lambda s: f"claimed {s['claimed_growth']:+.0%} vs store {s['store_growth']:+.0%} · MER {s['mer_recent']:.2f}",
        )
        await state.write_file("/attribution/mer_daily.table", self.name, "table", to_records(daily.sort_values("date", ascending=False), ["date", "spend", "claimed", "store_revenue", "overlap_ratio", "mer"], 21))
        await state.write_file("/attribution/overlap.json", self.name, "json", {"shift": shift, "correlation": correlation})
        finding = rules.detect_overlap(shift, correlation, metrics)
        candidates = [finding] if finding else []
        await state.write_file("/attribution/candidates.json", self.name, "json", candidates)
        for c in candidates:
            await state.emit("finding_candidate", self.name, id=c["id"], title=c["title"], headline=c["headline"], entity=c["entity_name"])
