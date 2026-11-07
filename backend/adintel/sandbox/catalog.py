from dataclasses import dataclass
from typing import Optional

FX_TO_USD = {"USD": 1.0, "EUR": 1.08, "GBP": 1.27}

ACCOUNTS = [
    {"account_id": "act_221048", "platform": "meta", "name": "Northwind Outdoor EU", "currency": "EUR"},
    {"account_id": "123-456-7890", "platform": "google", "name": "Northwind Outdoor US", "currency": "USD"},
    {"account_id": "tt_7088213", "platform": "tiktok", "name": "Northwind TikTok Shop", "currency": "USD"},
    {"account_id": "li_503318", "platform": "linkedin", "name": "Northwind Wholesale UK", "currency": "GBP"},
]

ONE_DAY_SHARE = {"meta": 0.62, "google": 0.86, "tiktok": 0.55, "linkedin": 0.5}
DATA_DRIVEN_SHARE = {"meta": 0.82, "google": 0.88, "tiktok": 0.72, "linkedin": 0.78}


@dataclass(frozen=True)
class CreativeSpec:
    platform: str
    account_id: str
    campaign: str
    role: str
    adset: str
    creative: str
    spend: float
    cpm: float
    ctr: float
    cvr: float
    aov: float
    hook: Optional[float]
    hold: Optional[float]
    frequency: Optional[float]
    anomaly: Optional[str] = None
    search: bool = False


def _meta(campaign, role, adset, creative, spend, cpm, ctr, cvr, aov, hook, hold, freq, anomaly=None):
    return CreativeSpec("meta", "act_221048", campaign, role, adset, creative, spend, cpm, ctr, cvr, aov, hook, hold, freq, anomaly)


def _google(campaign, role, adset, creative, spend, cpm, ctr, cvr, aov, anomaly=None, search=True):
    return CreativeSpec("google", "123-456-7890", campaign, role, adset, creative, spend, cpm, ctr, cvr, aov, None, None, None, anomaly, search)


def _tiktok(campaign, role, adset, creative, spend, cpm, ctr, cvr, aov, hook, hold, freq, anomaly=None):
    return CreativeSpec("tiktok", "tt_7088213", campaign, role, adset, creative, spend, cpm, ctr, cvr, aov, hook, hold, freq, anomaly)


def _linkedin(campaign, role, adset, creative, spend, cpm, ctr, cvr, aov, freq, anomaly=None):
    return CreativeSpec("linkedin", "li_503318", campaign, role, adset, creative, spend, cpm, ctr, cvr, aov, None, None, freq, anomaly)


CATALOG: list[CreativeSpec] = [
    _meta("Prospecting · Advantage+", "prospecting", "Broad LAL 3%", "Trailhead Hero 15s", 1400, 9.5, 0.014, 0.028, 118, 0.32, 0.41, 2.1, "meta_fatigue"),
    _meta("Prospecting · Advantage+", "prospecting", "Broad LAL 3%", "Summit Carousel", 380, 9.0, 0.011, 0.025, 118, 0.24, 0.30, 2.0, "meta_fatigue_adset"),
    _meta("Prospecting · Advantage+", "prospecting", "Interest · Outdoor Enthusiasts", "Gear Flatlay Reel", 620, 8.8, 0.012, 0.026, 112, 0.27, 0.36, 1.8, "meta_scale"),
    _meta("Prospecting · Advantage+", "prospecting", "Interest · Outdoor Enthusiasts", "Founder Story 30s", 410, 8.4, 0.010, 0.024, 112, 0.25, 0.44, 1.7, "meta_scale"),
    _meta("Retargeting · DPA", "retargeting", "Site Visitors 30d", "DPA Catalog", 520, 14.0, 0.021, 0.060, 104, 0.21, 0.20, 3.2),
    _meta("Retargeting · DPA", "retargeting", "Site Visitors 30d", "Review Montage 10s", 240, 13.5, 0.018, 0.055, 104, 0.26, 0.33, 3.0),
    _google("Search · Non-Brand", "nonbrand", "Hiking Boots", "RSA · Boots Core", 1800, 38.0, 0.052, 0.040, 132, "google_is_loss"),
    _google("Search · Non-Brand", "nonbrand", "Trail Running Shoes", "RSA · Trail Core", 1100, 34.0, 0.048, 0.034, 124, "google_is_loss"),
    _google("Search · Brand", "brand", "Brand Exact", "RSA · Brand", 260, 30.0, 0.120, 0.060, 120, "brand_overlap"),
    _google("PMax · Shopping", "shopping", "All Products", "Asset Group · Catalog", 1300, 12.0, 0.009, 0.035, 98, search=False),
    _tiktok("Spark Ads · UGC", "prospecting", "Gen Z Broad", "UGC Unboxing v2", 900, 7.0, 0.011, 0.018, 86, 0.29, 0.22, 1.7, "tiktok_hook"),
    _tiktok("Spark Ads · UGC", "prospecting", "Gen Z Broad", "Creator Trail Test", 450, 7.2, 0.010, 0.017, 86, 0.26, 0.24, 1.6),
    _tiktok("Retargeting · Video Viewers", "retargeting", "Engaged 15s Viewers", "Spark · Review Stitch", 280, 9.0, 0.014, 0.035, 90, 0.27, 0.31, 2.6),
    _linkedin("Wholesale · Retail Buyers", "prospecting", "UK Retail Buyers", "Lead Gen · Catalog PDF", 520, 48.0, 0.0065, 0.11, 240, 3.1, "linkedin_bleed"),
    _linkedin("Retargeting · Site Visitors", "retargeting", "Website Visitors 90d", "Single Image · Trade Pricing", 210, 40.0, 0.009, 0.12, 240, 2.4),
]
