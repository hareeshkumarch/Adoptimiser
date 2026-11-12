# Quorum — Read-only Ad Intelligence (Adoptimiser)

## Original request
Best design, interactive, good hovers, sharp buttons, deep agentic workflow, very fast; clear first-run flow that doesn't confuse users; useful + creative suggestions and reach analysis; read-only access to ad accounts (write/edit ads planned for future).

## Architecture
FastAPI (backend/adintel) + MongoDB (db adintel) + React/TS (CRA+craco, Tailwind, Radix, Recharts).
LLM: Emergent LLM key via emergentintegrations — Claude Sonnet 5.5 (narrative + Copilot, streamed), Claude Haiku 4.5 (planner/critic JSON, fast); deterministic fallbacks.

## Implemented (2026-06)
- 3-step onboarding /welcome: goal (+ name/target ROAS/monthly budget) → connect accounts read-only → live first AI audit; gate redirects un-onboarded users
- /insights Smart suggestions: ranked opportunities (Scale/Save/Creative/Reach/Timing/Tracking/Budget) with $ impact, evidence, "Ask how" → Copilot, "Deep dive" → agent; weekday ROAS bars
- Copilot (POST /api/v1/insights/ask SSE) grounded on KPIs, opportunities, reach, creatives, latest findings, goal; threads stored in copilot_messages
- /reach Reach & frequency: est. reach, frequency, cost/1k, frequency-vs-CPA sweet spot, trend, ad set headroom
- Workspace API GET/PUT /api/v1/workspace; goal feeds agent synthesis
- Sharp design system (square buttons, offset-shadow hovers, tile selects, sidebar indicator animations)
- Existing pages kept: /overview, /diagnostics, /optimizations, /drilldown, /agent, /connections

## Mocked
- Account linking uses demo wizard + sample data; real OAuth activates when platform app keys (META_APP_ID/SECRET, GOOGLE_ADS_CLIENT_ID/SECRET, TIKTOK_APP_ID/SECRET, LINKEDIN_CLIENT_ID/SECRET) are set

## Backlog
- P0: Real OAuth keys + live API data pulls (Meta Insights, Google Ads SearchStream, TikTok, LinkedIn)
- P1: Weekly email digest, saved Copilot threads list, creative image previews
- P2: Write/edit ads (future, explicitly deferred), multi-user workspaces/auth
