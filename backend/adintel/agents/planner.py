import json

from adintel.agents.llm import LlmGateway
from adintel.agents.state import RunState, Todo

SYSTEM = (
    "You are the planner of a read-only paid-media diagnostic deep agent. Break the user's investigation request into a concrete "
    "multi-step plan (5-9 todos) and assign each todo to exactly one owner from the provided sub-agents. Plans must start with "
    "ingestion, then parallel anomaly and attribution work, then critic verification, then optimizer, ending with orchestrator synthesis. "
    "Titles are short imperative steps that mention concrete metrics or platforms."
)


class Planner:
    name = "planner"

    def __init__(self, llm: LlmGateway, owners: dict[str, str]):
        self.llm = llm
        self.owners = owners

    def _normalize(self, raw: list[dict]) -> list[Todo]:
        todos = [Todo(id=f"t{i + 1}", title=str(t["title"])[:140], owner=t["owner"]) for i, t in enumerate(raw) if t.get("owner") in self.owners and t.get("title")]
        covered = {t.owner for t in todos}
        for owner, mandate in self.owners.items():
            if owner not in covered:
                todos.append(Todo(id=f"t{len(todos) + 1}", title=mandate.split(",")[0], owner=owner))
        order = list(self.owners)
        return sorted(todos, key=lambda t: order.index(t.owner))

    async def __call__(self, state: RunState) -> None:
        await state.emit("agent_start", self.name, title="Planner")
        prompt = (
            f"Request: {state.query}\nScope: {state.scope.model_dump()} · attribution window {state.window}\n"
            f"Sub-agents: {json.dumps(self.owners)}\n"
            'Return {"todos":[{"title":str,"owner":str}]}'
        )
        result = await state.call_tool(
            self.name, "write_todos", {"request": state.query[:120]},
            lambda: self.llm.complete_json(f"{state.run_id}:planner", SYSTEM, prompt),
            lambda r: f"{len(r.get('todos', []))} todos drafted",
        )
        await state.write_todos(self._normalize(result.get("todos", [])))
        await state.write_file("/plan/todos.json", self.name, "json", state.todos_payload())
        await state.emit("agent_end", self.name, title="Planner")
