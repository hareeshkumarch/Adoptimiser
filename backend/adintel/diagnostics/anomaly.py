import numpy as np
import pandas as pd

from adintel.analytics.metrics import LEVEL_KEYS, aggregate, pct_change, totals
from adintel.diagnostics.config import DETECTOR as C

RECENT_DAYS = C.recent_days
BASE_DAYS = C.baseline_days
HORIZON_DAYS = C.horizon_days
SEVERITY_RANK = {"critical": 2, "warning": 1}
ADSET_KEYS = LEVEL_KEYS["adset"]
STAT_METRICS = ["cpa", "roas", "ctr", "cpm", "cpc", "hook_rate", "hold_rate", "frequency", "is_lost", "lp_cvr", "conversions", "spend", "clicks"]
ADDITIVE_STATS = {"conversions", "spend", "clicks"}


def adset_daily(frame: pd.DataFrame) -> pd.DataFrame:
    return aggregate(frame, ADSET_KEYS + ["date"])


def robust_z(series: pd.Series, value) -> float | None:
    s = series.dropna()
    if len(s) < C.min_baseline_points or value is None or not np.isfinite(value):
        return None
    median = s.median()
    scale = max((s - median).abs().median() * 1.4826, abs(median) * 0.02, 1e-9)
    return float((value - median) / scale)


def _metric_stat(metric: str, recent_tot, base_tot, base: pd.DataFrame, g: pd.DataFrame, before, end) -> dict | None:
    r, b = recent_tot[metric], base_tot[metric]
    if pd.isna(r) or pd.isna(b):
        return None
    probe = r / RECENT_DAYS if metric in ADDITIVE_STATS else r
    start_val = g.loc[g["date"] == before, metric]
    last_val = g.loc[g["date"] == end, metric]
    return {
        "base": b, "recent": r, "change": pct_change(r, b), "z": robust_z(base[metric], probe),
        "start": float(start_val.iloc[0]) if len(start_val) else None,
        "last": float(last_val.iloc[0]) if len(last_val) else None,
    }


def window_stats(daily: pd.DataFrame) -> list[dict]:
    if daily.empty:
        return []
    end = daily["date"].max()
    recent_start = end - pd.Timedelta(days=RECENT_DAYS - 1)
    base_start = recent_start - pd.Timedelta(days=BASE_DAYS)
    before = recent_start - pd.Timedelta(days=1)
    stats = []
    for keys, g in daily.groupby(ADSET_KEYS):
        recent = g[g["date"] >= recent_start]
        base = g[(g["date"] >= base_start) & (g["date"] < recent_start)]
        rt, bt = totals(recent), totals(base, RECENT_DAYS / BASE_DAYS)
        metrics = {m: s for m in STAT_METRICS if (s := _metric_stat(m, rt, bt, base, g, before, end))}
        stats.append({**dict(zip(ADSET_KEYS, keys)), "metrics": metrics, "recent_start": recent_start, "base_start": base_start, "end": end})
    return stats


def drill_creatives(frame: pd.DataFrame, adset_id: str, recent_start: pd.Timestamp) -> dict | None:
    before = recent_start - pd.Timedelta(days=1)
    rows = aggregate(frame[frame["adset_id"] == adset_id], ["creative_id", "creative", "date"])
    end = rows["date"].max()
    start = rows[rows["date"] == before].set_index("creative_id")
    last = rows[rows["date"] == end].set_index("creative_id")
    joined = start[["creative", "hook_rate", "spend"]].join(last[["hook_rate"]], rsuffix="_last").dropna()
    joined = joined[joined["hook_rate"] > 1e-6]
    if joined.empty:
        return None
    joined["drop"] = joined["hook_rate_last"] / joined["hook_rate"] - 1
    worst = joined.sort_values("drop").iloc[0]
    return {"creative": worst["creative"], "hook_start": worst["hook_rate"], "hook_last": worst["hook_rate_last"], "change": worst["drop"]}


def _m(stat: dict, key: str) -> dict:
    return stat["metrics"].get(key) or {}


