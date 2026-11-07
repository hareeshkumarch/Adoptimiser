export const DEFAULT_AGENT_QUERY =
  "Run a full cross-channel diagnostic: find where budget is bleeding, verify root causes and rank optimizations by dollar impact.";

export const PRESET_AGENT_QUERIES = [
  {
    label: "Full Cross-Channel Audit",
    query: DEFAULT_AGENT_QUERY,
  },
  {
    label: "Creative Fatigue & Hook Decay",
    query: "Isolate creative fatigue, 3s hook drop-off and frequency saturation across Meta and TikTok video ad sets.",
  },
  {
    label: "Attribution & Brand Cannibalization",
    query: "Audit Meta Prospecting to Google Brand Search attribution overlap against first-party store MER.",
  },
  {
    label: "Marginal ROAS & Budget Reallocation",
    query: "Fit log-log response curves and compute optimal weekly budget shifts from bleeding ad sets to high-elasticity channels.",
  },
];
