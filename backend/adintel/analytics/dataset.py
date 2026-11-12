import pandas as pd
from fastapi import HTTPException

from adintel.db import db
from adintel.models import Account, Scope
from adintel.sandbox.catalog import FX_TO_USD

MONEY_COLUMNS = ["spend", "daily_budget", "revenue_1d", "revenue_7d", "revenue_dd"]


async def load_accounts() -> list[Account]:
    docs = await db.accounts.find({}).to_list(100)
    return [Account.from_mongo(d) for d in docs]


async def load_raw(scope: Scope) -> pd.DataFrame:
    rows = await db.metrics_daily.find(scope.query(), {"_id": 0}).to_list(None)
    if not rows:
        rows = await db.metrics_daily.find(Scope(platform=scope.platform, account_id=scope.account_id).query(), {"_id": 0}).to_list(None)
    if not rows:
        raise HTTPException(404, "No ad data for this account or platform")
    frame = pd.DataFrame(rows)
    frame["date"] = pd.to_datetime(frame["date"])
    return frame


def normalize_currency(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame.copy()
    rate = out["currency"].map(FX_TO_USD)
    for column in MONEY_COLUMNS:
        out[column] = out[column] * rate
    return out


async def load_frame(scope: Scope) -> pd.DataFrame:
    return normalize_currency(await load_raw(scope))


async def load_store() -> pd.DataFrame:
    rows = await db.store_daily.find({}, {"_id": 0}).to_list(None)
    frame = pd.DataFrame(rows)
    frame["date"] = pd.to_datetime(frame["date"])
    return frame
