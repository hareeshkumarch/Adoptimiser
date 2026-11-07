import random
import re
from datetime import date, timedelta

from adintel.sandbox.catalog import CATALOG, DATA_DRIVEN_SHARE, FX_TO_USD, ONE_DAY_SHARE, ACCOUNTS, CreativeSpec

DAYS = 60
SEED = 42
TRACKING_OUTAGE_DAYS = (36, 37)
ORGANIC_ORDERS = 140
ORGANIC_AOV = 92.0
CURRENCY = {a["account_id"]: a["currency"] for a in ACCOUNTS}


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def adset_id(spec: CreativeSpec) -> str:
    return f"{spec.platform}-{_slug(spec.campaign)}-{_slug(spec.adset)}"


def _ramp(i: int, start: int, end: int, a: float, b: float) -> float:
    if i <= start:
        return a
    if i >= end:
        return b
    return a + (b - a) * (i - start) / (end - start)


def _meta_scale(i: int) -> float:
    return _ramp(i, 38, 59, 1.0, 1.4)


class _DayState:
    def __init__(self, spec: CreativeSpec, i: int, rng: random.Random):
        noise = lambda s: rng.gauss(1, s)
        self.spend = spec.spend * noise(0.05)
        self.cpm = spec.cpm * noise(0.05)
        self.ctr = spec.ctr * noise(0.06)
        self.cvr = spec.cvr * noise(0.08)
        self.hook = spec.hook * noise(0.04) if spec.hook else None
        self.hold = spec.hold * noise(0.04) if spec.hold else None
        self.frequency = spec.frequency * noise(0.03) if spec.frequency else None
        self.is_lost = (0.03 if spec.role == "brand" else 0.08) * noise(0.1) if spec.search else None
        self.claim_boost = 1.0
        self.noise = noise
        self.apply(spec, i)

    def apply(self, spec: CreativeSpec, i: int) -> None:
        if spec.anomaly in ("meta_fatigue", "meta_fatigue_adset"):
            self.frequency = _ramp(i, 44, 59, spec.frequency, 4.4) * self.noise(0.02)
            if spec.anomaly == "meta_fatigue":
                hook = _ramp(i, 54, 59, spec.hook, 0.17) * self.noise(0.03)
                self.ctr *= 0.3 + 0.7 * hook / spec.hook
                self.hook = hook
        elif spec.anomaly == "meta_scale":
            self.spend *= _meta_scale(i)
        elif spec.anomaly == "tiktok_hook":
            hook = _ramp(i, 54, 59, spec.hook, 0.11) * self.noise(0.03)
            self.ctr *= 0.5 + 0.5 * hook / spec.hook
            self.hook = hook
        elif spec.anomaly == "google_is_loss":
            self.spend = spec.spend * min(1.0, self.noise(0.012))
            demand = _ramp(i, 44, 59, 1.0, 1.45)
            self.is_lost = max(0.0, 1 - 0.92 / demand + self.noise(0.01) - 1)
        elif spec.anomaly == "linkedin_bleed":
            self.spend *= _ramp(i, 48, 59, 1.0, 1.4)
            self.frequency = _ramp(i, 44, 59, spec.frequency, 7.2) * self.noise(0.02)
            self.cvr *= _ramp(i, 48, 56, 1.0, 0.05)
        elif spec.anomaly == "brand_overlap":
            self.claim_boost = 1 + 2.3 * (_meta_scale(i - 2) - 1)


def _creative_row(spec: CreativeSpec, i: int, day: date, rng: random.Random) -> tuple[dict, float, float]:
    s = _DayState(spec, i, rng)
    if day.weekday() >= 5 and spec.anomaly != "google_is_loss":
        s.spend *= 0.9
    impressions = s.spend / s.cpm * 1000
    clicks = impressions * s.ctr
    true_conv = clicks * s.cvr
    sessions = clicks * 0.86
    tracking = 0.35 if i in TRACKING_OUTAGE_DAYS and spec.platform in ("meta", "google") else 1.0
    conv_7d = true_conv * s.claim_boost * tracking
    aov = spec.aov * s.noise(0.04)
    video_3s = impressions * s.hook if s.hook else None
    row = {
        "date": day.isoformat(),
        "platform": spec.platform,
        "account_id": spec.account_id,
        "currency": CURRENCY[spec.account_id],
        "campaign_id": f"{spec.platform}-{_slug(spec.campaign)}",
        "campaign": spec.campaign,
        "role": spec.role,
        "adset_id": adset_id(spec),
        "adset": spec.adset,
        "creative_id": f"{spec.platform}-{_slug(spec.adset)}-{_slug(spec.creative)}",
        "creative": spec.creative,
        "spend": round(s.spend, 2),
        "daily_budget": float(spec.spend),
        "impressions": round(impressions),
        "reach": round(impressions / s.frequency) if s.frequency else None,
        "frequency": round(s.frequency, 3) if s.frequency else None,
        "clicks": round(clicks),
        "conversions_1d": round(conv_7d * ONE_DAY_SHARE[spec.platform], 2),
        "conversions_7d": round(conv_7d, 2),
        "conversions_dd": round(conv_7d * DATA_DRIVEN_SHARE[spec.platform], 2),
        "revenue_1d": round(conv_7d * ONE_DAY_SHARE[spec.platform] * aov, 2),
        "revenue_7d": round(conv_7d * aov, 2),
        "revenue_dd": round(conv_7d * DATA_DRIVEN_SHARE[spec.platform] * aov, 2),
        "video_3s": round(video_3s) if video_3s else None,
        "video_15s": round(video_3s * s.hold) if video_3s and s.hold else None,
        "is_lost_budget": round(s.is_lost, 4) if s.is_lost is not None else None,
        "sessions": round(sessions),
        "lp_conversions": round(true_conv, 2),
    }
    fx = FX_TO_USD[CURRENCY[spec.account_id]]
    return row, true_conv, true_conv * aov * fx


def generate(end: date, seed: int = SEED) -> tuple[list[dict], list[dict]]:
    rng = random.Random(seed)
    start = end - timedelta(days=DAYS - 1)
    metrics, store = [], []
    for i in range(DAYS):
        day = start + timedelta(days=i)
        orders, revenue, sessions = 0.0, 0.0, 0.0
        for spec in CATALOG:
            row, true_conv, true_rev = _creative_row(spec, i, day, rng)
            metrics.append(row)
            orders += true_conv
            revenue += true_rev
            sessions += row["sessions"]
        organic = ORGANIC_ORDERS * rng.gauss(1, 0.05)
        store.append({
            "date": day.isoformat(),
            "orders": round(orders + organic, 1),
            "revenue": round(revenue + organic * ORGANIC_AOV, 2),
            "sessions": round(sessions + 5200 * rng.gauss(1, 0.04)),
        })
    return metrics, store
