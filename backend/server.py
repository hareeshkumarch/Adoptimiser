import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from adintel.config import get_settings
from adintel.db import client, ensure_indexes
from adintel.routers import analytics, connectors, deep_agent, insights
from adintel.sandbox.seed import ensure_sandbox

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    index_task = asyncio.create_task(ensure_indexes())
    await ensure_sandbox()
    yield
    index_task.cancel()
    with suppress(asyncio.CancelledError):
        await index_task
    client.close()


app = FastAPI(title="Quorum Ad Intelligence Deep Agent", lifespan=lifespan)


@app.get("/api/v1/health")
async def health():
    return {"status": "ok", "service": "quorum-adintel-backend"}


for module in (analytics, deep_agent, connectors, insights):
    app.include_router(module.router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=get_settings().cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