def _entity(stat: dict) -> dict:
    return {
        "platform": stat["platform"], "account_id": stat["account_id"], "campaign": stat["campaign"],
        "entity_level": "adset", "entity_ids": [stat["adset_id"]], "entity_name": stat["adset"],
        "recent_start": stat["recent_start"], "base_start": stat["base_start"], "end": stat["end"],
    }


def _finding(kind: str, title: str, severity: str, stat: dict, headline: str, metric: str, evidence: list[str], impact: float, impact_type: str, z) -> dict:
    m = _m(stat, metric)
    return {
        "id": f"{kind}:{stat['adset_id']}", "kind": kind, "title": title, "severity": severity, **_entity(stat),
        "headline": headline, "metric": metric, "baseline": m.get("base"), "recent": m.get("recent"), "change": m.get("change"), "z": z,
        "evidence": [{"step": "detected", "agent": "anomaly", "label": e} for e in evidence],
        "dollar_impact": max(0.0, float(impact)), "impact_type": impact_type, "status": "candidate",
    }


def _excess_cost(stat: dict) -> float:
    cpa, conv = _m(stat, "cpa"), _m(stat, "conversions")
    return (cpa["recent"] - cpa["base"]) * conv["recent"] / RECENT_DAYS * HORIZON_DAYS


def _engagement_decayed(hook: dict, ctr: dict) -> bool:
    return (hook.get("z") or 0) <= C.engagement_decay_z and (ctr.get("z") or 0) <= C.engagement_decay_z


def _efficiency_degraded(cpa: dict) -> bool:
    return (cpa.get("z") or 0) >= C.efficiency_cpa_z and (cpa.get("change") or 0) >= C.material_cpa_lift


def detect_fatigue(stat: dict, creative: dict | None) -> dict | None:
    freq, hook, cpa, ctr = _m(stat, "frequency"), _m(stat, "hook_rate"), _m(stat, "cpa"), _m(stat, "ctr")
    if not (freq and hook and cpa) or freq["recent"] < C.saturation_frequency or not _engagement_decayed(hook, ctr) or not _efficiency_degraded(cpa):
        return None
    evidence = [
        f"Ad set CPA ${cpa['base']:.2f} → ${cpa['recent']:.2f} ({cpa['change']:+.0%}, robust z {_m(stat, 'cpa').get('z') or 0:+.1f})",
        f"Frequency crossed {freq['last']:.1f} (baseline {freq['base']:.1f})",
        f"Hook rate {hook['start']:.0%} → {hook['last']:.0%} over {RECENT_DAYS} days · CTR {ctr.get('change') or 0:+.0%}",
    ]
    if creative:
        evidence.append(f"Worst creative '{creative['creative']}' hook {creative['hook_start']:.0%} → {creative['hook_last']:.0%}")
    severity = "critical" if cpa["change"] >= C.critical_cpa_lift else "warning"
    return _finding("creative_fatigue", "Creative fatigue & audience saturation", severity, stat, f"Ad Set CPA {cpa['change']:+.0%}", "cpa", evidence, _excess_cost(stat), "savings", hook["z"]) | {"creative": creative}


def detect_hook_dropoff(stat: dict, creative: dict | None) -> dict | None:
    freq, hook, cpa = _m(stat, "frequency"), _m(stat, "hook_rate"), _m(stat, "cpa")
    ctr = _m(stat, "ctr")
    if not (hook and cpa) or (hook["z"] or 0) > C.hook_dropoff_z or not _engagement_decayed(hook, ctr) or not _efficiency_degraded(cpa) or (freq and freq["recent"] >= C.saturation_frequency):
        return None
    evidence = [
        f"Hook rate {hook['start']:.0%} → {hook['last']:.0%} over {RECENT_DAYS} days (robust z {hook['z']:+.1f})",
        f"CPA ${cpa['base']:.2f} → ${cpa['recent']:.2f} ({cpa['change']:+.0%})",
        f"Frequency {freq.get('recent') or 0:.1f} — below saturation threshold",
    ]
    if creative:
        evidence.append(f"Drop concentrated in '{creative['creative']}' ({creative['hook_start']:.0%} → {creative['hook_last']:.0%})")
    return _finding("hook_dropoff", "Creative hook drop-off", "warning", stat, f"Hook Rate {hook['change']:+.0%}", "hook_rate", evidence, _excess_cost(stat), "savings", hook["z"]) | {"creative": creative}


