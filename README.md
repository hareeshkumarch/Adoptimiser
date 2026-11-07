# Quorum — Multi-Channel Ad Intelligence & Dynamic LangGraph Deep-Agent Platform

Quorum is a production-grade, read-only multi-channel paid-media diagnostic and optimization platform covering **Meta Ads**, **Google Ads**, **TikTok Ads**, and **LinkedIn Ads**.

## 1. End-to-End User Flow & Left-Side Panel Architecture

### Diagnostic Flow
1. **01 · Executive Pulse** (`/`):
   - Unified 7-day KPI strip with sparklines and period/benchmark deltas.
   - **Executive Impact Strip**: Instant summary of 14-day Verified Spend Bleed, Addressable Upside, and Portfolio MMM Equilibrium lift with 1-click navigation to downstream sections.
   - **Streamed LangGraph Synthesis**: Query-tailored editorial narrative streamed over Server-Sent Events (SSE).
   - **30-Day Velocity & Efficiency Recharts Visualizer (`CrossChannelTrendChart`)**: Switch between *Channel Spend & Blended ROAS*, *Platform Claimed ROAS vs. First-Party Store MER*, and *30d CPA vs. 14d Rolling Median*.
2. **02 · Root-Cause Audit** (`/diagnostics`):
   - **Interactive Severity & Impact Filter Cards**: Slice verified root causes by *All Verified*, *Critical Bleed*, *Warning & Saturation*, *Direct Cost Savings*, or *Demand & Attribution*.
   - **Critic-Verified Root-Cause Cards**: Expandable multi-agent evidence chains, adversarial critic challenges, and 1-click **Drill entity** (jumps directly to `/drilldown` scoped to that campaign/ad set/creative) and **Prescription** actions.
   - **Robust MAD Z-Score Outlier Plot (`AnomalyZScoreChart`)**: 30-day observed CPA against the 14-day rolling median and +2.5σ MAD tolerance band.
   - **Full-Funnel Stage Forensics (`FunnelForensicsPanel`)**: 5-stage conversion leakage matrix (`Impressions → Clicks → Sessions → Server LP CVR → Pixel Claim Ratio`).
   - **Ground-Truth Detector Evaluation & Stress Benchmark (`EvaluationPanel`)**: Scores precision, recall, F1, and false-positive trap rejection across unseen 60-day seeds.
3. **03 · Action & Allocation** (`/optimizations`):
   - **Multi-Channel Portfolio Equilibrium Solver (`PortfolioOptimizer`)**: Constrained log-log diminishing-returns reallocation equating marginal ROAS across all 4 platforms at zero net budget increase.
   - **Diminishing-Returns Frontier Chart (`ResponseCurveChart`)**: Interactive Recharts plot of expected weekly revenue $R(S) = \alpha \cdot S^\beta$ and marginal ROAS ($dR/dS$) across `40%–160%` spend multipliers per channel.
   - **Ranked Prescriptions & Budget-Shift Simulators**: Individual action cards ranked by $\text{Dollar Impact} \times \text{Confidence}$ with interactive Radix Slider budget-shift simulators.
4. **04 · Granular Explorer** (`/drilldown`):
   - **Interactive Hierarchy Breadcrumbs & Click-to-Drill**: Click any Platform row to drill into its Campaigns, click any Campaign to drill into its Ad Sets, and click any Ad Set to drill into its Creatives.
   - **Quick-Filter Summary Cards**: Filter entities by *All Entities*, *Flagged Root Causes*, *High Freq ≥ 3.5x*, *Lost IS ≥ 15%*, or *ROAS Champions ≥ 3x*, plus multi-column sorting and instant search.

### Deep Agent & Ops
5. **05 · LangGraph Studio** (`/agent`):
   - **Dynamic Query-Aware `StateGraph` Engine**: 10-node graph (`router → planner → ingestion → [anomaly ‖ attribution ‖ forensics] → critic -. should_reinvestigate .-> deep_dive → optimizer → orchestrator`) with preset investigation queries, run history switcher, reasoning trace, virtual file system scratchpad, and interactive **SVG StateGraph DAG Canvas (`LangGraphCanvas`)**.
6. **06 · Data Connectors** (`/connections` & Header **Sources** Drawer):
   - Read-only OAuth2 connectors (`ads_read`, `adwords`, `r_ads_reporting`) with Fernet-encrypted token storage, account deduplication, and 1-click 60-day sandbox telemetry refresh.

## 2. Production Docker Deployment

```bash
cp .env.example .env
docker compose up --build -d
```

- **Frontend (Nginx + SSE Reverse Proxy)**: `http://localhost:8080` (`GET /healthz`)
- **Backend (FastAPI + LangGraph)**: `http://localhost:8000` (`GET /api/v1/health`)
- **MongoDB 7.0**: `mongodb://localhost:27017`

## 3. GitHub CI/CD

GitHub Actions runs the backend integration suite on pull requests and pushes to `main`. Pull requests also build both production images without publishing them. A successful push to `main` publishes `ghcr.io/<owner>/quorum-backend` and `ghcr.io/<owner>/quorum-frontend` with `main`, `latest`, and commit SHA tags. Pushing a `v*` tag publishes that release tag and its commit SHA. Publishing uses the workflow's `GITHUB_TOKEN`; no registry secret is required.

To deploy the published images with Compose, set `GHCR_OWNER` and `IMAGE_TAG` in `.env`, then pull and start the services:

```bash
docker compose pull backend frontend
docker compose up -d --no-build
```

For private GHCR packages, authenticate on the deployment host with a GitHub token that has `read:packages` access before pulling. Use a version tag for repeatable releases; `latest` follows successful builds from `main`.
