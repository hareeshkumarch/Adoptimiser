from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from adintel.connectors.service import ConnectorService
from adintel.sandbox.seed import ensure_sandbox

router = APIRouter(prefix="/api/v1", tags=["connectors"])
service = ConnectorService()


class WizardConnectBody(BaseModel):
    account_ids: list[str] = []


@router.get("/connectors")
async def connectors():
    return {"connectors": await service.status()}


@router.get("/connectors/{provider}/candidates")
async def provider_candidates(provider: str):
    return await service.candidates(provider)


@router.post("/connectors/{provider}/wizard-connect")
async def wizard_connect(provider: str, body: WizardConnectBody):
    return await service.wizard_connect(provider, body.account_ids)


@router.post("/connections/{connection_id}/sync")
async def sync_connection(connection_id: str):
    return await service.sync_connection(connection_id)


@router.post("/connectors/reseed")
async def reseed_sandbox():
    await ensure_sandbox(force=True)
    return {"ok": True, "connectors": await service.status()}


@router.get("/oauth/{provider}/start")
async def start(provider: str):
    return {"url": await service.start(provider)}


@router.get("/oauth/{provider}/callback")
async def callback(provider: str, state: str, code: str | None = None, auth_code: str | None = None):
    try:
        await service.complete(provider, code or auth_code or "", state)
    except HTTPException:
        return RedirectResponse(service.frontend_redirect(provider, False))
    return RedirectResponse(service.frontend_redirect(provider, True))


@router.delete("/connections/{connection_id}")
async def disconnect(connection_id: str):
    await service.disconnect(connection_id)
    return {"ok": True}
