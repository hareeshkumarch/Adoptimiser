import os
from dataclasses import dataclass
from typing import Awaitable, Callable

import httpx

from adintel.models import LinkedAccount


@dataclass(frozen=True)
class DiscoveryResult:
    accounts: list[LinkedAccount]
    error: str | None = None


async def _meta(client: httpx.AsyncClient, token: str) -> list[LinkedAccount]:
    r = await client.get("https://graph.facebook.com/v21.0/me/adaccounts", params={"fields": "account_id,name,currency", "limit": 200}, headers={"Authorization": f"Bearer {token}"})
    r.raise_for_status()
    return [LinkedAccount(account_id=f"act_{a['account_id']}", name=a.get("name", a["account_id"]), currency=a.get("currency")) for a in r.json().get("data", [])]


async def _google(client: httpx.AsyncClient, token: str) -> list[LinkedAccount]:
    headers = {"Authorization": f"Bearer {token}", "developer-token": os.environ.get("GOOGLE_ADS_DEVELOPER_TOKEN", "")}
    r = await client.get("https://googleads.googleapis.com/v18/customers:listAccessibleCustomers", headers=headers)
    r.raise_for_status()
    return [LinkedAccount(account_id=name.split("/")[-1], name=f"Customer {name.split('/')[-1]}") for name in r.json().get("resourceNames", [])]


async def _tiktok(client: httpx.AsyncClient, token: str) -> list[LinkedAccount]:
    params = {"app_id": os.environ.get("TIKTOK_APP_ID", ""), "secret": os.environ.get("TIKTOK_APP_SECRET", "")}
    r = await client.get("https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/", params=params, headers={"Access-Token": token})
    r.raise_for_status()
    return [LinkedAccount(account_id=str(a["advertiser_id"]), name=a.get("advertiser_name", str(a["advertiser_id"]))) for a in r.json().get("data", {}).get("list", [])]


async def _linkedin(client: httpx.AsyncClient, token: str) -> list[LinkedAccount]:
    headers = {"Authorization": f"Bearer {token}", "LinkedIn-Version": "202501", "X-Restli-Protocol-Version": "2.0.0"}
    r = await client.get("https://api.linkedin.com/rest/adAccounts", params={"q": "search"}, headers=headers)
    r.raise_for_status()
    return [LinkedAccount(account_id=f"li_{a['id']}", name=a.get("name", str(a["id"])), currency=a.get("currency")) for a in r.json().get("elements", [])]


DISCOVERERS: dict[str, Callable[[httpx.AsyncClient, str], Awaitable[list[LinkedAccount]]]] = {
    "meta": _meta, "google": _google, "tiktok": _tiktok, "linkedin": _linkedin,
}


async def discover_accounts(provider: str, token: str) -> DiscoveryResult:
    async with httpx.AsyncClient(timeout=20) as client:
        try:
            return DiscoveryResult(await DISCOVERERS[provider](client, token))
        except httpx.HTTPError as exc:
            return DiscoveryResult([], f"Account discovery failed: {exc.__class__.__name__}")
