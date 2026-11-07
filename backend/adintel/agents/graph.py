import asyncio
from dataclasses import dataclass, field
from time import perf_counter
from typing import Any, Awaitable, Callable, Hashable

try:
    from langgraph.graph import END as LG_END, START as LG_START, StateGraph as LgStateGraph
    HAS_LANGGRAPH = True
except ImportError:
    LG_START = "__start__"
    LG_END = "__end__"
    LgStateGraph = None
    HAS_LANGGRAPH = False

START = "__start__"
END = "__end__"

NodeFn = Callable[[Any], Awaitable[dict | None]]
ConditionFn = Callable[[Any], str | list[str]]

MAX_SUPERSTEPS = 12
RECURSION_LIMIT = 16
MAX_PASSES = 2
EPSILON_CONFIDENCE = 0.02

NODE_VISIT_BUDGETS: dict[str, int] = {
    "router": 1,
    "planner": 1,
    "ingestion": 2,
    "anomaly": 2,
    "attribution": 2,
    "forensics": 2,
    "critic": 2,
    "deep_dive": 1,
    "optimizer": 1,
    "orchestrator": 1,
}

NODE_TIMEOUT_SECONDS: dict[str, float] = {
    "router": 5.0,
    "planner": 8.0,
    "ingestion": 12.0,
    "anomaly": 10.0,
    "attribution": 10.0,
    "forensics": 12.0,
    "critic": 10.0,
    "deep_dive": 12.0,
    "optimizer": 10.0,
    "orchestrator": 15.0,
}

STAGE_CATALOG: dict[str, tuple[int, int, str]] = {
    "router": (1, 8, "Classifying query intent & scope"),
    "planner": (2, 18, "Drafting multi-agent investigation plan"),
    "ingestion": (3, 30, "Normalizing 60d multi-currency telemetry"),
    "anomaly": (4, 48, "Scanning robust MAD z-scores & spikes"),
    "attribution": (5, 56, "Reconciling platform claims vs. store MER"),
    "forensics": (6, 65, "Decomposing 5-stage funnel & creative cohorts"),
    "critic": (7, 76, "Running adversarial falsification checks"),
    "deep_dive": (8, 85, "Isolating creative counterfactual bounds"),
    "optimizer": (9, 93, "Solving marginal ROAS portfolio equilibrium"),
    "orchestrator": (10, 100, "Streaming executive synthesis"),
}
TOTAL_STAGES = 10


@dataclass
class GraphEdge:
    source: str
    target: str
    conditional: bool = False
    label: str | None = None


@dataclass
class GraphNodeMeta:
    id: str
    label: str
    role: str
    stage: int
    parallel_group: str | None = None


@dataclass
class GraphCheckpoint:
    step: int
    node: str
    duration_ms: float
    summary: dict[str, Any] = field(default_factory=dict)


class StateGraph:
    def __init__(self, state_schema: Any = dict):
        self.state_schema = state_schema
        self.nodes: dict[str, NodeFn] = {}
        self.edges: dict[str, list[str]] = {}
        self.conditional_edges: dict[str, tuple[ConditionFn, dict[Hashable, str]]] = {}
        self.node_meta: dict[str, GraphNodeMeta] = {}

    def add_node(self, name: str, action: NodeFn, *, label: str | None = None, role: str = "agent", stage: int = 0, parallel_group: str | None = None) -> "StateGraph":
        self.nodes[name] = action
        self.node_meta[name] = GraphNodeMeta(id=name, label=label or name.replace("_", " ").title(), role=role, stage=stage, parallel_group=parallel_group)
        return self

    def add_edge(self, start_key: str, end_key: str) -> "StateGraph":
        self.edges.setdefault(start_key, []).append(end_key)
        return self

    def add_conditional_edges(self, source: str, path: ConditionFn, path_map: dict[Hashable, str]) -> "StateGraph":
        self.conditional_edges[source] = (path, path_map)
        return self

    def compile(self) -> "CompiledStateGraph":
        return CompiledStateGraph(self)


