from dataclasses import dataclass

from adintel.sandbox.catalog import CATALOG
from adintel.sandbox.generator import adset_id

ANOMALY_KIND = {
    "meta_fatigue": "creative_fatigue",
    "google_is_loss": "impression_share_loss",
    "tiktok_hook": "hook_dropoff",
    "linkedin_bleed": "silent_bleeder",
    "brand_overlap": "attribution_overlap",
}


@dataclass(frozen=True)
class PlantedIssue:
    kind: str
    platforms: frozenset[str]
    adset_ids: frozenset[str]
    label: str


def planted_issues() -> list[PlantedIssue]:
    grouped: dict[str, tuple[set[str], set[str], str]] = {}
    for spec in CATALOG:
        kind = ANOMALY_KIND.get(spec.anomaly or "")
        if not kind:
            continue
        platforms, adsets, _ = grouped.setdefault(kind, (set(), set(), spec.campaign if kind == "impression_share_loss" else f"{spec.campaign} · {spec.adset}"))
        platforms.add(spec.platform)
        adsets.add(adset_id(spec))
    grouped["attribution_overlap"][0].add("meta")
    return [PlantedIssue(kind, frozenset(p), frozenset(a), label) for kind, (p, a, label) in grouped.items()]


PLANTED_TRAPS = [{"kind": "cpa_spike", "label": "2-day Meta + Google pixel outage (store orders unaffected)"}]
