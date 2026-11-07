import asyncio
import copy
import logging
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from adintel.config import get_settings

ASCENDING = 1
DESCENDING = -1
logger = logging.getLogger(__name__)

try:
    from motor.motor_asyncio import AsyncIOMotorClient
    from pymongo import IndexModel
    HAS_MOTOR = True
except ImportError:
    AsyncIOMotorClient = None
    HAS_MOTOR = False

    class IndexModel:
        def __init__(self, keys, **kwargs):
            self.document = {"name": kwargs.get("name", "idx"), "keys": keys, **kwargs}


@dataclass
class _InsertOneResult:
    inserted_id: Any


@dataclass
class _UpdateResult:
    matched_count: int
    modified_count: int
    upserted_id: Any = None


@dataclass
class _DeleteResult:
    deleted_count: int


def _compare_op(val: Any, op: str, target: Any) -> bool:
    if op == "$in":
        return val in target
    if op == "$nin":
        return val not in target
    if op == "$ne":
        return val != target
    if op == "$exists":
        return (val is not None) if target else (val is None)
    if val is None:
        return False
    if op == "$gt":
        return val > target
    if op == "$gte":
        return val >= target
    if op == "$lt":
        return val < target
    if op == "$lte":
        return val <= target
    return False


def _matches(doc: dict, filt: dict | None) -> bool:
    if not filt:
        return True
    for k, cond in filt.items():
        if k == "$and":
            if not all(_matches(doc, sub) for sub in cond):
                return False
            continue
        if k == "$or":
            if not any(_matches(doc, sub) for sub in cond):
                return False
            continue
        val = doc.get(k)
        if isinstance(cond, dict):
            if not all(_compare_op(val, op, target) for op, target in cond.items()):
                return False
        elif val != cond:
            return False
    return True


def _project(doc: dict, projection: dict | None) -> dict:
    out = copy.deepcopy(doc)
    if not projection:
        return out
    exclude = [k for k, v in projection.items() if not v]
    include = [k for k, v in projection.items() if v]
    if include:
        return {k: out[k] for k in include if k in out}
    for k in exclude:
        out.pop(k, None)
    return out


class InMemoryCursor:
    def __init__(self, docs: list[dict]):
        self._docs = docs

    def sort(self, key_or_list: str | list[tuple[str, int]], direction: int = ASCENDING) -> "InMemoryCursor":
        if isinstance(key_or_list, str):
            specs = [(key_or_list, direction)]
        else:
            specs = list(key_or_list)
        for field, dir_ in reversed(specs):
            self._docs.sort(key=lambda d: (d.get(field) is None, d.get(field, "")), reverse=(dir_ == DESCENDING))
        return self

    async def to_list(self, length: int | None = None) -> list[dict]:
        if length is None:
            return list(self._docs)
        return list(self._docs[:length])


