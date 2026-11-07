import { createContext, useCallback, useContext, useEffect, useReducer, useRef, type ReactNode } from "react";
import { api, subscribeRun } from "../lib/api";
import { DEFAULT_AGENT_QUERY } from "../constants/prompts";
import { useFilters } from "./filters";
import type { AgentEvent, AgentRun, RecursionGuard, ScratchFile, Todo } from "../types";

export type AgentStatus = "pending" | "running" | "done";
export type RunStatus = "idle" | "loading" | "starting" | "running" | "completed" | "failed";

export const DEFAULT_QUERY = DEFAULT_AGENT_QUERY;

export interface LiveProgress {
  percentage: number;
  stageIndex: number;
  totalStages: number;
  stageLabel: string;
  activeNode: string;
  activeTool: string | null;
  recursionGuard: RecursionGuard | null;
  findingsCount: number;
  confidence: number;
}

const DEFAULT_PROGRESS: LiveProgress = {
  percentage: 0,
  stageIndex: 0,
  totalStages: 10,
  stageLabel: "Initializing StateGraph",
  activeNode: "router",
  activeTool: null,
  recursionGuard: null,
  findingsCount: 0,
  confidence: 0.88,
};

interface State {
  status: RunStatus;
  events: AgentEvent[];
  todos: Todo[];
  agents: Record<string, AgentStatus>;
  files: ScratchFile[];
  narrative: string;
  run: AgentRun | null;
  progress: LiveProgress;
  startedAt: string | null;
  error: string | null;
}

type Action =
  | { type: "loading" }
  | { type: "starting" }
  | { type: "start" }
  | { type: "event"; event: AgentEvent }
  | { type: "loaded"; run: AgentRun | null }
  | { type: "failed"; error: string };

const INITIAL: State = {
  status: "idle",
  events: [],
  todos: [],
  agents: {},
  files: [],
  narrative: "",
  run: null,
  progress: DEFAULT_PROGRESS,
  startedAt: null,
  error: null,
};

function fromRun(run: AgentRun): State {
  const agents = Object.fromEntries((run.trace ?? []).filter((e) => e.type === "agent_start").map((e) => [e.agent, "done" as AgentStatus]));
  const steps = run.graph_meta?.steps ?? 9;
  const maxSteps = run.graph_meta?.max_supersteps ?? 12;
  return {
    ...INITIAL,
    status: "completed",
    events: run.trace ?? [],
    todos: run.todos,
    agents,
    files: run.files,
    narrative: run.narrative,
    run,
    progress: {
      percentage: 100,
      stageIndex: 10,
      totalStages: 10,
      stageLabel: "Step 10/10 · LangGraph investigation complete",
      activeNode: "orchestrator",
      activeTool: null,
      recursionGuard: {
        pass_current: 2,
        pass_max: 2,
        pass_label: "Pass 2/2",
        superstep_current: steps,
        superstep_max: maxSteps,
        superstep_label: `Superstep ${steps}/${maxSteps}`,
        node_visits: 1,
        node_budget: 1,
        remaining_steps: Math.max(0, maxSteps - steps),
      },
      findingsCount: run.findings.length,
      confidence: run.findings.length ? run.findings.reduce((s, f) => s + f.confidence, 0) / run.findings.length : 0.9,
    },
    startedAt: run.created_at,
  };
}

function upsertFile(files: ScratchFile[], e: AgentEvent): ScratchFile[] {
  const file: ScratchFile = { path: e.path ?? "", author: e.agent, kind: e.kind ?? "json", content: e.content, created_at: e.created_at ?? e.ts ?? "" };
  return [...files.filter((f) => f.path !== file.path), file];
}

