from adintel.sandbox.ground_truth import PLANTED_TRAPS, PlantedIssue, planted_issues


def _matches(finding: dict, issue: PlantedIssue) -> bool:
    return finding["kind"] == issue.kind and bool(issue.adset_ids & set(finding["entity_ids"]))


def _in_scope(issue: PlantedIssue, platform: str | None) -> bool:
    return platform is None or platform in issue.platforms


def evaluate(run: dict) -> dict:
    issues = [i for i in planted_issues() if _in_scope(i, run["scope"].get("platform"))]
    confirmed, rejected = run["findings"], run["rejected"]
    hits = {i.kind: next((f["id"] for f in confirmed if _matches(f, i)), None) for i in issues}
    true_pos = [f for f in confirmed if any(_matches(f, i) for i in issues)]
    false_pos = [f for f in confirmed if f not in true_pos]
    trap_kinds = {t["kind"] for t in PLANTED_TRAPS}
    traps_raised = [f for f in confirmed + rejected if f["kind"] in trap_kinds]
    traps_filtered = [f for f in rejected if f["kind"] in trap_kinds]
    precision = len(true_pos) / len(confirmed) if confirmed else None
    recall = sum(1 for v in hits.values() if v) / len(issues) if issues else None
    f1 = 2 * precision * recall / (precision + recall) if precision and recall else None
    return {
        "run_id": run["run_id"],
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "issues": [{"kind": i.kind, "label": i.label, "detected_by": hits[i.kind]} for i in issues],
        "false_positives": [{"id": f["id"], "headline": f["headline"]} for f in false_pos],
        "traps": {"raised": len(traps_raised), "filtered": len(traps_filtered), "labels": [t["label"] for t in PLANTED_TRAPS]},
        "critic_filter_rate": len(rejected) / (len(confirmed) + len(rejected)) if confirmed or rejected else None,
    }
