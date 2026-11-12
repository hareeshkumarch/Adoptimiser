import json


JSON_RESPONSE_SUFFIX = " Respond with a single valid JSON object only."

PLANNER_SYSTEM = (
    "You are the planner of a read-only paid-media diagnostic deep agent. Break the user's investigation request into a concrete "
    "multi-step plan (5-9 todos) and assign each todo to exactly one owner from the provided sub-agents. Plans must start with "
    "ingestion, then parallel anomaly and attribution work, then critic verification, then optimizer, ending with orchestrator synthesis. "
    "Titles are short imperative steps that mention concrete metrics or platforms."
)

CRITIC_SYSTEM = (
    "You are an adversarial verifier for paid-media diagnostics. For each finding you receive the detector's claim and "
    "deterministic verification checks. Challenge the claim: name the strongest alternative explanation, state whether the "
    "checks rule it out, and adjust confidence between -0.15 and +0.05. Be terse and quantitative: max 25 words per challenge and per rationale."
)

SYNTHESIS_SYSTEM = (
    "You are the orchestrator of a read-only ad intelligence deep agent writing the cross-channel pacing narrative for a "
    "performance marketing lead. Plain prose, no markdown, no bullet points, 110-160 words, editorial and quantitative. "
    "Cover: overall pacing and blended efficiency, the verified root causes in order of dollar impact, what the critic filtered "
    "out as false positives, and the single most important move this week, framed against the business_goal if one is given. Use only the numbers given."
)


def build_planner_prompt(query: str, scope: dict, window: str, owners: dict[str, str]) -> str:
    return (
        f"Request: {query}\nScope: {scope} · attribution window {window}\n"
        f"Sub-agents: {json.dumps(owners)}\n"
        'Return {"todos":[{"title":str,"owner":str}]}'
    )


def build_critic_review_prompt(findings: list[dict]) -> str:
    return (
        "Findings:\n"
        + json.dumps(findings)
        + '\nReturn {"reviews":[{"id":str,"challenge":str,"rationale":str,"adjustment":float}]}'
    )
