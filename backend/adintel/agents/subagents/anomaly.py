from adintel.agents.base import SubAgent
from adintel.agents.state import RunState
from adintel.analytics.metrics import to_records
from adintel.diagnostics import anomaly as rules


class AnomalyAgent(SubAgent):
    name = "anomaly"
    title = "Anomaly & Bleed Detector"
    mandate = "Run robust z-score and rolling-window checks to flag budget bleeders, CPA spikes, creative fatigue and audience saturation."

    async def run(self, state: RunState) -> None:
        daily = await state.call_tool(
            self.name, "aggregate_adset_daily", {"source": "/ingestion/metrics", "grain": "adset × day"},
            lambda: rules.adset_daily(state.frames["metrics"]),
            lambda d: f"{d['adset_id'].nunique()} ad sets × {d['date'].nunique()} days",
        )
        stats = await state.call_tool(
            self.name, "window_shift_test", {"recent_days": rules.RECENT_DAYS, "baseline_days": rules.BASE_DAYS, "method": "robust z (median/MAD)"},
            lambda: rules.window_stats(daily),
            lambda s: f"scored {len(s)} ad sets on {len(rules.STAT_METRICS)} metrics",
        )
        trends = await state.call_tool(
            self.name, "classify_patterns", {"patterns": ["creative_fatigue", "hook_dropoff", "impression_share_loss", "silent_bleeder"]},
            lambda: rules.classify(state.frames["metrics"], stats),
            lambda f: f"{len(f)} trend candidates",
        )
        spikes = await state.call_tool(
            self.name, "rolling_zscore_scan", {"metric": "cpa", "window": "14d rolling", "threshold": 3.5},
            lambda: rules.spike_scan(daily, {i for f in trends for i in f["entity_ids"]}),
            lambda s: f"{len(s)} short-lived spike clusters",
        )
        table = daily[daily["date"] == daily["date"].max()].sort_values("spend", ascending=False)
        await state.write_file("/anomaly/adset_latest_day.table", self.name, "table", to_records(table, ["platform", "adset", "spend", "cpa", "ctr", "hook_rate", "frequency", "is_lost"]))
        await state.write_file("/anomaly/zscores.json", self.name, "json", [
            {"adset": s["adset"], "platform": s["platform"], **{m: {"change": v["change"], "z": v["z"]} for m, v in s["metrics"].items() if m in ("cpa", "hook_rate", "frequency", "is_lost", "conversions")}}
            for s in stats
        ])
        candidates = trends + spikes
        await state.write_file("/anomaly/candidates.json", self.name, "json", candidates)
        for c in candidates:
            await state.emit("finding_candidate", self.name, id=c["id"], title=c["title"], headline=c["headline"], entity=c["entity_name"])
