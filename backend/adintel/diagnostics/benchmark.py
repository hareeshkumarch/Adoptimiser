import asyncio
from datetime import date, timedelta

import pandas as pd

from adintel.analytics.dataset import normalize_currency
from adintel.analytics.metrics import apply_window
from adintel.diagnostics import anomaly, attribution
from adintel.diagnostics.evaluation import evaluate
from adintel.diagnostics.verification import Evidence, run_checks, verdict
from adintel.sandbox.generator import generate


def diagnose(metrics: pd.DataFrame, store: pd.DataFrame) -> tuple[list[dict], list[dict]]:
    daily = anomaly.adset_daily(metrics)
    trends = anomaly.classify(metrics, anomaly.window_stats(daily))
    spikes = anomaly.spike_scan(daily, {i for f in trends for i in f["entity_ids"]})
    overlap = attribution.detect_overlap(attribution.overlap_shift(attribution.claimed_vs_store(metrics, store)), attribution.lagged_correlation(metrics), metrics)
    evidence = Evidence(metrics, store)
    confirmed, rejected = [], []
    for f in trends + spikes + ([overlap] if overlap else []):
        status, _ = verdict(f, run_checks(evidence, f))
        (confirmed if status == "confirmed" else rejected).append(f)
    return confirmed, rejected


def _frames(seed: int, end: date, window: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    rows, store_rows = generate(end, seed)
    metrics = pd.DataFrame(rows).assign(date=lambda d: pd.to_datetime(d["date"]))
    store = pd.DataFrame(store_rows).assign(date=lambda d: pd.to_datetime(d["date"]))
    return apply_window(normalize_currency(metrics), window), store


def _score(seed: int, window: str) -> dict:
    metrics, store = _frames(seed, date.today() - timedelta(days=1), window)
    confirmed, rejected = diagnose(metrics, store)
    result = evaluate({"run_id": f"seed-{seed}", "scope": {"platform": None}, "findings": confirmed, "rejected": rejected})
    return {"seed": seed, "precision": result["precision"], "recall": result["recall"], "f1": result["f1"], "traps_filtered": result["traps"]["filtered"], "traps_raised": result["traps"]["raised"], "missed": [i["kind"] for i in result["issues"] if not i["detected_by"]]}


def _mean(values: list) -> float | None:
    clean = [v for v in values if v is not None]
    return sum(clean) / len(clean) if clean else None


async def benchmark(seeds: int, window: str) -> dict:
    runs = await asyncio.gather(*(asyncio.to_thread(_score, 1000 + s, window) for s in range(seeds)))
    return {
        "seeds": seeds, "window": window, "runs": runs,
        "precision": _mean([r["precision"] for r in runs]),
        "recall": _mean([r["recall"] for r in runs]),
        "f1": _mean([r["f1"] for r in runs]),
        "trap_filter_rate": _mean([r["traps_filtered"] / r["traps_raised"] if r["traps_raised"] else None for r in runs]),
    }
