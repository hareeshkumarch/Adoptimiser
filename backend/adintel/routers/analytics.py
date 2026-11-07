from typing import Optional

from fastapi import APIRouter, Query

from adintel.analytics.dataset import load_accounts
from adintel.analytics.pulse import build_breakdown, build_pulse
from adintel.models import Compare, Level, Scope, Window
from adintel.sandbox.catalog import FX_TO_USD

router = APIRouter(prefix="/api/v1", tags=["analytics"])


def _scope(platform: Optional[str], account_id: Optional[str], campaign: Optional[str] = None, adset_id: Optional[str] = None) -> Scope:
    return Scope(platform=platform, account_id=account_id, campaign=campaign, adset_id=adset_id)


@router.get("/accounts")
async def accounts():
    return {"accounts": [a.model_dump(exclude={"id"}) for a in await load_accounts()], "fx_to_usd": FX_TO_USD}


@router.get("/pulse")
async def pulse(
    platform: Optional[str] = None,
    account_id: Optional[str] = None,
    campaign: Optional[str] = None,
    adset_id: Optional[str] = None,
    window: Window = "7d_click",
    compare: Compare = "previous_period",
):
    return await build_pulse(_scope(platform, account_id, campaign, adset_id), window, compare)


@router.get("/breakdown")
async def breakdown(
    platform: Optional[str] = None,
    account_id: Optional[str] = None,
    campaign: Optional[str] = None,
    adset_id: Optional[str] = None,
    window: Window = "7d_click",
    compare: Compare = "previous_period",
    level: Level = Query("campaign"),
):
    return await build_breakdown(_scope(platform, account_id, campaign, adset_id), window, compare, level)
