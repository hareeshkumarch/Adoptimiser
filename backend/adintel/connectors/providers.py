import os
from dataclasses import dataclass, field
from urllib.parse import urlencode


@dataclass(frozen=True)
class OAuthProvider:
    key: str
    name: str
    authorize_url: str
    token_url: str
    scopes: list[str]
    id_env: str
    secret_env: str
    id_param: str = "client_id"
    extra_authorize: dict = field(default_factory=dict)
    console_url: str = ""

    @property
    def client_id(self) -> str | None:
        return os.environ.get(self.id_env)

    @property
    def client_secret(self) -> str | None:
        return os.environ.get(self.secret_env)

    @property
    def configured(self) -> bool:
        return bool(self.client_id and self.client_secret)

    def authorize(self, state: str, redirect_uri: str) -> str:
        params = {self.id_param: self.client_id, "redirect_uri": redirect_uri, "state": state, "response_type": "code"}
        if self.scopes:
            params["scope"] = " ".join(self.scopes) if self.key != "meta" else ",".join(self.scopes)
        return f"{self.authorize_url}?{urlencode(params | self.extra_authorize)}"

    def token_request(self, code: str, redirect_uri: str) -> dict:
        if self.key == "tiktok":
            return {"json": {"app_id": self.client_id, "secret": self.client_secret, "auth_code": code}}
        return {"data": {"client_id": self.client_id, "client_secret": self.client_secret, "redirect_uri": redirect_uri, "code": code, "grant_type": "authorization_code"}}


PROVIDERS: dict[str, OAuthProvider] = {
    p.key: p for p in [
        OAuthProvider("meta", "Meta Ads", "https://www.facebook.com/v21.0/dialog/oauth", "https://graph.facebook.com/v21.0/oauth/access_token",
                      ["ads_read"], "META_APP_ID", "META_APP_SECRET", console_url="https://developers.facebook.com/apps"),
        OAuthProvider("google", "Google Ads", "https://accounts.google.com/o/oauth2/v2/auth", "https://oauth2.googleapis.com/token",
                      ["https://www.googleapis.com/auth/adwords"], "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET",
                      extra_authorize={"access_type": "offline", "prompt": "consent"}, console_url="https://console.cloud.google.com/apis/credentials"),
        OAuthProvider("tiktok", "TikTok Ads", "https://business-api.tiktok.com/portal/auth", "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/",
                      [], "TIKTOK_APP_ID", "TIKTOK_APP_SECRET", id_param="app_id", console_url="https://business-api.tiktok.com/portal/apps"),
        OAuthProvider("linkedin", "LinkedIn Ads", "https://www.linkedin.com/oauth/v2/authorization", "https://www.linkedin.com/oauth/v2/accessToken",
                      ["r_ads_reporting", "r_ads"], "LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET", console_url="https://www.linkedin.com/developers/apps"),
    ]
}
