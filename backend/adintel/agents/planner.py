from adintel.agents.llm import LlmGateway
from adintel.agents.prompts import PLANNER_SYSTEM, build_planner_prompt
from adintel.agents.state import RunState, Todo


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
        prompt = build_planner_prompt(state.query, state.scope.model_dump(), state.window, self.owners)
        result = await state.call_tool(
            self.name, "write_todos", {"request": state.query[:120]},
            lambda: self.llm.complete_json(f"{state.run_id}:planner", PLANNER_SYSTEM, prompt),
            lambda r: f"{len(r.get('todos', []))} todos drafted",
        )
        await state.write_todos(self._normalize(result.get("todos", [])))
        await state.write_file("/plan/todos.json", self.name, "json", state.todos_payload())
        await state.emit("agent_end", self.name, title="Planner")
