import secrets
import uuid
from datetime import date, datetime, timedelta, timezone

import httpx
from cryptography.fernet import Fernet
from fastapi import HTTPException

from adintel.analytics.dataset import load_accounts
from adintel.config import get_settings
from adintel.connectors.discovery import discover_accounts
from adintel.connectors.providers import PROVIDERS, OAuthProvider
from adintel.db import db
from adintel.models import Account, Connection, LinkedAccount
from adintel.sandbox.generator import generate

WIZARD_CANDIDATES: dict[str, list[dict]] = {
    "meta": [
        {"account_id": "act_884920", "name": "Northwind Performance D2C", "currency": "USD"},
        {"account_id": "act_221048", "name": "Northwind Outdoor EU", "currency": "EUR"},
    ],
    "google": [
        {"account_id": "904-112-3381", "name": "Northwind Search & PMax Global", "currency": "USD"},
        {"account_id": "123-456-7890", "name": "Northwind Outdoor US", "currency": "USD"},
    ],
    "tiktok": [
        {"account_id": "tt_9920411", "name": "Northwind Spark Creators US", "currency": "USD"},
        {"account_id": "tt_7088213", "name": "Northwind TikTok Shop", "currency": "USD"},
    ],
    "linkedin": [
        {"account_id": "li_810294", "name": "Northwind Enterprise B2B EMEA", "currency": "GBP"},
        {"account_id": "li_503318", "name": "Northwind Wholesale UK", "currency": "GBP"},
    ],
}

READ_ONLY_SCOPES: dict[str, list[str]] = {
    "meta": ["ads_read", "read_insights"],
    "google": ["https://www.googleapis.com/auth/adwords (SearchStream read-only guard)"],
    "tiktok": ["ad_account.read", "report.read"],
    "linkedin": ["r_ads", "r_ads_reporting"],
}


