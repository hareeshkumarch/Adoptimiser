import { useEffect, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, CornerDownLeft, GitCommit, History } from "lucide-react";
import { useGraphTopology, useRunHistory } from "../../hooks/queries";
import { PRESET_AGENT_QUERIES } from "../../constants/prompts";
import { PLATFORM_LABEL } from "../../lib/format";
import { DEFAULT_QUERY, useDeepAgent } from "../../state/deepAgent";
import { StatusPill, type Tone } from "../common/StatusPill";
import { LangGraphCanvas } from "./LangGraphCanvas";
import { ScratchpadView } from "./ScratchpadView";
import { AGENT_LABEL, SubAgentTree } from "./SubAgentTree";
import { TaskTree } from "./TaskTree";
import { TraceLog } from "./TraceLog";

const STATUS_TONE: Record<string, Tone> = { idle: "slate", loading: "slate", starting: "iris", running: "iris", completed: "jade", failed: "ruby" };
const TAB =
  "border-b-2 border-transparent px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-slate-11 transition-colors hover:text-slate-12 data-[state=active]:border-jade-9 data-[state=active]:text-slate-12";

function QueryBox() {
  const { start, status, activeQuery } = useDeepAgent();
  const [query, setQuery] = useState(activeQuery || DEFAULT_QUERY);
  useEffect(() => {
    if (activeQuery) setQuery(activeQuery);
  }, [activeQuery]);
  const busy = status === "loading" || status === "starting" || status === "running";
  const submit = () => !busy && query.trim() && start(query.trim());
  return (
    <div className="rounded-2xl border border-slate-5 bg-white focus-within:border-jade-8">
      <div className="rounded-t-2xl border-b border-slate-5 bg-slate-2 px-4 py-3" role="group" aria-label="Suggested investigations" data-testid="agent-preset-queries">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="eyebrow">Suggested investigations</span>
          <span className="text-[10px] text-slate-10">Choose one to fill your request</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_AGENT_QUERIES.map((p) => {
            const selected = query === p.query;
            return (
              <button
                key={p.label}
                type="button"
                aria-pressed={selected}
                onClick={() => setQuery(p.query)}
                className={`rounded-full border px-3 py-1.5 font-mono text-[10px] transition-colors ${selected ? "border-slate-12 bg-slate-12 text-white" : "border-slate-5 bg-white text-slate-11 hover:text-slate-12"}`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
        rows={3}
        maxLength={600}
        className="w-full resize-none bg-transparent px-4 py-3 text-[13px] leading-relaxed outline-none placeholder:text-slate-10"
        aria-label="Investigation request"
        placeholder="Ask the deep agent to investigate…"
        data-testid="agent-query-input"
      />
      <div className="flex items-center justify-between border-t border-slate-6 px-3 py-2">
        <span className="font-mono text-[10px] text-slate-10">Ctrl / ⌘ + Enter · {query.length}/600</span>
        <button type="button" className="btn-primary h-7 px-2.5" disabled={busy || !query.trim()} onClick={submit} data-testid="agent-query-submit">
          <CornerDownLeft size={12} /> Investigate
        </button>
      </div>
    </div>
  );
}

function RunMeta() {
  const { status, run, events, files, error, selectRun } = useDeepAgent();
  const { data: history } = useRunHistory(run?.run_id);
  const tools = events.filter((e) => e.type === "tool_call").length;
  const checkpoints = run?.graph_meta?.checkpoints?.length ?? 0;
  const busy = status === "loading" || status === "starting" || status === "running";
  const runLabel = status === "starting" ? "Preparing investigation" : status === "running" ? "Live investigation" : run?.run_id ?? "—";

  return (
    <div className="rounded-2xl border border-slate-5 bg-white">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="eyebrow">Run</p>
          <p className="num mt-0.5 text-xs text-slate-12">{runLabel}</p>
        </div>
        <StatusPill tone={STATUS_TONE[status]} testId="agent-run-status">
          {status}
        </StatusPill>
      </div>
      <div className="grid grid-cols-4 gap-px border-t border-slate-6 bg-slate-6">
        {[
          ["Events", events.length],
          ["Tool calls", tools],
          ["Scratch files", files.length],
          ["Checkpoints", checkpoints],
        ].map(([label, value]) => (
          <div key={label} className="bg-white px-3 py-2.5">
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-11">{label}</p>
            <p className="num text-sm text-slate-12">{value}</p>
          </div>
        ))}
      </div>
      {history && history.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-6 bg-slate-2 px-4 py-2 text-xs">
          <span className="eyebrow flex items-center gap-1.5">
            <History size={11} /> Run History
          </span>
          <Select.Root value={run?.run_id ?? ""} onValueChange={selectRun} disabled={busy}>
            <Select.Trigger
              aria-label="Choose an investigation run"
              className="flex min-h-11 w-full py-1.5 items-center justify-between gap-3 rounded-xl border border-slate-5 bg-white px-3.5 text-left text-slate-12 outline-none transition-colors focus:border-jade-8 disabled:cursor-not-allowed disabled:opacity-50 sm:w-[260px]"
              data-testid="agent-run-history-select"
            >
              <Select.Value placeholder="Choose a run" />
              <ChevronDown size={14} className="shrink-0 text-slate-10" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Content position="popper" sideOffset={5} className="z-50 max-h-[min(320px,calc(100vh-3rem))] w-[var(--radix-select-trigger-width)] min-w-[240px] overflow-hidden rounded-2xl border border-slate-5 bg-white p-1.5">
                <Select.Viewport>
                  {history.map((h) => {
                    const scope = h.scope.account_id
                      ? `Account ${h.scope.account_id}`
                      : h.scope.platform
                        ? `${PLATFORM_LABEL[h.scope.platform]} Ads`
                        : "All platforms";
                    const attribution = h.window === "data_driven" ? "Data-driven" : h.window === "1d_click" ? "1-day click" : "7-day click";
                    return (
                      <Select.Item key={h.run_id} value={h.run_id} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-slate-12 outline-none data-[highlighted]:text-jade-11">
                        <Select.ItemText>
                          <span className="flex flex-col">
                            <span className="font-mono text-[11px]">{h.run_id}</span>
                            <span className="mt-0.5 text-[10px] text-slate-10">{scope} · {attribution} · {h.findings_count} findings</span>
                            <span className="mt-0.5 text-[10px] text-slate-9">
                              {new Date(h.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </span>
                        </Select.ItemText>
                        <Select.ItemIndicator className="ml-auto text-jade-11"><Check size={14} /></Select.ItemIndicator>
                      </Select.Item>
                    );
                  })}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>
      )}
      {error && (
        <p className="border-t border-ruby-6 bg-ruby-2 px-4 py-2 text-xs text-ruby-11" data-testid="agent-error">
          {error}
        </p>
      )}
    </div>
  );
}

function GraphCheckpointsView() {
  const { run } = useDeepAgent();
  const { data: topology } = useGraphTopology();
  const checkpoints = run?.graph_meta?.checkpoints ?? [];
  const edges = run?.graph_meta?.executed_edges ?? [];
  const mermaid = run?.graph_meta?.topology?.mermaid ?? topology?.mermaid ?? "";

  return (
    <div className="space-y-6 p-4" data-testid="langgraph-checkpoints-view">
      <LangGraphCanvas />
      <div>
        <p className="eyebrow mb-2">Executed StateGraph Checkpoints · {checkpoints.length} Supersteps</p>
        <div className="overflow-x-auto border border-slate-6">
          <table className="w-full border-collapse font-mono text-[11px]">
            <thead>
              <tr className="border-b border-slate-6 bg-slate-2">
                <th className="px-3 py-2 text-left font-normal text-slate-11">Step</th>
                <th className="px-3 py-2 text-left font-normal text-slate-11">Graph Node</th>
                <th className="px-3 py-2 text-right font-normal text-slate-11">Latency</th>
                <th className="px-3 py-2 text-right font-normal text-slate-11">VFS Files</th>
                <th className="px-3 py-2 text-left font-normal text-slate-11">State Summary</th>
              </tr>
            </thead>
            <tbody>
              {checkpoints.map((cp, i) => (
                <tr key={`${cp.node}-${i}`} className="border-t border-slate-4 " data-testid={`checkpoint-row-${cp.node}`}>
                  <td className="num px-3 py-2 text-slate-10">#{cp.step}</td>
                  <td className="px-3 py-2 text-slate-12">{AGENT_LABEL[cp.node] ?? cp.node}</td>
                  <td className="num px-3 py-2 text-right text-slate-11">{cp.duration_ms}ms</td>
                  <td className="num px-3 py-2 text-right text-slate-11">{cp.files_count ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-11">{JSON.stringify(cp.summary ?? {})}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {edges.length > 0 && (
        <div>
          <p className="eyebrow mb-2">Conditional & Directed Edge Transitions</p>
          <ul className="space-y-1 border border-slate-6 bg-slate-2 p-3 font-mono text-[11px]">
            {edges.map((e, i) => (
              <li key={i} className="flex items-center gap-2 text-slate-12">
                <GitCommit size={12} className={e.conditional ? "text-iris-11" : "text-slate-10"} />
                <span>{e.source}</span>
                <span className="text-slate-10">→</span>
                <span className="font-medium">{e.target}</span>
                {e.conditional && <StatusPill tone="iris">conditional: {e.branch}</StatusPill>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {mermaid && (
        <div>
          <p className="eyebrow mb-2">Compiled StateGraph Definition (Mermaid)</p>
          <pre className="overflow-x-auto border border-slate-6 bg-slate-2 p-3 font-mono text-[10px] leading-relaxed text-slate-12">{mermaid}</pre>
        </div>
      )}
    </div>
  );
}

export function AgentWorkspace() {
  const { files, run } = useDeepAgent();
  const checkpointCount = run?.graph_meta?.checkpoints?.length ?? 0;
  return (
    <div className="grid gap-8 lg:grid-cols-12" data-testid="agent-workspace">
      <div className="space-y-6 lg:col-span-5">
        <QueryBox />
        <RunMeta />
        <div className="border border-slate-6 bg-white">
          <SubAgentTree />
          <TaskTree />
        </div>
      </div>
      <Tabs.Root defaultValue="trace" className="flex flex-col rounded-2xl border border-slate-5 bg-white lg:col-span-7">
        <Tabs.List className="flex rounded-t-2xl border-b border-slate-5">
          <Tabs.Trigger value="trace" className={TAB} data-testid="agent-tab-trace">
            Reasoning trace
          </Tabs.Trigger>
          <Tabs.Trigger value="scratchpad" className={TAB} data-testid="agent-tab-scratchpad">
            Scratchpad · {files.length}
          </Tabs.Trigger>
          <Tabs.Trigger value="graph" className={TAB} data-testid="agent-tab-graph">
            LangGraph DAG · {checkpointCount}
          </Tabs.Trigger>
        </Tabs.List>
        <div className="max-h-[calc(100vh-14rem)] min-h-[420px] overflow-y-auto scrollbar-thin">
          <Tabs.Content value="trace">
            <TraceLog />
          </Tabs.Content>
          <Tabs.Content value="scratchpad">
            <ScratchpadView />
          </Tabs.Content>
          <Tabs.Content value="graph">
            <GraphCheckpointsView />
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </div>
  );
}
