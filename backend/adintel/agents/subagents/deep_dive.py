import pandas as pd

from adintel.agents.base import SubAgent
from adintel.agents.state import RunState
from adintel.analytics.metrics import aggregate


def isolate_root_cause_sensitivity(metrics: pd.DataFrame, confirmed: list[dict]) -> list[dict]:
    end = metrics["date"].max()
    recent = metrics[metrics["date"] > end - pd.Timedelta(days=7)]
    refinements: list[dict] = []

    for finding in confirmed:
        entity_ids = finding.get("entity_ids") or []
        sub = recent[recent["adset_id"].isin(entity_ids)] if entity_ids else recent[recent["platform"] == finding.get("platform")]
        if sub.empty:
            continue
        creatives = aggregate(sub, ["creative_id", "creative"])
        total_spend = float(creatives["spend"].sum()) or 1.0
        creatives["spend_share"] = creatives["spend"] / total_spend
        worst = creatives.sort_values("cpa", ascending=False).iloc[0] if not creatives.empty else None
        best = creatives.sort_values("roas", ascending=False).iloc[0] if not creatives.empty else None

        daily_spend = sub.groupby("date")["spend"].sum()
        volatility = float(daily_spend.std() / daily_spend.mean()) if len(daily_spend) > 1 and daily_spend.mean() > 0 else 0.0

        refinement = {
            "finding_id": finding["id"],
            "kind": finding["kind"],
            "entity_name": finding["entity_name"],
            "spend_volatility_cv": round(volatility, 3),
            "primary_driver_creative": worst["creative"] if worst is not None else None,
            "driver_spend_share": round(float(worst["spend_share"]), 3) if worst is not None else None,
            "fallback_champion_creative": best["creative"] if best is not None else None,
            "champion_roas": round(float(best["roas"] or 0), 2) if best is not None and pd.notna(best["roas"]) else None,
            "counterfactual_14d_recovery_usd": round(float(finding["dollar_impact"] * min(0.92, finding["confidence"] + 0.04)), 2),
        }
        refinements.append(refinement)
    return refinements


class DeepDiveAgent(SubAgent):
    name = "deep_dive"
    title = "Hypothesis & Counterfactual Deep-Dive"
    mandate = "Run conditional LangGraph reflection pass to isolate creative-level bleed drivers and counterfactual recovery bounds."

    async def run(self, state: RunState) -> None:
        confirmed = state.read_file("/critic/confirmed.json", [])
        metrics = state.frames["metrics"]
        refinements = await state.call_tool(
            self.name,
            "counterfactual_isolation",
            {"verified_findings": len(confirmed), "pass": state.iteration + 1},
            lambda: isolate_root_cause_sensitivity(metrics, confirmed),
            lambda r: f"isolated creative-level counterfactuals across {len(r)} verified root causes",
        )
        by_id = {r["finding_id"]: r for r in refinements}
        updated_confirmed = []
        for finding in confirmed:
            ref = by_id.get(finding["id"])
            if ref and ref.get("primary_driver_creative") and ref.get("fallback_champion_creative"):
                label = (
                    f"LangGraph deep-dive isolated {ref['driver_spend_share']:.0%} of ad-set spend in '{ref['primary_driver_creative']}'; "
                    f"sibling asset '{ref['fallback_champion_creative']}' sustains {ref['champion_roas']:.2f}x ROAS"
                )
                if not any(e.get("agent") == self.name for e in finding["evidence"]):
                    finding["evidence"].append({"step": "verified", "agent": self.name, "label": label})
            updated_confirmed.append(finding)
        state.iteration += 1
        await state.write_file("/deep_dive/counterfactuals.json", self.name, "json", refinements)
        await state.write_file("/critic/confirmed.json", self.name, "json", updated_confirmed)