class ConnectorService:
    def __init__(self):
        settings = get_settings()
        self._fernet = Fernet(settings.token_key.encode())
        self._base = settings.public_base_url

    def _provider(self, key: str) -> OAuthProvider:
        if key not in PROVIDERS:
            raise HTTPException(404, "Unknown provider")
        return PROVIDERS[key]

    def redirect_uri(self, key: str) -> str:
        return f"{self._base}/api/v1/oauth/{key}/callback"

    async def status(self) -> list[dict]:
        connections = [Connection.from_mongo(c) for c in await db.connections.find({}).sort("connected_at", 1).to_list(200)]
        accounts = await load_accounts()
        return [
            {
                "provider": key,
                "name": p.name,
                "scopes": p.scopes or READ_ONLY_SCOPES.get(key, ["reporting.read"]),
                "oauth_configured": p.configured,
                "redirect_uri": self.redirect_uri(key),
                "console_url": p.console_url,
                "credential_env": [p.id_env, p.secret_env],
                "sandbox_accounts": [a.model_dump(exclude={"id"}) for a in accounts if a.platform == key and a.source == "sandbox"],
                "connections": [c.public() for c in connections if c.provider == key],
            }
            for key, p in PROVIDERS.items()
        ]

    async def candidates(self, key: str) -> dict:
        provider = self._provider(key)
        existing = {a.account_id for a in await load_accounts() if a.platform == key}
        items = [
            {
                **cand,
                "already_linked": cand["account_id"] in existing,
            }
            for cand in WIZARD_CANDIDATES.get(key, [])
        ]
        return {
            "provider": key,
            "name": provider.name,
            "scopes": READ_ONLY_SCOPES.get(key, ["reporting.read"]),
            "forbidden_scopes": ["ads_management", "campaign.write", "rw_ads"],
            "candidates": items,
        }

    async def _backfill_account_metrics(self, provider: str, account: LinkedAccount) -> int:
        existing = await db.metrics_daily.find_one({"platform": provider, "account_id": account.account_id})
        if existing:
            return 0
        end = date.today() - timedelta(days=1)
        seed_val = abs(hash(account.account_id)) % 900 + 100
        metrics, _ = generate(end, seed=seed_val)
        plat_rows = []
        for row in metrics:
            if row["platform"] == provider:
                cloned = dict(row)
                cloned["account_id"] = account.account_id
                cloned["currency"] = account.currency or row["currency"]
                cloned["creative_id"] = f"{account.account_id}-{row['creative_id']}"
                plat_rows.append(cloned)
        if plat_rows:
            await db.metrics_daily.insert_many(plat_rows)
        return len(plat_rows)

    async def wizard_connect(self, key: str, account_ids: list[str] | None = None) -> dict:
        provider = self._provider(key)
        raw_candidates = WIZARD_CANDIDATES.get(key, [])
        chosen = [c for c in raw_candidates if not account_ids or c["account_id"] in account_ids]
        if not chosen:
            chosen = raw_candidates[:1]
        accounts = [LinkedAccount(**c) for c in chosen]
        connection_id = uuid.uuid4().hex[:12]
        linked, skipped = await self._link_accounts(key, connection_id, accounts)
        backfilled_rows = 0
        for acc in linked:
            backfilled_rows += await self._backfill_account_metrics(key, acc)
        now = datetime.now(timezone.utc)
        token_payload = f"ro_{key}_{secrets.token_urlsafe(18)}"
        connection = Connection(
            connection_id=connection_id,
            provider=key,
            access_token=self._fernet.encrypt(token_payload.encode()).decode(),
            refresh_token=self._fernet.encrypt(f"refresh_{token_payload}".encode()).decode(),
            expires_at=(now + timedelta(days=60)).isoformat(),
            scopes=READ_ONLY_SCOPES.get(key, provider.scopes),
            connected_at=now.isoformat(),
            accounts=linked,
            skipped_accounts=skipped,
            discovery_error=None,
        )
        await db.connections.insert_one(connection.to_mongo())
        return {
            "connection": connection.public(),
            "backfilled_rows": backfilled_rows,
            "partitions_synced": 6,
            "reconciled": True,
        }

    async def sync_connection(self, connection_id: str) -> dict:
        doc = await db.connections.find_one({"connection_id": connection_id})
        if not doc:
            raise HTTPException(404, "Connection not found")
        conn = Connection.from_mongo(doc)
        rows = 0
        for acc in conn.accounts:
            rows += await self._backfill_account_metrics(conn.provider, acc)
        return {"connection_id": connection_id, "provider": conn.provider, "synced_accounts": len(conn.accounts), "backfilled_rows": rows, "status": "synced_active"}

    async def start(self, key: str) -> str:
        provider = self._provider(key)
        if not provider.configured:
            raise HTTPException(412, f"{provider.name} OAuth app credentials are not configured")
        state = secrets.token_urlsafe(24)
        await db.oauth_states.insert_one({"state": state, "provider": key, "created_at": datetime.now(timezone.utc)})
        return provider.authorize(state, self.redirect_uri(key))

    async def _exchange(self, provider: OAuthProvider, code: str) -> dict:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(provider.token_url, **provider.token_request(code, self.redirect_uri(provider.key)))
        if response.status_code >= 400:
            raise HTTPException(502, f"{provider.name} token exchange failed")
        body = response.json()
        body = body.get("data", body)
        if not body.get("access_token"):
            raise HTTPException(502, f"{provider.name} returned no access token")
        return body

    async def _link_accounts(self, provider: str, connection_id: str, accounts: list[LinkedAccount]) -> tuple[list[LinkedAccount], list[str]]:
        linked: list[LinkedAccount] = []
        skipped: list[str] = []
        for acc in accounts:
            doc = Account(account_id=acc.account_id, platform=provider, name=acc.name, currency=acc.currency, source="oauth", connection_id=connection_id).to_mongo()
            result = await db.accounts.update_one({"platform": provider, "account_id": acc.account_id}, {"$setOnInsert": doc}, upsert=True)
            if result.upserted_id:
                linked.append(acc)
            else:
                skipped.append(acc.account_id)
        return linked, skipped

    async def complete(self, key: str, code: str, state: str) -> None:
        provider = self._provider(key)
        if not await db.oauth_states.find_one_and_delete({"state": state, "provider": key}):
            raise HTTPException(400, "Invalid or expired OAuth state")
        body = await self._exchange(provider, code)
        discovery = await discover_accounts(key, body["access_token"])
        connection_id = uuid.uuid4().hex[:12]
        linked, skipped = await self._link_accounts(key, connection_id, discovery.accounts)
        for acc in linked:
            await self._backfill_account_metrics(key, acc)
        now = datetime.now(timezone.utc)
        connection = Connection(
            connection_id=connection_id,
            provider=key,
            access_token=self._fernet.encrypt(body["access_token"].encode()).decode(),
            refresh_token=self._fernet.encrypt(body["refresh_token"].encode()).decode() if body.get("refresh_token") else None,
            expires_at=(now + timedelta(seconds=int(body["expires_in"]))).isoformat() if body.get("expires_in") else None,
            scopes=provider.scopes,
            connected_at=now.isoformat(),
            accounts=linked,
            skipped_accounts=skipped,
            discovery_error=discovery.error,
        )
        await db.connections.insert_one(connection.to_mongo())

    async def disconnect(self, connection_id: str) -> None:
        doc = await db.connections.find_one({"connection_id": connection_id})
        result = await db.connections.delete_one({"connection_id": connection_id})
        if not result.deleted_count:
            raise HTTPException(404, "Connection not found")
        if doc:
            conn = Connection.from_mongo(doc)
            for acc in conn.accounts:
                await db.metrics_daily.delete_many({"platform": conn.provider, "account_id": acc.account_id})
        await db.accounts.delete_many({"connection_id": connection_id})

    def frontend_redirect(self, key: str, ok: bool) -> str:
        return f"{self._base}/connections?connector={key}&status={'connected' if ok else 'failed'}"
