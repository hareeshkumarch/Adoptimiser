import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

DEFAULT_FERNET_KEY = Fernet.generate_key().decode()


def _valid_fernet_key(candidate: str | None) -> str:
    if not candidate or not candidate.strip():
        return DEFAULT_FERNET_KEY
    cleaned = candidate.strip()
    try:
        Fernet(cleaned.encode())
        return cleaned
    except Exception:
        return DEFAULT_FERNET_KEY


@dataclass(frozen=True)
class Settings:
    mongo_url: str
    db_name: str
    cors_origins: list[str]
    llm_key: str
    llm_provider: str
    llm_model: str
    public_base_url: str
    token_key: str


@lru_cache
def get_settings() -> Settings:
    env = os.environ
    cors_raw = env.get("CORS_ORIGINS") or "*"
    return Settings(
        mongo_url=env.get("MONGO_URL") or "mongodb://localhost:27017",
        db_name=env.get("DB_NAME") or "adintel",
        cors_origins=[origin.strip() for origin in cors_raw.split(",") if origin.strip()] or ["*"],
        llm_key=env.get("LLM_API_KEY") or env.get("ANTHROPIC_API_KEY") or env.get("OPENAI_API_KEY") or "",
        llm_provider=env.get("LLM_PROVIDER") or "anthropic",
        llm_model=env.get("LLM_MODEL") or "claude-sonnet-4-20250514",
        public_base_url=(env.get("PUBLIC_BASE_URL") or "http://localhost:8080").rstrip("/"),
        token_key=_valid_fernet_key(env.get("TOKEN_ENCRYPTION_KEY")),
    )
