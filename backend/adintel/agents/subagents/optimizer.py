from adintel.agents.base import SubAgent
from adintel.agents.state import RunState
from adintel.diagnostics.optimizer import prescribe, response_curves, solve_portfolio_allocation


class OptimizerAgent(SubAgent):
    name = "optimizer"
    title = "Optimization Planner"
    mandate = "Turn verified root causes into prescriptions ranked by dollar impact × critic confidence, with budget response curves."

    async def run(self, state: RunState) -> None:
        curves = await state.call_tool(
            self.name,
            "fit_response_curves",
            {"model": "log-log spend→revenue", "days": 60},
            lambda: response_curves(state.frames["metrics"]),
            lambda c: " · ".join(f"{p} β={v['elasticity']:.2f}" for p, v in c.items()),
        )
        portfolio = await state.call_tool(
            self.name,
            "solve_portfolio_equilibrium",
            {"objective": "maximize marginal ROAS across channels", "max_shift_pct": 0.30},
            lambda: solve_portfolio_allocation(curves, 0.30),
            lambda p: f"optimal reallocation lifts weekly revenue +${p['revenue_lift']:,.0f} ({p['base_roas']:.2f}x → {p['optimal_roas']:.2f}x)",
        )
        confirmed = state.read_file("/critic/confirmed.json", []) or []
        prescriptions = await state.call_tool(
            self.name,
            "rank_prescriptions",
            {"rank_by": "dollar_impact × confidence", "verified_findings": len(confirmed)},
            lambda: prescribe(confirmed, curves),
            lambda rx: f"{len(rx)} prescriptions · ${sum(r['dollar_impact'] for r in rx):,.0f} addressable",
        )
        await state.write_file("/optimizer/curves.json", self.name, "json", curves)
        await state.write_file("/optimizer/portfolio.json", self.name, "json", portfolio)
        await state.write_file("/optimizer/prescriptions.json", self.name, "json", prescriptions)