class InMemoryCollection:
    def __init__(self, name: str):
        self.name = name
        self._docs: list[dict] = []
        self._lock = asyncio.Lock()
        self._ttl_specs: list[tuple[str, int]] = []

    def _purge_expired(self) -> None:
        if not self._ttl_specs:
            return
        now = datetime.now(timezone.utc)
        kept = []
        for doc in self._docs:
            expired = False
            for field, seconds in self._ttl_specs:
                ts = doc.get(field)
                if isinstance(ts, datetime):
                    age = (now - (ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc))).total_seconds()
                    if age > seconds:
                        expired = True
                        break
            if not expired:
                kept.append(doc)
        self._docs = kept

    async def create_indexes(self, models: list[Any]) -> list[str]:
        for m in models:
            doc = getattr(m, "document", {})
            if "expireAfterSeconds" in doc and doc.get("keys"):
                field = doc["keys"][0][0]
                spec = (field, int(doc["expireAfterSeconds"]))
                if spec not in self._ttl_specs:
                    self._ttl_specs.append(spec)
        return [getattr(m, "document", {}).get("name", "idx") for m in models]

    async def count_documents(self, filt: dict | None = None) -> int:
        self._purge_expired()
        return sum(1 for d in self._docs if _matches(d, filt))

    def find(self, filt: dict | None = None, projection: dict | None = None) -> InMemoryCursor:
        self._purge_expired()
        matched = [_project(d, projection) for d in self._docs if _matches(d, filt or {})]
        return InMemoryCursor(matched)

    async def find_one(self, filt: dict | None = None, projection: dict | None = None, sort: list[tuple[str, int]] | None = None) -> dict | None:
        cursor = self.find(filt, projection)
        if sort:
            cursor.sort(sort)
        items = await cursor.to_list(1)
        return items[0] if items else None

    async def find_one_and_delete(self, filt: dict) -> dict | None:
        async with self._lock:
            self._purge_expired()
            for idx, doc in enumerate(self._docs):
                if _matches(doc, filt):
                    return copy.deepcopy(self._docs.pop(idx))
            return None

    async def insert_one(self, doc: dict) -> _InsertOneResult:
        async with self._lock:
            stored = copy.deepcopy(doc)
            stored.setdefault("_id", uuid.uuid4().hex)
            self._docs.append(stored)
            return _InsertOneResult(stored["_id"])

    async def insert_many(self, docs: list[dict]) -> list[str]:
        async with self._lock:
            ids = []
            for doc in docs:
                stored = copy.deepcopy(doc)
                stored.setdefault("_id", uuid.uuid4().hex)
                self._docs.append(stored)
                ids.append(stored["_id"])
            return ids

    async def update_one(self, filt: dict, update: dict, upsert: bool = False) -> _UpdateResult:
        async with self._lock:
            self._purge_expired()
            for doc in self._docs:
                if _matches(doc, filt):
                    if "$set" in update:
                        doc.update(copy.deepcopy(update["$set"]))
                    return _UpdateResult(1, 1, None)
            if upsert:
                new_doc = {k: v for k, v in filt.items() if not isinstance(v, dict)}
                if "$setOnInsert" in update:
                    new_doc.update(copy.deepcopy(update["$setOnInsert"]))
                if "$set" in update:
                    new_doc.update(copy.deepcopy(update["$set"]))
                new_doc.setdefault("_id", uuid.uuid4().hex)
                self._docs.append(new_doc)
                return _UpdateResult(0, 0, new_doc["_id"])
            return _UpdateResult(0, 0, None)

    async def delete_one(self, filt: dict) -> _DeleteResult:
        async with self._lock:
            for idx, doc in enumerate(self._docs):
                if _matches(doc, filt):
                    self._docs.pop(idx)
                    return _DeleteResult(1)
            return _DeleteResult(0)

    async def delete_many(self, filt: dict) -> _DeleteResult:
        async with self._lock:
            before = len(self._docs)
            self._docs = [d for d in self._docs if not _matches(d, filt)]
            return _DeleteResult(before - len(self._docs))


class InMemoryDatabase:
    def __init__(self):
        self._collections: dict[str, InMemoryCollection] = {}

    def __getitem__(self, name: str) -> InMemoryCollection:
        if name not in self._collections:
            self._collections[name] = InMemoryCollection(name)
        return self._collections[name]

    def __getattr__(self, name: str) -> InMemoryCollection:
        return self[name]


class InMemoryClient:
    def __init__(self):
        self._dbs: dict[str, InMemoryDatabase] = {}

    def __getitem__(self, name: str) -> InMemoryDatabase:
        if name not in self._dbs:
            self._dbs[name] = InMemoryDatabase()
        return self._dbs[name]

    def close(self) -> None:
        pass