def detect_is_loss(stat: dict) -> dict | None:
    isl, conv, roas = _m(stat, "is_lost"), _m(stat, "conversions"), _m(stat, "roas")
    if not isl or isl["recent"] - isl["base"] < C.is_loss_delta:
        return None
    daily_conv = conv["recent"] / RECENT_DAYS
    r_isl = min(float(isl["recent"]), 0.999)
    b_isl = min(float(isl["base"]), 0.999)
    lost = daily_conv * (r_isl / (1.0 - r_isl) - b_isl / (1.0 - b_isl))
    aov = roas["recent"] * _m(stat, "cpa")["recent"]
    evidence = [
        f"Impression share lost to budget {isl['base']:.0%} → {isl['last']:.0%}",
        f"Conversions flat ({conv['change'] or 0:+.0%}) while CPA stable at ${_m(stat, 'cpa')['recent']:.2f}",
        f"~{lost:.1f} conversions/day left on the table at ROAS {roas['recent']:.2f}",
    ]
    return _finding("impression_share_loss", "Search impression share loss", "warning", stat, f"Lost IS (budget) {isl['base']:.0%} → {isl['recent']:.0%}", "is_lost", evidence, lost * aov * HORIZON_DAYS, "revenue", isl["z"])


def detect_bleeder(stat: dict) -> dict | None:
    spend, conv, freq = _m(stat, "spend"), _m(stat, "conversions"), _m(stat, "frequency")
    if not spend or (spend["change"] or 0) < C.bleed_spend_lift or (conv.get("change") or 0) > C.bleed_conversion_drop:
        return None
    evidence = [
        f"Spend {spend['change']:+.0%} vs baseline (${spend['recent'] / RECENT_DAYS:,.0f}/day)",
        f"Conversions {conv['change']:+.0%} ({conv['base']:.1f} → {conv['recent']:.1f} per {RECENT_DAYS}d)",
    ]
    if freq:
        evidence.append(f"Frequency {freq['base']:.1f} → {freq['last']:.1f} — audience exhausted")
    impact = spend["recent"] / RECENT_DAYS * HORIZON_DAYS * min(1.0, -conv["change"])
    return _finding("silent_bleeder", "Silent budget bleeder", "critical", stat, f"Conversions {conv['change']:+.0%} · Spend {spend['change']:+.0%}", "conversions", evidence, impact, "savings", conv.get("z"))


TREND_DETECTORS = (detect_fatigue, detect_hook_dropoff)


def classify(metrics: pd.DataFrame, stats: list[dict]) -> list[dict]:
    found = []
    for stat in stats:
        creative = drill_creatives(metrics, stat["adset_id"], stat["recent_start"]) if stat["metrics"].get("hook_rate") else None
        trend = next((f for detector in TREND_DETECTORS if (f := detector(stat, creative))), None)
        found.extend(f for f in (trend, detect_is_loss(stat), detect_bleeder(stat)) if f)
    return dedupe_by_entity(merge_by_campaign(found, "impression_share_loss"))


def dedupe_by_entity(findings: list[dict]) -> list[dict]:
    best: dict[str, dict] = {}
    for f in findings:
        key = "|".join(sorted(f["entity_ids"]))
        current = best.get(key)
        if not current or (SEVERITY_RANK[f["severity"]], f["dollar_impact"]) > (SEVERITY_RANK[current["severity"]], current["dollar_impact"]):
            best[key] = f
    return list(best.values())


