from typing import Any, Literal, Optional
from pydantic import BaseModel as _PydanticBaseModel, Field

try:
    from pydantic import BeforeValidator, ConfigDict
    from typing import Annotated
    HAS_PYDANTIC_V2 = True
except ImportError:
    BeforeValidator = None
    ConfigDict = None
    HAS_PYDANTIC_V2 = False

try:
    from bson import ObjectId
except ImportError:
    ObjectId = None

if HAS_PYDANTIC_V2:
    PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if ObjectId and isinstance(v, ObjectId) else str(v) if v is not None else v)]
else:
    PyObjectId = str

Platform = Literal["meta", "google", "tiktok", "linkedin"]
Window = Literal["1d_click", "7d_click", "data_driven"]
Compare = Literal["previous_period", "rolling_30d"]
Level = Literal["platform", "campaign", "adset", "creative"]


class CompatModel(_PydanticBaseModel):
    if HAS_PYDANTIC_V2:
        model_config = ConfigDict(populate_by_name=True, extra="ignore")
    else:
        class Config:
            allow_population_by_field_name = True
            extra = "ignore"

        @classmethod
        def model_validate(cls, obj: Any):
            return cls.parse_obj(obj)

        def model_dump(self, *, by_alias: bool = False, exclude_none: bool = False, exclude: Any = None, include: Any = None) -> dict:
            return self.dict(by_alias=by_alias, exclude_none=exclude_none, exclude=exclude, include=include)


class BaseDocument(CompatModel):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    @classmethod
    def from_mongo(cls, doc: dict):
        d = dict(doc)
        if "_id" in d and d["_id"] is not None:
            d["_id"] = str(d["_id"])
        return cls.model_validate(d)

    def to_mongo(self) -> dict:
        data = self.model_dump(by_alias=True, exclude_none=False)
        if data.get("_id") is None:
            data.pop("_id", None)
        return data


class Account(BaseDocument):
    account_id: str
    platform: Platform
    name: str
    currency: Optional[str] = None
    source: Literal["sandbox", "oauth"] = "sandbox"
    connection_id: Optional[str] = None


class LinkedAccount(CompatModel):
    account_id: str
    name: str
    currency: Optional[str] = None


class Scope(CompatModel):
    platform: Optional[str] = None
    account_id: Optional[str] = None
    campaign: Optional[str] = None
    adset_id: Optional[str] = None

    def query(self) -> dict:
        return {k: v for k, v in self.model_dump().items() if v is not None and v != ""}


class AgentRunRecord(BaseDocument):
    run_id: str
    query: str
    scope: Scope
    window: Window
    status: str
    created_at: str
    completed_at: Optional[str] = None
    todos: list[dict] = Field(default_factory=list)
    files: list[dict] = Field(default_factory=list)
    trace: list[dict] = Field(default_factory=list)
    findings: list[dict] = Field(default_factory=list)
    rejected: list[dict] = Field(default_factory=list)
    prescriptions: list[dict] = Field(default_factory=list)
    curves: dict = Field(default_factory=dict)
    forensics: list[dict] = Field(default_factory=list)
    portfolio: dict[str, Any] = Field(default_factory=dict)
    graph_meta: dict[str, Any] = Field(default_factory=dict)
    narrative: str = ""
    error: Optional[str] = None


class RunRequest(CompatModel):
    query: str = Field(
        default="Run a full cross-channel diagnostic: find where budget is bleeding, verify root causes and rank optimizations by dollar impact.",
        max_length=600,
    )
    scope: Scope = Field(default_factory=Scope)
    window: Window = "7d_click"


class Connection(BaseDocument):
    connection_id: str
    provider: Platform
    access_token: str
    refresh_token: Optional[str] = None
    expires_at: Optional[str] = None
    scopes: list[str] = Field(default_factory=list)
    connected_at: str
    accounts: list[LinkedAccount] = Field(default_factory=list)
    skipped_accounts: list[str] = Field(default_factory=list)
    discovery_error: Optional[str] = None

    def public(self) -> dict:
        return self.model_dump(
            include={
                "connection_id",
                "provider",
                "expires_at",
                "scopes",
                "connected_at",
                "accounts",
                "skipped_accounts",
                "discovery_error",
            }
        )