class ResilientCollectionProxy:
    def __init__(self, db_proxy: "ResilientDatabaseProxy", name: str):
        self._db_proxy = db_proxy
        self._name = name

    @property
    def _use_fallback(self) -> bool:
        return self._db_proxy.use_fallback

    def _trip_fallback(self) -> None:
        self._db_proxy.use_fallback = True

    async def create_indexes(self, models: list[Any]):
        if self._use_fallback:
            return await self._db_proxy.fallback_db[self._name].create_indexes(models)
        try:
            return await self._db_proxy.primary_db[self._name].create_indexes(models)
        except Exception:
            self._trip_fallback()
            return await self._db_proxy.fallback_db[self._name].create_indexes(models)

    def find(self, filt: dict | None = None, projection: dict | None = None):
        if self._use_fallback:
            return self._db_proxy.fallback_db[self._name].find(filt, projection)
        return _ResilientCursor(self, filt, projection)

    async def count_documents(self, filt: dict | None = None) -> int:
        if self._use_fallback:
            return await self._db_proxy.fallback_db[self._name].count_documents(filt)
        try:
            return await self._db_proxy.primary_db[self._name].count_documents(filt or {})
        except Exception:
            self._trip_fallback()
            return await self._db_proxy.fallback_db[self._name].count_documents(filt)

    async def find_one(self, filt: dict | None = None, projection: dict | None = None, sort: list[tuple[str, int]] | None = None):
        if self._use_fallback:
            return await self._db_proxy.fallback_db[self._name].find_one(filt, projection, sort=sort)
        try:
            return await self._db_proxy.primary_db[self._name].find_one(filt or {}, projection, sort=sort)
        except Exception:
            self._trip_fallback()
            return await self._db_proxy.fallback_db[self._name].find_one(filt, projection, sort=sort)

    async def find_one_and_delete(self, filt: dict):
        if self._use_fallback:
            return await self._db_proxy.fallback_db[self._name].find_one_and_delete(filt)
        try:
            return await self._db_proxy.primary_db[self._name].find_one_and_delete(filt)
        except Exception:
            self._trip_fallback()
            return await self._db_proxy.fallback_db[self._name].find_one_and_delete(filt)

    async def insert_one(self, doc: dict):
        if self._use_fallback:
            return await self._db_proxy.fallback_db[self._name].insert_one(doc)
        try:
            return await self._db_proxy.primary_db[self._name].insert_one(doc)
        except Exception:
            self._trip_fallback()
            return await self._db_proxy.fallback_db[self._name].insert_one(doc)

    async def insert_many(self, docs: list[dict]):
        if self._use_fallback:
            return await self._db_proxy.fallback_db[self._name].insert_many(docs)
        try:
            return await self._db_proxy.primary_db[self._name].insert_many(docs)
        except Exception:
            self._trip_fallback()
            return await self._db_proxy.fallback_db[self._name].insert_many(docs)

    async def update_one(self, filt: dict, update: dict, upsert: bool = False):
        if self._use_fallback:
            return await self._db_proxy.fallback_db[self._name].update_one(filt, update, upsert=upsert)
        try:
            return await self._db_proxy.primary_db[self._name].update_one(filt, update, upsert=upsert)
        except Exception:
            self._trip_fallback()
            return await self._db_proxy.fallback_db[self._name].update_one(filt, update, upsert=upsert)

    async def delete_one(self, filt: dict):
        if self._use_fallback:
            return await self._db_proxy.fallback_db[self._name].delete_one(filt)
        try:
            return await self._db_proxy.primary_db[self._name].delete_one(filt)
        except Exception:
            self._trip_fallback()
            return await self._db_proxy.fallback_db[self._name].delete_one(filt)

    async def delete_many(self, filt: dict):
        if self._use_fallback:
            return await self._db_proxy.fallback_db[self._name].delete_many(filt)
        try:
            return await self._db_proxy.primary_db[self._name].delete_many(filt)
        except Exception:
            self._trip_fallback()
            return await self._db_proxy.fallback_db[self._name].delete_many(filt)


