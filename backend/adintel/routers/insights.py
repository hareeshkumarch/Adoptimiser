import json
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from adintel.agents.llm import LlmGateway
from adintel.db import db
from adintel.insights.copilot import ask_stream
from adintel.insights.opportunities import build_opportunities
from adintel.insights.reach import build_reach
from adintel.models import Scope

router = APIRouter(prefix="/api/v1", tags=["insights"])
llm = LlmGateway()
SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"}
Goal = Literal["grow_revenue", "cut_waste", "fix_creative", "scale_reach"]


class AskBody(BaseModel):
    question: str = Field(min_length=2, max_length=800)
    thread_id: Optional[str] = None
    scope: Scope = Field(default_factory=Scope)


class WorkspaceBody(BaseModel):
    goal: Goal
    business_name: Optional[str] = Field(default=None, max_length=80)
    target_roas: Optional[float] = Field(default=None, ge=0, le=50)
    monthly_budget: Optional[float] = Field(default=None, ge=0)
    onboarded: bool = True


def _scope(platform: Optional[str], account_id: Optional[str]) -> Scope:
    return Scope(platform=platform, account_id=account_id)


@router.get("/insights/opportunities")
async def opportunities(platform: Optional[str] = None, account_id: Optional[str] = None):
    return await build_opportunities(_scope(platform, account_id))


@router.get("/insights/reach")
async def reach(platform: Optional[str] = None, account_id: Optional[str] = None):
    return await build_reach(_scope(platform, account_id))


@router.post("/insights/ask")
async def ask(body: AskBody):
    async def gen():
        async for event in ask_stream(llm, body.question, body.scope, body.thread_id):
            yield f"data: {json.dumps(event)}\n\n"
    return StreamingResponse(gen(), media_type="text/event-stream", headers=SSE_HEADERS)


@router.get("/workspace")
async def get_workspace():
    doc = await db.workspace.find_one({"key": "default"}, {"_id": 0, "key": 0})
    return {"workspace": doc or {"onboarded": False}}


@router.put("/workspace")
async def put_workspace(body: WorkspaceBody):
    data = body.model_dump() | {"updated_at": datetime.now(timezone.utc).isoformat()}
    await db.workspace.update_one({"key": "default"}, {"$set": data}, upsert=True)
    return {"workspace": data}
