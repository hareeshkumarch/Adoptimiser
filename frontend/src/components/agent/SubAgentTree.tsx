import { Check, GitBranch, Loader2 } from "lucide-react";
import { cn } from "../../lib/cn";
import { useDeepAgent, type AgentStatus } from "../../state/deepAgent";

interface Node {
  id: string;
  label: string;
  badge?: string;
  children?: Node[];
}

export const AGENT_LABEL: Record<string, string> = {
  router: "Intent Router · classify_query",
  planner: "Planner · write_todos",
  ingestion: "Ingestion & Normalization",
  anomaly: "Anomaly & Bleed Detector",
  attribution: "Attribution & Cannibalization",
  forensics: "Creative & Funnel Forensics",
  critic: "Adversarial Verifier & Critic",
  deep_dive: "Hypothesis & Counterfactual Deep-Dive",
  optimizer: "Optimization & Portfolio Solver",
  orchestrator: "Orchestrator Synthesis",
};

const TREE: Node[] = [
  { id: "router", label: AGENT_LABEL.router, badge: "START" },
  { id: "planner", label: AGENT_LABEL.planner },
  { id: "ingestion", label: AGENT_LABEL.ingestion },
  {
    id: "fanout",
    label: "Parallel Diagnostic Superstep",
    children: [
      { id: "anomaly", label: AGENT_LABEL.anomaly },
      { id: "attribution", label: AGENT_LABEL.attribution },
      { id: "forensics", label: AGENT_LABEL.forensics },
    ],
  },
  { id: "critic", label: AGENT_LABEL.critic },
  { id: "deep_dive", label: AGENT_LABEL.deep_dive, badge: "cond: reinvestigate" },
  { id: "optimizer", label: AGENT_LABEL.optimizer },
  { id: "orchestrator", label: "Synthesis & Checkpointer", badge: "END" },
];

function Indicator({ status }: { status: AgentStatus }) {
  if (status === "running") return <Loader2 size={12} className="animate-spin text-iris-11" />;
  if (status === "done") return <Check size={12} className="text-jade-11" strokeWidth={2.5} />;
  return <span className="block h-2 w-2 border border-slate-8" />;
}

function groupStatus(ids: string[], agents: Record<string, AgentStatus>): AgentStatus {
  const s = ids.map((i) => agents[i] ?? "pending");
  if (s.some((x) => x === "running")) return "running";
  return s.every((x) => x === "done") ? "done" : "pending";
}

function TreeRow({ node, depth }: { node: Node; depth: number }) {
  const { agents, run } = useDeepAgent();
  const status = node.children ? groupStatus(node.children.map((c) => c.id), agents) : (agents[node.id] ?? "pending");
  const checkpoint = run?.graph_meta?.checkpoints?.find((cp) => cp.node === node.id);

  return (
    <li>
      <div
        className={cn("flex items-center gap-2 py-1 text-xs", status === "running" ? "text-iris-11" : status === "done" ? "text-slate-12" : "text-slate-10")}
        style={{ paddingLeft: depth * 16 }}
        data-testid={`subagent-node-${node.id}`}
      >
        <span className="font-mono text-slate-8">{depth ? "└" : "├"}</span>
        <Indicator status={status} />
        <span className={cn("truncate", node.children && "font-mono text-[10px] uppercase tracking-wider")}>{node.label}</span>
        {node.badge && <span className="ml-auto border border-slate-6 bg-slate-2 px-1 font-mono text-[9px] text-slate-11">{node.badge}</span>}
        {!node.badge && checkpoint && <span className="num ml-auto text-[10px] text-slate-10">{checkpoint.duration_ms}ms</span>}
      </div>
      {node.children && (
        <ul>
          {node.children.map((c) => (
            <TreeRow key={c.id} node={c} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function SubAgentTree() {
  const { run } = useDeepAgent();
  const engine = run?.graph_meta?.engine ?? "StateGraph";
  return (
    <div className="border-b border-slate-6 px-4 py-3" data-testid="subagent-tree">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="eyebrow flex items-center gap-1.5">
          <GitBranch size={11} className="text-iris-11" /> LangGraph · sub-agent DAG
        </p>
        <span className="num text-[10px] text-slate-10">{engine}</span>
      </div>
      <ul>
        {TREE.map((n) => (
          <TreeRow key={n.id} node={n} depth={0} />
        ))}
      </ul>
    </div>
  );
}