class _ResilientCursor:
    def __init__(self, proxy: ResilientCollectionProxy, filt: dict | None, projection: dict | None):
        self._proxy = proxy
        self._filt = filt or {}
        self._projection = projection
        self._sorts: list[tuple[str, int]] = []

    def sort(self, key_or_list: str | list[tuple[str, int]], direction: int = ASCENDING):
        if isinstance(key_or_list, str):
            self._sorts.append((key_or_list, direction))
        else:
            self._sorts.extend(key_or_list)
        return self

    async def to_list(self, length: int | None = None) -> list[dict]:
        if not self._proxy._use_fallback:
            try:
                cursor = self._proxy._db_proxy.primary_db[self._proxy._name].find(self._filt, self._projection)
                for field, dir_ in self._sorts:
                    cursor = cursor.sort(field, dir_)
                return await cursor.to_list(length)
            except Exception:
                self._proxy._trip_fallback()
        cursor = self._proxy._db_proxy.fallback_db[self._proxy._name].find(self._filt, self._projection)
        for field, dir_ in self._sorts:
            cursor = cursor.sort(field, dir_)
        return await cursor.to_list(length)


class ResilientDatabaseProxy:
    def __init__(self, primary_db: Any, fallback_db: InMemoryDatabase):
        self.primary_db = primary_db
        self.fallback_db = fallback_db
        self.use_fallback = primary_db is None
        self._proxies: dict[str, ResilientCollectionProxy] = {}

    def __getitem__(self, name: str) -> ResilientCollectionProxy:
        if name not in self._proxies:
            self._proxies[name] = ResilientCollectionProxy(self, name)
        return self._proxies[name]

    def __getattr__(self, name: str) -> ResilientCollectionProxy:
        return self[name]


settings = get_settings()
_fallback_client = InMemoryClient()
_fallback_db = _fallback_client[settings.db_name]

if HAS_MOTOR and os.environ.get("USE_IN_MEMORY_DB") != "1":
    try:
        client = AsyncIOMotorClient(settings.mongo_url, serverSelectionTimeoutMS=1500)
        _primary_db = client[settings.db_name]
    except Exception:
        client = _fallback_client
        _primary_db = None
else:
    client = _fallback_client
    _primary_db = None

db = ResilientDatabaseProxy(_primary_db, _fallback_db)

INDEXES: dict[str, list[IndexModel]] = {
    "metrics_daily": [
        IndexModel([("creative_id", ASCENDING), ("date", ASCENDING)], name="creative_date", unique=True),
        IndexModel([("platform", ASCENDING), ("account_id", ASCENDING), ("date", ASCENDING)], name="scope_date"),
    ],
    "store_daily": [IndexModel([("date", ASCENDING)], name="date", unique=True)],
    "sandbox_meta": [IndexModel([("key", ASCENDING)], name="key_unique", unique=True)],
    "accounts": [
        IndexModel([("platform", ASCENDING), ("account_id", ASCENDING)], name="platform_account", unique=True),
        IndexModel([("connection_id", ASCENDING)], name="connection_id"),
    ],
    "agent_runs": [
        IndexModel([("run_id", ASCENDING)], name="run_id", unique=True),
        IndexModel([("status", ASCENDING), ("created_at", DESCENDING)], name="status_created_desc"),
        IndexModel([("created_at", DESCENDING)], name="created_desc"),
    ],
    "connections": [
        IndexModel([("connection_id", ASCENDING)], name="connection_id", unique=True),
        IndexModel([("provider", ASCENDING)], name="provider"),
    ],
    "oauth_states": [
        IndexModel([("state", ASCENDING)], name="state", unique=True),
        IndexModel([("created_at", ASCENDING)], name="ttl", expireAfterSeconds=900),
    ],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        try:
            await db[collection].create_indexes(models)
        except Exception as exc:
            logger.error("ensure_indexes(%s): %s", collection, exc)
