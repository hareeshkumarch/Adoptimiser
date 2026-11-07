import json
from typing import Any

from adintel.agents.graph import END, START, CompiledStateGraph, StateGraph
from adintel.agents.llm import LlmGateway, classify_query_intent
from adintel.agents.planner import Planner
from adintel.agents.prompts import SYNTHESIS_SYSTEM
from adintel.agents.state import RunState
from adintel.agents.subagents.anomaly import AnomalyAgent
from adintel.agents.subagents.attribution import AttributionAgent
from adintel.agents.subagents.critic import CriticAgent
from adintel.agents.subagents.deep_dive import DeepDiveAgent
from adintel.agents.subagents.forensics import ForensicsAgent
from adintel.agents.subagents.ingestion import IngestionAgent
from adintel.agents.subagents.optimizer import OptimizerAgent
from adintel.analytics.metrics import jsonable
from adintel.db import db

class Orchestrator:
    name = "orchestrator"

    def __init__(self, llm: LlmGateway):
        self.llm = llm
        self.ingestion = IngestionAgent(llm)
        self.anomaly = AnomalyAgent(llm)
        self.attribution = AttributionAgent(llm)
        self.forensics = ForensicsAgent(llm)
        self.critic = CriticAgent(llm)
        self.deep_dive = DeepDiveAgent(llm)
        self.optimizer = OptimizerAgent(llm)
        agents = [self.ingestion, self.anomaly, self.attribution, self.forensics, self.critic, self.deep_dive, self.optimizer]
        owners = (
            {"router": "Classify user investigation intent and configure dynamic StateGraph routing."}
            | {a.name: a.mandate for a in agents}
            | {self.name: "Synthesize the cross-channel narrative from verified findings only."}
        )
        self.planner = Planner(llm, owners)
        self.graph: CompiledStateGraph = self._build_graph()

    def _build_graph(self) -> CompiledStateGraph:
        workflow = StateGraph(RunState)
        workflow.add_node("router", self._node_router, label="Intent Router · classify_query", role="router", stage=0)
        workflow.add_node("planner", self._node_planner, label="Planner · write_todos", role="planner", stage=1)
        workflow.add_node("ingestion", self._node_ingestion, label="Ingestion & Normalization", role="subagent", stage=2)
        workflow.add_node("anomaly", self._node_anomaly, label="Anomaly & Bleed Detector", role="subagent", stage=3, parallel_group="diagnostics")
        workflow.add_node("attribution", self._node_attribution, label="Attribution & Cannibalization", role="subagent", stage=3, parallel_group="diagnostics")
        workflow.add_node("forensics", self._node_forensics, label="Creative & Funnel Forensics", role="subagent", stage=3, parallel_group="diagnostics")
        workflow.add_node("critic", self._node_critic, label="Adversarial Verifier & Critic", role="verifier", stage=4)
        workflow.add_node("deep_dive", self._node_deep_dive, label="Hypothesis & Counterfactual Deep-Dive", role="reflection", stage=5)
        workflow.add_node("optimizer", self._node_optimizer, label="Optimization & Portfolio Solver", role="planner", stage=6)
        workflow.add_node("orchestrator", self._node_synthesize, label="Orchestrator Synthesis", role="synthesizer", stage=7)

        workflow.add_edge(START, "router")
        workflow.add_edge("router", "planner")
        workflow.add_edge("planner", "ingestion")
        workflow.add_edge("ingestion", "anomaly")
        workflow.add_edge("ingestion", "attribution")
        workflow.add_edge("ingestion", "forensics")
        workflow.add_edge("anomaly", "critic")
        workflow.add_edge("attribution", "critic")
        workflow.add_edge("forensics", "critic")
        workflow.add_conditional_edges(
            "critic",
            self._should_reinvestigate,
            {
                "reinvestigate": "deep_dive",
                "proceed": "optimizer",
            },
        )
        workflow.add_edge("deep_dive", "optimizer")
        workflow.add_edge("optimizer", "orchestrator")
        workflow.add_edge("orchestrator", END)
        return workflow.compile()

    @staticmethod
    def _should_reinvestigate(state: RunState) -> str:
        confirmed = state.read_file("/critic/confirmed.json", [])
        if state.iteration == 0 and len(confirmed) > 0:
            return "reinvestigate"
        return "proceed"

    async def _node_router(self, state: RunState) -> dict[str, Any]:
        await state.emit("agent_start", "router", title="Intent Router")
        intent_spec = await state.call_tool(
            "router",
            "classify_investigation_intent",
            {"query": state.query[:120], "scope": state.scope.model_dump(), "window": state.window},
            lambda: classify_query_intent(state.query),
            lambda r: f"intent={r['intent']} · focus={','.join(r['focus_metrics'][:4])}",
        )
        await state.write_file("/router/intent.json", "router", "json", intent_spec)
        await state.emit("agent_end", "router", title="Intent Router")
        return {"intent": intent_spec["intent"]}

    async def _node_planner(self, state: RunState) -> dict[str, Any]:
        await self.planner(state)
        await state.set_owner_status("router", "done")
        return {"todos": len(state.todos)}

    async def _node_ingestion(self, state: RunState) -> dict[str, Any]:
        await self.ingestion(state)
        cov = state.read_file("/ingestion/coverage.json", {})
        return {"rows": cov.get("rows", 0), "platforms": cov.get("platforms", [])}

    async def _node_anomaly(self, state: RunState) -> dict[str, Any]:
        await self.anomaly(state)
        cands = state.read_file("/anomaly/candidates.json", [])
        return {"candidates": len(cands)}

    async def _node_attribution(self, state: RunState) -> dict[str, Any]:
        await self.attribution(state)
        cands = state.read_file("/attribution/candidates.json", [])
        return {"candidates": len(cands)}

    async def _node_forensics(self, state: RunState) -> dict[str, Any]:
        await self.forensics(state)
        funnel = state.read_file("/forensics/funnel_integrity.json", [])
        return {"platforms_audited": len(funnel)}

    async def _node_critic(self, state: RunState) -> dict[str, Any]:
        await self.critic(state)
        confirmed = state.read_file("/critic/confirmed.json", [])
        rejected = state.read_file("/critic/rejected.json", [])
        return {"confirmed": len(confirmed), "rejected": len(rejected)}

    async def _node_deep_dive(self, state: RunState) -> dict[str, Any]:
        await self.deep_dive(state)
        cfs = state.read_file("/deep_dive/counterfactuals.json", [])
        return {"counterfactuals": len(cfs)}

    async def _node_optimizer(self, state: RunState) -> dict[str, Any]:
        await self.optimizer(state)
        rx = state.read_file("/optimizer/prescriptions.json", [])
        return {"prescriptions": len(rx)}

    async def _node_synthesize(self, state: RunState) -> dict[str, Any]:
        narrative = await self._synthesize(state)
        return {"narrative_chars": len(narrative)}

    def topology(self) -> dict[str, Any]:
        return self.graph.topology()

    async def run(self, state: RunState) -> dict:
        await state.emit("run_started", self.name, query=state.query, scope=state.scope.model_dump(), window=state.window)
        graph_meta = await self.graph.ainvoke(state)
        await state.write_file("/orchestrator/langgraph_execution.json", self.name, "json", graph_meta)
        return {
            "findings": state.read_file("/critic/confirmed.json", []),
            "rejected": state.read_file("/critic/rejected.json", []),
            "prescriptions": state.read_file("/optimizer/prescriptions.json", []),
            "curves": state.read_file("/optimizer/curves.json", {}),
            "forensics": state.read_file("/forensics/funnel_integrity.json", []),
            "portfolio": state.read_file("/optimizer/portfolio.json", {}),
            "graph_meta": graph_meta,
            "narrative": state.read_file("/orchestrator/narrative.md", ""),
        }

    def _brief(self, state: RunState) -> str:
        intent_spec = state.read_file("/router/intent.json", {}) or {}
        brief = {
            "intent": intent_spec.get("intent", "full_diagnostic"),
            "coverage": state.read_file("/ingestion/coverage.json", {}),
            "platform_last7d": (state.read_file("/ingestion/platform_last7d.table", {}) or {}).get("rows", []),
            "attribution": (state.read_file("/attribution/overlap.json", {}) or {}).get("shift", {}),
            "forensics": state.read_file("/forensics/funnel_integrity.json", []),
            "portfolio": state.read_file("/optimizer/portfolio.json", {}),
            "confirmed": [
                {
                    "title": f["title"],
                    "headline": f["headline"],
                    "entity": f["entity_name"],
                    "impact_usd": f["dollar_impact"],
                    "impact_type": f["impact_type"],
                    "confidence": f["confidence"],
                }
                for f in state.read_file("/critic/confirmed.json", [])
            ],
            "rejected": [
                {"title": f["title"], "headline": f["headline"], "reason": f["critic"].get("rejection_reason")}
                for f in state.read_file("/critic/rejected.json", [])
            ],
            "top_prescription": (state.read_file("/optimizer/prescriptions.json", []) or [{}])[0].get("title"),
        }
        return json.dumps(jsonable(brief))

    async def _synthesize(self, state: RunState) -> str:
        await state.emit("agent_start", self.name, title="Orchestrator Synthesis")
        await state.set_owner_status(self.name, "in_progress")
        await state.emit(
            "tool_call",
            self.name,
            tool="read_scratchpad",
            args={"paths": ["/router/intent.json", "/critic/confirmed.json", "/critic/rejected.json", "/deep_dive/counterfactuals.json", "/optimizer/prescriptions.json"]},
        )
        brief = json.loads(self._brief(state))
        ws = await db.workspace.find_one({"key": "default"}, {"_id": 0, "goal": 1, "target_roas": 1, "monthly_budget": 1}) or {}
        brief["business_goal"] = ws
        parts = []
        async for chunk in self.llm.stream(f"{state.run_id}:synthesis", SYNTHESIS_SYSTEM, json.dumps(brief)):
            parts.append(chunk)
            await state.emit("narrative_delta", self.name, delta=chunk)
        narrative = "".join(parts).strip()
        await state.write_file("/orchestrator/narrative.md", self.name, "markdown", narrative)
        await state.set_owner_status(self.name, "done")
        await state.emit("agent_end", self.name, title="Orchestrator Synthesis")
        return narrative