class CompiledStateGraph:
    def __init__(self, builder: StateGraph):
        self.builder = builder

    def topology(self) -> dict[str, Any]:
        nodes = [
            {
                "id": meta.id,
                "label": meta.label,
                "role": meta.role,
                "stage": meta.stage,
                "parallel_group": meta.parallel_group,
                "visit_budget": NODE_VISIT_BUDGETS.get(meta.id, 1),
                "timeout_s": NODE_TIMEOUT_SECONDS.get(meta.id, 10.0),
            }
            for meta in sorted(self.builder.node_meta.values(), key=lambda m: (m.stage, m.id))
        ]
        edges: list[dict[str, Any]] = []
        for src, targets in self.builder.edges.items():
            for tgt in targets:
                edges.append({"source": src, "target": tgt, "conditional": False, "label": None})
        for src, (_, path_map) in self.builder.conditional_edges.items():
            for branch_key, tgt in path_map.items():
                edges.append({"source": src, "target": tgt, "conditional": True, "label": str(branch_key)})
        return {
            "engine": "langgraph.graph.StateGraph" if HAS_LANGGRAPH else "adintel.langgraph.StateGraph",
            "control_plane": {
                "max_supersteps": MAX_SUPERSTEPS,
                "recursion_limit": RECURSION_LIMIT,
                "max_passes": MAX_PASSES,
                "epsilon_confidence": EPSILON_CONFIDENCE,
            },
            "nodes": nodes,
            "edges": edges,
            "mermaid": self.to_mermaid(),
        }

    def to_mermaid(self) -> str:
        lines = ["graph TD"]
        for meta in sorted(self.builder.node_meta.values(), key=lambda m: (m.stage, m.id)):
            lines.append(f'    {meta.id}["{meta.label}"]')
        for src, targets in self.builder.edges.items():
            s = "START((Start))" if src == START else src
            for tgt in targets:
                t = "END((End))" if tgt == END else tgt
                lines.append(f"    {s} --> {t}")
        for src, (_, path_map) in self.builder.conditional_edges.items():
            for branch_key, tgt in path_map.items():
                t = "END((End))" if tgt == END else tgt
                lines.append(f"    {src} -. {branch_key} .-> {t}")
        return "\n".join(lines)

    async def ainvoke(self, state: Any) -> dict[str, Any]:
        current_nodes = list(self.builder.edges.get(START, []))
        step = 0
        checkpoints: list[dict[str, Any]] = []
        executed_edges: list[dict[str, Any]] = []
        circuit_breaker_events: list[dict[str, Any]] = []
        node_visits: dict[str, int] = {}
        high_water_pct = 0
        halt_reason = "completed_normally"

        while current_nodes:
            active = [n for n in current_nodes if n != END]
            if not active:
                break
            step += 1
            if step > MAX_SUPERSTEPS:
                halt_reason = f"max_supersteps_ceiling_reached ({MAX_SUPERSTEPS})"
                circuit_breaker_events.append({"step": step, "node": active[0], "reason": halt_reason})
                if "orchestrator" not in node_visits:
                    active = ["orchestrator"]
                else:
                    break

            if len(active) > 1:
                await state.emit("fan_out", "orchestrator", agents=active)
                started = perf_counter()
                await asyncio.gather(
                    *(self._run_node(n, state, step, checkpoints, node_visits, circuit_breaker_events, high_water_pct) for n in active)
                )
                for n in active:
                    high_water_pct = max(high_water_pct, STAGE_CATALOG.get(n, (1, 50, ""))[1])
                await state.emit("fan_in", "orchestrator", agents=active, ms=round((perf_counter() - started) * 1000, 1))
            else:
                high_water_pct = await self._run_node(active[0], state, step, checkpoints, node_visits, circuit_breaker_events, high_water_pct)

            next_nodes: list[str] = []
            for node_name in active:
                if node_name in self.builder.conditional_edges:
                    cond_fn, path_map = self.builder.conditional_edges[node_name]
                    remaining = MAX_SUPERSTEPS - step
                    if remaining <= 2 or node_visits.get("deep_dive", 0) >= NODE_VISIT_BUDGETS["deep_dive"]:
                        decision = "proceed"
                        halt_reason = "bounded_horizon_guard_routed_to_optimizer"
                    else:
                        decision = cond_fn(state)
                    resolved = path_map.get(decision, decision)
                    executed_edges.append({"source": node_name, "target": resolved, "conditional": True, "branch": str(decision), "step": step})
                    await state.emit("graph_edge", "orchestrator", source=node_name, target=resolved, branch=str(decision), conditional=True)
                    if resolved not in next_nodes:
                        next_nodes.append(resolved)
                else:
                    for tgt in self.builder.edges.get(node_name, []):
                        executed_edges.append({"source": node_name, "target": tgt, "conditional": False, "branch": None, "step": step})
                        if tgt not in next_nodes:
                            next_nodes.append(tgt)
            current_nodes = [n for n in next_nodes if n != END]

        return {
            "engine": "langgraph.graph.StateGraph" if HAS_LANGGRAPH else "adintel.langgraph.StateGraph",
            "steps": step,
            "max_supersteps": MAX_SUPERSTEPS,
            "recursion_limit": RECURSION_LIMIT,
            "node_visits": node_visits,
            "circuit_breaker_events": circuit_breaker_events,
            "halt_reason": halt_reason,
            "checkpoints": checkpoints,
            "executed_edges": executed_edges,
            "topology": self.topology(),
        }

    async def _run_node(
        self,
        node_name: str,
        state: Any,
        step: int,
        checkpoints: list[dict[str, Any]],
        node_visits: dict[str, int],
        circuit_breaker_events: list[dict[str, Any]],
        prev_pct: int,
    ) -> int:
        visits = node_visits.get(node_name, 0)
        budget = NODE_VISIT_BUDGETS.get(node_name, 1)
        stage_idx, target_pct, stage_desc = STAGE_CATALOG.get(node_name, (step, min(95, step * 10), node_name))
        pct_start = max(prev_pct, target_pct - 6)

        if visits >= budget:
            circuit_breaker_events.append({"step": step, "node": node_name, "reason": f"visit_budget_exhausted ({visits}/{budget})"})
            return prev_pct

        node_visits[node_name] = visits + 1
        current_pass = min(MAX_PASSES, state.iteration + 1)
        guard_payload = {
            "pass_current": current_pass,
            "pass_max": MAX_PASSES,
            "pass_label": f"Pass {current_pass}/{MAX_PASSES}",
            "superstep_current": step,
            "superstep_max": MAX_SUPERSTEPS,
            "superstep_label": f"Superstep {step}/{MAX_SUPERSTEPS}",
            "node_visits": node_visits[node_name],
            "node_budget": budget,
            "remaining_steps": max(0, MAX_SUPERSTEPS - step),
        }

        confirmed_list = state.read_file("/critic/confirmed.json", []) or []
        await state.emit(
            "agent_progress",
            node_name,
            percentage=pct_start,
            stage_index=stage_idx,
            total_stages=TOTAL_STAGES,
            stage_label=f"Step {stage_idx}/{TOTAL_STAGES} · {stage_desc}",
            active_node=node_name,
            recursion_guard=guard_payload,
            findings_count=len(confirmed_list),
        )

        fn = self.builder.nodes[node_name]
        timeout_s = NODE_TIMEOUT_SECONDS.get(node_name, 10.0)
        started = perf_counter()
        try:
            update = await asyncio.wait_for(fn(state), timeout=timeout_s)
        except asyncio.TimeoutError:
            update = {"status": "degraded_timeout"}
            circuit_breaker_events.append({"step": step, "node": node_name, "reason": f"timeout_after_{timeout_s}s"})
        duration = round((perf_counter() - started) * 1000, 1)

        final_pct = 100 if node_name == "orchestrator" else max(pct_start, target_pct)
        confirmed_after = state.read_file("/critic/confirmed.json", []) or []
        avg_conf = (
            round(sum(float(f.get("confidence", 0.85)) for f in confirmed_after) / len(confirmed_after), 3)
            if confirmed_after
            else 0.88
        )
        checkpoint = {
            "step": step,
            "node": node_name,
            "duration_ms": duration,
            "files_count": len(state.files),
            "trace_seq": len(state.trace),
            "summary": update or {},
        }
        checkpoints.append(checkpoint)
        await state.emit("graph_checkpoint", node_name, step=step, duration_ms=duration, files_count=len(state.files))
        await state.emit(
            "agent_progress",
            node_name,
            percentage=final_pct,
            stage_index=stage_idx,
            total_stages=TOTAL_STAGES,
            stage_label=f"Step {stage_idx}/{TOTAL_STAGES} · {stage_desc}",
            active_node=node_name,
            recursion_guard=guard_payload,
            findings_count=len(confirmed_after),
            confidence=avg_conf,
        )
        return final_pct
