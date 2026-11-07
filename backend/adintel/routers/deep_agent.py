import asyncio
import contextlib
import json
from typing import AsyncIterator

from fastapi import APIRouter, Header, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse

from adintel.agents.service import DeepAgentService
from adintel.diagnostics.benchmark import benchmark
from adintel.diagnostics.evaluation import evaluate
from adintel.models import RunRequest, Window

router = APIRouter(prefix="/api/v1/deep-agent", tags=["deep-agent"])
service = DeepAgentService()
HEARTBEAT_SECONDS = 15
TERMINAL_EVENTS = {"run_complete", "run_failed"}
SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"}


def _parse_last_event_id(header_val: str | None, query_val: int | None) -> int:
    if header_val is not None and header_val.strip() != "":
        try:
            return max(-1, int(header_val.strip()))
        except ValueError:
            return -1
    if query_val is not None:
        return max(-1, query_val)
    return -1


async def _sse(request: Request, events: AsyncIterator[dict]) -> AsyncIterator[str]:
    yield "retry: 3000\n\n"
    iterator = events.__aiter__()
    pending: asyncio.Future | None = asyncio.ensure_future(iterator.__anext__())
    try:
        while True:
            done, _ = await asyncio.wait({pending}, timeout=HEARTBEAT_SECONDS)
            if await request.is_disconnected():
                return
            if not done:
                yield ": heartbeat\n\n"
                continue
            try:
                event = pending.result()
            except StopAsyncIteration:
                pending = None
                return
            yield f"id: {event['seq']}\nevent: agent\ndata: {json.dumps(event)}\n\n"
            if event.get("type") in TERMINAL_EVENTS:
                pending = None
                return
            pending = asyncio.ensure_future(iterator.__anext__())
    finally:
        if pending is not None and not pending.done():
            pending.cancel()
            with contextlib.suppress(asyncio.CancelledError, StopAsyncIteration, Exception):
                await pending
        if hasattr(iterator, "aclose"):
            with contextlib.suppress(Exception):
                await iterator.aclose()


@router.get("/graph")
async def graph_topology():
    return service.topology()


@router.post("/run", status_code=status.HTTP_202_ACCEPTED)
async def run(request: RunRequest):
    state, started = await service.start_atomic(request)
    if not started:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={"message": "A run is already in progress", "run_id": state.run_id},
        )
    return {"run_id": state.run_id, "events_url": f"/api/v1/deep-agent/runs/{state.run_id}/events"}


@router.get("/active")
async def active():
    state = service.active()
    return {"run_id": state.run_id if state else None}


@router.get("/runs")
async def list_runs(limit: int = Query(15, ge=1, le=50)):
    return {"runs": await service.list_runs(limit)}


@router.get("/runs/{run_id}/events")
async def run_events(
    run_id: str,
    request: Request,
    last_event_id: str | None = Header(default=None, alias="Last-Event-ID"),
    after: int | None = Query(default=None, ge=-1),
):
    cursor = _parse_last_event_id(last_event_id, after)
    events = await service.events(run_id, cursor)
    if events is None:
        raise HTTPException(404, "Run not found")
    return StreamingResponse(_sse(request, events), media_type="text/event-stream", headers=SSE_HEADERS)


@router.get("/runs/latest")
async def latest():
    record = await service.latest()
    return {"run": record.model_dump(exclude={"id"}) if record else None}


@router.get("/runs/{run_id}")
async def get_run(run_id: str):
    record = await service.get(run_id)
    if not record:
        raise HTTPException(404, "Run not found")
    return {"run": record.model_dump(exclude={"id"})}


@router.get("/evaluation/benchmark")
async def evaluation_benchmark(seeds: int = Query(8, ge=1, le=20), window: Window = "7d_click"):
    return await benchmark(seeds, window)


@router.get("/runs/{run_id}/evaluation")
async def run_evaluation(run_id: str):
    record = await service.get(run_id)
    if not record:
        raise HTTPException(404, "Run not found")
    return evaluate(record.model_dump(exclude={"id", "trace", "files"}))