def merge_by_campaign(findings: list[dict], kind: str) -> list[dict]:
    groups: dict[str, list[dict]] = {}
    for f in findings:
        if f["kind"] == kind:
            groups.setdefault(f["campaign"], []).append(f)
    merged = [f for f in findings if f["kind"] != kind]
    for campaign, items in groups.items():
        lead = max(items, key=lambda f: f["dollar_impact"])
        merged.append(lead | {
            "id": f"{kind}:{lead['entity_ids'][0].rsplit('-', 1)[0]}", "entity_level": "campaign", "entity_name": campaign,
            "entity_ids": [i for f in items for i in f["entity_ids"]], "dollar_impact": sum(f["dollar_impact"] for f in items),
            "evidence": lead["evidence"] + [{"step": "detected", "agent": "anomaly", "label": f"Pattern repeats across {len(items)} ad groups: {', '.join(f['entity_name'] for f in items)}"}],
        })
    return merged


def spike_scan(daily: pd.DataFrame, exclude: set[str]) -> list[dict]:
    if daily.empty:
        return []
    end = daily["date"].max()
    flagged = []
    for adset_id, g in daily[~daily["adset_id"].isin(exclude)].groupby("adset_id"):
        g = g.sort_values("date")
        roll = g["cpa"].rolling(C.spike_rolling_days, min_periods=C.min_baseline_points)
        median = roll.median().shift(1)
        mad = roll.apply(lambda x: np.median(np.abs(x - np.median(x))), raw=True).shift(1) * 1.4826
        z = (g["cpa"] - median) / np.maximum(mad, median * 0.02)
        hits = g.assign(z=z, cpa_base=median)
        hits = hits[(hits["z"] > C.spike_z) & (hits["date"] < end - pd.Timedelta(days=RECENT_DAYS - 1)) & (hits["date"] > end - pd.Timedelta(days=30))]
        flagged.extend(hits.to_dict("records"))
    return _cluster_spikes(flagged)


def _cluster_spikes(flagged: list[dict]) -> list[dict]:
    dates = sorted({r["date"] for r in flagged})
    clusters, current = [], []
    for d in dates:
        if current and (d - current[-1]).days > 1:
            clusters.append(current)
            current = []
        current.append(d)
    if current:
        clusters.append(current)
    findings = []
    for days in clusters:
        if len(days) > C.spike_max_days:
            continue
        rows = [r for r in flagged if r["date"] in days]
        if len({r["adset_id"] for r in rows}) < C.spike_min_entities:
            continue
        findings.append(_spike_finding(days, rows))
    return findings


def _spike_finding(days: list, rows: list[dict]) -> dict:
    cpa, base = float(np.mean([r["cpa"] for r in rows])), float(np.mean([r["cpa_base"] for r in rows]))
    platforms = sorted({r["platform"] for r in rows})
    adsets = sorted({r["adset_id"] for r in rows})
    label = " – ".join(sorted({d.strftime("%b %d") for d in days}))
    excess = sum((r["cpa"] - r["cpa_base"]) * r["conversions"] for r in rows)
    return {
        "id": f"cpa_spike:{days[0].date().isoformat()}", "kind": "cpa_spike", "title": "CPA spike", "severity": "critical",
        "platform": platforms[0] if len(platforms) == 1 else "multi", "platforms": platforms, "account_id": None, "campaign": None,
        "entity_level": "adset", "entity_ids": adsets, "entity_name": f"{len(adsets)} ad sets · {', '.join(p.title() for p in platforms)}",
        "dates": days, "recent_start": days[0], "base_start": days[0] - pd.Timedelta(days=14), "end": days[-1],
        "headline": f"CPA {cpa / base - 1:+.0%} on {label}", "metric": "cpa", "baseline": base, "recent": cpa, "change": cpa / base - 1,
        "z": float(max(r["z"] for r in rows)),
        "evidence": [
            {"step": "detected", "agent": "anomaly", "label": f"Rolling {C.spike_rolling_days}d robust z-score > {C.spike_z} on {len(rows)} ad-set-days"},
            {"step": "detected", "agent": "anomaly", "label": f"Mean CPA ${base:.2f} → ${cpa:.2f} across {', '.join(p.title() for p in platforms)}"},
        ],
        "dollar_impact": max(0.0, float(excess)), "impact_type": "savings", "status": "candidate",
    }
