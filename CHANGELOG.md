# CHANGELOG

## [2.1.0] — Dynamic Query-Aware LangGraph, Editorial Recharts Suite, De-Branding & Dockerization

### Added
- **Dynamic Intent Router Node (`router`)**: Classifies queries into `full_diagnostic`, `creative_forensics`, `attribution_mer`, or `budget_allocation`, writing `/router/intent.json` and adapting downstream planning and synthesis.
- **Editorial Recharts Visual Suite**:
  - `CrossChannelTrendChart.tsx` on `01 Executive Pulse` (30d spend stack, ROAS vs. Store MER, CPA trajectory).
  - `AnomalyZScoreChart.tsx` & interactive Severity/Impact filter cards on `02 Root-Cause Audit`.
  - `ResponseCurveChart.tsx` & `PortfolioOptimizer.tsx` on `03 Action & Allocation` (13-point log-log diminishing-returns grid & marginal ROAS frontier).
  - Quick-filter summary cards & click-to-drill breadcrumbs on `04 Granular Explorer`.
  - `LangGraphCanvas.tsx` interactive SVG StateGraph DAG inspector on `05 LangGraph Studio`.
- **Production Dockerization**: Added `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf` (with unbuffered SSE proxy rules), `docker-compose.yml`, and `.env.example`.
- **De-Branding & Code Hygiene**: Removed all third-party template folders, overlay plugins, tracking scripts, and code comments across 100% of backend and frontend source files.
