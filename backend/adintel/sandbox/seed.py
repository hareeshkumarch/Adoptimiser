import asyncio
from datetime import date, timedelta

from adintel.db import db
from adintel.sandbox.catalog import ACCOUNTS
from adintel.sandbox.generator import generate

_SEED_LOCK = asyncio.Lock()


async def ensure_sandbox(force: bool = False) -> None:
    async with _SEED_LOCK:
        end = date.today() - timedelta(days=1)
        meta = await db.sandbox_meta.find_one({"key": "dataset"})
        if not force and meta and meta.get("end_date") == end.isoformat():
            return
        sandbox_account_ids = [a["account_id"] for a in ACCOUNTS]
        metrics, store = generate(end)
        await db.metrics_daily.delete_many({"account_id": {"$in": sandbox_account_ids}})
        await db.store_daily.delete_many({})
        await db.accounts.delete_many({"source": {"$in": ["sandbox", None]}})
        await db.metrics_daily.insert_many(metrics)
        await db.store_daily.insert_many(store)
        await db.accounts.insert_many([a | {"source": "sandbox"} for a in ACCOUNTS])
        await db.sandbox_meta.update_one({"key": "dataset"}, {"$set": {"end_date": end.isoformat()}}, upsert=True)
