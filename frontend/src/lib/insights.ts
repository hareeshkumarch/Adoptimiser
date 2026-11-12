import axios from "axios";
import type { Platform } from "../types";

const API = `${process.env.REACT_APP_BACKEND_URL}/api/v1`;

export type Goal = "grow_revenue" | "cut_waste" | "fix_creative" | "scale_reach";
export type Category = "Scale" | "Save" | "Creative" | "Reach" | "Timing" | "Tracking" | "Budget";

export interface Opportunity {
  id: string;
  rank: number;
  category: Category;
  title: string;
  why: string;
  impact_usd: number;
  effort: "Low" | "Medium" | "High";
  confidence: number;
  entity: string;
  platform: Platform | "multi";
  evidence: string[];
  agent_query: string;
  ask_prompt: string;
}

export interface WeekdayRow { day: string; spend: number; revenue: number; roas: number; cpa: number }

export interface OpportunitiesResponse {
  summary: { weekly_upside: number; count: number; avg_roas: number; weekly_spend: number; categories: Record<string, number> };
  opportunities: Opportunity[];
  weekday: WeekdayRow[];
}

export interface ReachAdset {
  adset_id: string; adset: string; campaign: string; platform: Platform; spend: number; reach: number; reach_delta: number | null;
  frequency: number; frequency_base: number | null; ctr: number; cpa: number; cost_per_1k_reach: number; status: "Saturated" | "Tiring" | "Room to grow";
}

export interface ReachResponse {
  available: boolean;
  totals: { reach: number; reach_base: number; frequency: number; frequency_base: number; cost_per_1k_reach: number; cost_per_1k_reach_base: number; impressions: number; saturated_spend: number; saturated_count: number };
  platforms: { platform: Platform; reach: number; frequency: number; cost_per_1k_reach: number; spend: number; ctr: number }[];
  adsets: ReachAdset[];
  curve: { bucket: string; lo: number; cpa: number | null; ctr: number | null; roas: number | null; spend: number }[];
  sweet_spot: { bucket?: string; cpa?: number; worst_bucket?: string; worst_cpa?: number; penalty?: number | null };
  trend: ({ date: string } & Partial<Record<Platform, number | null>>)[];
  note: string;
}

export interface Workspace { onboarded: boolean; goal?: Goal; business_name?: string | null; target_roas?: number | null; monthly_budget?: number | null }

const scopeParams = (platform: string | null, accountId: string | null) =>
  Object.fromEntries(Object.entries({ platform, account_id: accountId }).filter(([, v]) => v));

export const insightsApi = {
  opportunities: (platform: string | null, accountId: string | null) =>
    axios.get<OpportunitiesResponse>(`${API}/insights/opportunities`, { params: scopeParams(platform, accountId) }).then((r) => r.data),
  reach: (platform: string | null, accountId: string | null) =>
    axios.get<ReachResponse>(`${API}/insights/reach`, { params: scopeParams(platform, accountId) }).then((r) => r.data),
  workspace: () => axios.get<{ workspace: Workspace }>(`${API}/workspace`).then((r) => r.data.workspace),
  saveWorkspace: (w: Omit<Workspace, "onboarded"> & { onboarded: boolean; goal: Goal }) =>
    axios.put<{ workspace: Workspace }>(`${API}/workspace`, w).then((r) => r.data.workspace),
};

export interface AskEvent { type: "thread" | "status" | "delta" | "done"; thread_id?: string; label?: string; delta?: string }

export async function askCopilot(body: { question: string; thread_id: string | null; scope: { platform: string | null; account_id: string | null } }, onEvent: (e: AskEvent) => void, signal?: AbortSignal) {
  const res = await fetch(`${API}/insights/ask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  if (!res.ok || !res.body) throw new Error("Copilot is unavailable");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const f of frames) {
      const line = f.split("\n").find((l) => l.startsWith("data: "));
      if (line) onEvent(JSON.parse(line.slice(6)) as AskEvent);
    }
  }
}

export const GOALS: { key: Goal; title: string; blurb: string; query: string }[] = [
  {
    key: "grow_revenue",
    title: "Grow revenue profitably",
    blurb: "Find where extra budget earns the most and what to move.",
    query: "Fit log-log response curves and compute optimal weekly budget shifts from bleeding ad sets to high-elasticity channels.",
  },
  {
    key: "cut_waste",
    title: "Cut wasted spend",
    blurb: "Spot ad sets and campaigns burning money with little return.",
    query: "Run a full cross-channel diagnostic: find where budget is bleeding, verify root causes and rank optimizations by dollar impact.",
  },
  {
    key: "fix_creative",
    title: "Fix tired creatives",
    blurb: "Catch ads people stopped watching and get fresh ideas.",
    query: "Isolate creative fatigue, 3s hook drop-off and frequency saturation across Meta and TikTok video ad sets.",
  },
  {
    key: "scale_reach",
    title: "Reach more new people",
    blurb: "See audience saturation, frequency and room to grow.",
    query: "Isolate creative fatigue, 3s hook drop-off and frequency saturation across Meta and TikTok video ad sets, and size audience headroom.",
  },
];
