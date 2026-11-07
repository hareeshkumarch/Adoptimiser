import asyncio
import logging
import uuid
from collections import OrderedDict
from typing import AsyncIterator

from adintel.agents.llm import LlmGateway
from adintel.agents.orchestrator import Orchestrator
from adintel.agents.state import RunState, now_iso
from adintel.db import db
from adintel.models import AgentRunRecord, RunRequest

MAX_LIVE_RUNS = 20
logger = logging.getLogger(__name__)


class DeepAgentService:
    def __init__(self):
        self.orchestrator = Orchestrator(LlmGateway())
        self._live: OrderedDict[str, RunState] = OrderedDict()
        self._tasks: set[asyncio.Task] = set()
        self._start_lock = asyncio.Lock()

    def topology(self) -> dict:
        return self.orchestrator.topology()

    def active(self) -> RunState | None:
        return next((s for s in reversed(self._live.values()) if not s.done), None)

    async def start_atomic(self, request: RunRequest) -> tuple[RunState, bool]:
        async with self._start_lock:
            if current := self.active():
                return current, False
            return self.start(request), True

    def start(self, request: RunRequest) -> RunState:
        state = RunState(uuid.uuid4().hex[:12], request.query, request.scope, request.window)
        self._live[state.run_id] = state
        while len(self._live) > MAX_LIVE_RUNS:
            oldest_id, oldest_state = next(iter(self._live.items()))
            if not oldest_state.done:
                break
            self._live.pop(oldest_id, None)
        task = asyncio.create_task(self._execute(state))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
        return state

    async def _execute(self, state: RunState) -> None:
        result, error = {}, None
        try:
            result = await self.orchestrator.run(state)
        except Exception as exc:
            logger.exception("deep agent run %s failed", state.run_id)
            error = str(exc)

        completed_at = now_iso()
        status_str = "failed" if error else "completed"
        terminal_type = "run_failed" if error else "run_complete"
        trace_snapshot = list(state.trace)

        record = AgentRunRecord(
            run_id=state.run_id,
            query=state.query,
            scope=state.scope,
            window=state.window,
            status=status_str,
            created_at=state.created_at,
            completed_at=completed_at,
            todos=state.todos_payload(),
            files=state.files_payload(),
            trace=trace_snapshot,
            error=error,
            **result,
        )
        try:
            await db.agent_runs.insert_one(record.to_mongo())
        except Exception:
            logger.exception("failed to persist AgentRunRecord for run %s", state.run_id)
        finally:
            try:
                await state.emit(terminal_type, "orchestrator", run=record.model_dump(exclude={"id", "trace"}))
            finally:
                await state.finish()

    async def events(self, run_id: str, after: int) -> AsyncIterator[dict] | None:
        if state := self._live.get(run_id):
            return state.subscribe(max(-1, after))
        record = await self.get(run_id)
        if not record:
            return None
        return self._replay(record, max(-1, after))

    @staticmethod
    async def _replay(record: AgentRunRecord, after: int) -> AsyncIterator[dict]:
        start_idx = max(0, after + 1)
        has_terminal = False
        for event in record.trace[start_idx:]:
            if event.get("type") in ("run_complete", "run_failed"):
                has_terminal = True
            yield event

        terminal_seq = len(record.trace)
        if not has_terminal and after < terminal_seq:
            yield {
                "seq": terminal_seq,
                "ts": record.completed_at,
                "type": f"run_{'complete' if record.status == 'completed' else 'failed'}",
                "agent": "orchestrator",
                "run": record.model_dump(exclude={"id", "trace"}),
            }

    @staticmethod
    async def latest() -> AgentRunRecord | None:
        doc = await db.agent_runs.find_one({"status": "completed"}, sort=[("created_at", -1)])
        return AgentRunRecord.from_mongo(doc) if doc else None

    @staticmethod
    async def list_runs(limit: int = 15) -> list[dict]:
        docs = await db.agent_runs.find({}, {"trace": 0, "files": 0}).sort("created_at", -1).to_list(limit)
        out = []
        for doc in docs:
            rec = AgentRunRecord.from_mongo(doc)
            out.append({
                "run_id": rec.run_id,
                "query": rec.query,
                "scope": rec.scope.model_dump(),
                "window": rec.window,
                "status": rec.status,
                "created_at": rec.created_at,
                "completed_at": rec.completed_at,
                "findings_count": len(rec.findings),
                "prescriptions_count": len(rec.prescriptions),
            })
        return out

    @staticmethod
    async def get(run_id: str) -> AgentRunRecord | None:
        doc = await db.agent_runs.find_one({"run_id": run_id})
        return AgentRunRecord.from_mongo(doc) if doc else None
