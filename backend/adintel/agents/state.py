import asyncio
import inspect
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from time import perf_counter
from typing import Any, AsyncIterator, Awaitable, Callable

import pandas as pd

from adintel.analytics.metrics import jsonable
from adintel.models import Scope


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Todo:
    id: str
    title: str
    owner: str
    status: str = "pending"


@dataclass
class ScratchFile:
    path: str
    author: str
    kind: str
    content: Any
    created_at: str


class RunState:
    def __init__(self, run_id: str, query: str, scope: Scope, window: str):
        self.run_id = run_id
        self.query = query
        self.scope = scope
        self.window = window
        self.created_at = now_iso()
        self.todos: list[Todo] = []
        self.files: dict[str, ScratchFile] = {}
        self.frames: dict[str, pd.DataFrame] = {}
        self.trace: list[dict] = []
        self.iteration = 0
        self.done = False
        self._changed = asyncio.Condition()

    async def emit(self, type_: str, agent: str, **data) -> None:
        event = jsonable({"seq": len(self.trace), "ts": now_iso(), "type": type_, "agent": agent, **data})
        async with self._changed:
            self.trace.append(event)
            self._changed.notify_all()

    async def finish(self) -> None:
        async with self._changed:
            self.done = True
            self._changed.notify_all()

    async def subscribe(self, after: int = -1) -> AsyncIterator[dict]:
        cursor = after + 1
        while True:
            async with self._changed:
                await self._changed.wait_for(lambda: len(self.trace) > cursor or self.done)
                batch = self.trace[cursor:]
                finished = self.done
            for event in batch:
                yield event
            cursor += len(batch)
            if finished and cursor >= len(self.trace):
                return

    async def write_todos(self, todos: list[Todo]) -> None:
        self.todos = todos
        await self.emit("todos", "planner", todos=[asdict(t) for t in todos])

    async def set_owner_status(self, owner: str, status: str) -> None:
        for todo in self.todos:
            if todo.owner == owner:
                todo.status = status
        await self.emit("todos", "planner", todos=[asdict(t) for t in self.todos])

    async def write_file(self, path: str, author: str, kind: str, content: Any) -> None:
        self.files[path] = ScratchFile(path, author, kind, jsonable(content), now_iso())
        await self.emit(
            "scratchpad_write",
            author,
            path=path,
            kind=kind,
            content=self.files[path].content,
            created_at=self.files[path].created_at,
        )

    def read_file(self, path: str, default: Any = None) -> Any:
        item = self.files.get(path)
        return item.content if item is not None else default

    async def call_tool(self, agent: str, tool: str, args: dict, fn: Callable[[], Any | Awaitable[Any]], summarize: Callable[[Any], str]) -> Any:
        await self.emit("tool_call", agent, tool=tool, args=args)
        started = perf_counter()
        result = await fn() if inspect.iscoroutinefunction(fn) else await asyncio.to_thread(fn)
        if inspect.isawaitable(result):
            result = await result
        await self.emit("tool_result", agent, tool=tool, summary=summarize(result), ms=round((perf_counter() - started) * 1000, 1))
        return result

    def files_payload(self) -> list[dict]:
        return [asdict(f) for f in self.files.values()]

    def todos_payload(self) -> list[dict]:
        return [asdict(t) for t in self.todos]