function onEvent(state: State, e: AgentEvent): State {
  const last = state.events[state.events.length - 1];
  if (last && e.seq <= last.seq) return state;
  const next = { ...state, events: [...state.events, e] };
  switch (e.type) {
    case "agent_progress":
      return {
        ...next,
        progress: {
          percentage: Math.max(state.progress.percentage, e.percentage ?? state.progress.percentage),
          stageIndex: e.stage_index ?? state.progress.stageIndex,
          totalStages: e.total_stages ?? state.progress.totalStages,
          stageLabel: e.stage_label ?? state.progress.stageLabel,
          activeNode: e.active_node ?? e.agent,
          activeTool: state.progress.activeTool,
          recursionGuard: e.recursion_guard ?? state.progress.recursionGuard,
          findingsCount: e.findings_count ?? state.progress.findingsCount,
          confidence: e.confidence ?? state.progress.confidence,
        },
      };
    case "tool_call":
      return {
        ...next,
        progress: { ...state.progress, activeNode: e.agent, activeTool: e.tool ?? null },
      };
    case "todos":
      return { ...next, todos: e.todos ?? [] };
    case "agent_start":
      return { ...next, agents: { ...state.agents, [e.agent]: "running" } };
    case "agent_end":
      return { ...next, agents: { ...state.agents, [e.agent]: "done" } };
    case "scratchpad_write":
      return { ...next, files: upsertFile(state.files, e) };
    case "narrative_delta":
      return { ...next, narrative: state.narrative + (e.delta ?? "") };
    case "run_complete":
      return {
        ...next,
        status: "completed",
        run: e.run ?? null,
        narrative: e.run?.narrative ?? state.narrative,
        progress: { ...state.progress, percentage: 100, stageLabel: "Step 10/10 · LangGraph investigation complete", activeTool: null },
      };
    case "run_failed":
      return { ...next, status: "failed", error: e.run?.error ?? "Run failed" };
    default:
      return next;
  }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "loading":
      return { ...state, status: "loading" };
    case "starting":
      return { ...state, status: "starting", error: null };
    case "start":
      return { ...INITIAL, status: "running", run: state.run, progress: { ...DEFAULT_PROGRESS, percentage: 4 }, startedAt: new Date().toISOString() };
    case "event":
      return onEvent(state, action.event);
    case "loaded":
      return action.run ? fromRun(action.run) : { ...INITIAL };
    case "failed":
      return { ...state, status: "failed", error: action.error };
  }
}

interface DeepAgentValue extends State {
  start: (query: string) => void;
  selectRun: (runId: string) => void;
}

const DeepAgentContext = createContext<DeepAgentValue | null>(null);

export function DeepAgentProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const filters = useFilters();
  const unsubscribe = useRef<(() => void) | null>(null);
  const runRequestInFlight = useRef(false);

  const follow = useCallback((runId: string) => {
    runRequestInFlight.current = true;
    unsubscribe.current?.();
    dispatch({ type: "start" });
    unsubscribe.current = subscribeRun(
      runId,
      (event) => {
        if (event.type === "run_complete" || event.type === "run_failed") runRequestInFlight.current = false;
        dispatch({ type: "event", event });
      },
      (error) => {
        runRequestInFlight.current = false;
        dispatch({ type: "failed", error });
      },
    );
  }, []);

  const start = useCallback(
    (query: string) => {
      if (runRequestInFlight.current) return;
      runRequestInFlight.current = true;
      dispatch({ type: "starting" });
      const body = {
        query,
        scope: { platform: filters.platform, account_id: filters.accountId, campaign: filters.campaign, adset_id: filters.adsetId },
        window: filters.window,
      };
      api.startRun(body).then(follow).catch((err: Error) => {
        runRequestInFlight.current = false;
        dispatch({ type: "failed", error: err.message });
      });
    },
    [filters.platform, filters.accountId, filters.campaign, filters.adsetId, filters.window, follow],
  );

  const selectRun = useCallback((runId: string) => {
    runRequestInFlight.current = false;
    unsubscribe.current?.();
    dispatch({ type: "loading" });
    api.getRun(runId).then(
      (run) => dispatch({ type: "loaded", run }),
      (err: Error) => dispatch({ type: "failed", error: err.message }),
    );
  }, []);

  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    dispatch({ type: "loading" });
    Promise.all([api.activeRun(), api.latestRun()]).then(([active, latest]) => {
      if (active) follow(active);
      else if (latest) dispatch({ type: "loaded", run: latest });
      else start(DEFAULT_QUERY);
    });
    return () => unsubscribe.current?.();
  }, [start, follow]);

  return <DeepAgentContext.Provider value={{ ...state, start, selectRun }}>{children}</DeepAgentContext.Provider>;
}

export function useDeepAgent(): DeepAgentValue {
  const ctx = useContext(DeepAgentContext);
  if (!ctx) throw new Error("useDeepAgent must be used within DeepAgentProvider");
  return ctx;
}
