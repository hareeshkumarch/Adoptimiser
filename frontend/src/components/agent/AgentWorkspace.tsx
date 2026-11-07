import { useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { CornerDownLeft, GitCommit, History } from "lucide-react";
import { useGraphTopology, useRunHistory } from "../../hooks/queries";
import { DEFAULT_QUERY, useDeepAgent } from "../../state/deepAgent";
import { StatusPill, type Tone } from "../common/StatusPill";
import { LangGraphCanvas } from "./LangGraphCanvas";
import { ScratchpadView } from "./ScratchpadView";
import { AGENT_LABEL, SubAgentTree } from "./SubAgentTree";
import { TaskTree } from "./TaskTree";
import { TraceLog } from "./TraceLog";

const STATUS_TONE: Record<string, Tone> = { idle: "slate", loading: "slate", running: "iris", completed: "jade", failed: "ruby" };
const TAB =
  "border-b-2 border-transparent px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-slate-11 transition-colors hover:text-slate-12 data-[state=active]:border-iris-9 data-[state=active]:text-slate-12";

const PRESET_QUERIES = [
  { label: "Full Cross-Channel Audit", query: DEFAULT_QUERY },
  { label: "Creative Fatigue & Hook Decay", query: "Isolate creative fatigue, 3s hook drop-off and frequency saturation across Meta and TikTok video ad sets." },
  { label: "Attribution & Brand Cannibalization", query: "Audit Meta Prospecting to Google Brand Search attribution overlap against first-party store MER." },
  { label: "Marginal ROAS & Budget Reallocation", query: "Fit log-log response curves and compute optimal weekly budget shifts from bleeding ad sets to high-elasticity channels." },
];

function QueryBox() {
  const { start, status } = useDeepAgent();
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const submit = () => query.trim() && start(query.trim());
  return (
    <div className="border border-slate-6 bg-white focus-within:border-iris-8">
      <div className="flex flex-wrap gap-1 border-b border-slate-6 bg-slate-2 px-3 py-2" data-testid="agent-preset-queries">
        {PRESET_QUERIES.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setQuery(p.query)}
            className="border border-slate-6 bg-white px-2 py-0.5 font-mono text-[10px] text-slate-11 transition-colors hover:border-iris-8 hover:text-iris-11"
          >
            {p.label}
          </button>
        ))}
      </div>
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && submit()}
        rows={3}
        maxLength={600}
        className="w-full resize-none bg-transparent px-4 py-3 text-[13px] leading-relaxed outline-none placeholder:text-slate-10"
        placeholder="Ask the deep agent to investigate…"
        data-testid="agent-query-input"
      />
      <div className="flex items-center justify-between border-t border-slate-6 px-3 py-2">
        <span className="font-mono text-[10px] text-slate-10">⌘ + Enter</span>
        <button className="btn-primary h-7 px-2.5" disabled={status === "running"} onClick={submit} data-testid="agent-query-submit">
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

  return (
    <div className="border border-slate-6 bg-white">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="eyebrow">Run</p>
          <p className="num mt-0.5 text-xs text-slate-12">{status === "running" ? "live · streaming over SSE" : run ? run.run_id : "—"}</p>
        </div>
        <StatusPill tone={STATUS_TONE[status]} testId="agent-run-status">
          {status}
        </StatusPill>
      </div>
      <div className="grid grid-cols-4 gap-px border-t border-slate-6 bg-slate-6">
        {[
          ["Events", events.length],
          ["Tool calls", tools],
          ["VFS Files", files.length],
          ["Checkpoints", checkpoints],
        ].map(([label, value]) => (
          <div key={label} className="bg-white px-3 py-2.5">
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-11">{label}</p>
            <p className="num text-sm text-slate-12">{value}</p>
          </div>
        ))}
      </div>
      {history && history.length > 1 && (
        <div className="flex items-center justify-between border-t border-slate-6 bg-slate-2 px-4 py-2 text-xs">
          <span className="eyebrow flex items-center gap-1.5">
            <History size={11} /> Run History
          </span>
          <select
            value={run?.run_id ?? ""}
            onChange={(e) => e.target.value && selectRun(e.target.value)}
            className="border border-slate-6 bg-white px-2 py-0.5 font-mono text-[11px] text-slate-12 outline-none"
            data-testid="agent-run-history-select"
          >
            {history.map((h) => (
              <option key={h.run_id} value={h.run_id}>
                {h.run_id} · {h.findings_count} findings · {new Date(h.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </option>
            ))}
          </select>
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
                <tr key={`${cp.node}-${i}`} className="border-t border-slate-4 hover:bg-slate-2" data-testid={`checkpoint-row-${cp.node}`}>
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
        <RunMeta />
        <QueryBox />
        <div className="border border-slate-6 bg-white">
          <SubAgentTree />
          <TaskTree />
        </div>
      </div>
      <Tabs.Root defaultValue="trace" className="flex flex-col border border-slate-6 bg-white lg:col-span-7">
        <Tabs.List className="flex border-b border-slate-6">
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
