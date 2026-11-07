import { useState } from "react";
import { useDeepAgent } from "../../state/deepAgent";
import { StatusPill } from "../common/StatusPill";
import { AGENT_LABEL } from "./SubAgentTree";

interface CanvasNode {
  id: string;
  short: string;
  x: number;
  y: number;
  role: string;
}

const NODES: CanvasNode[] = [
  { id: "router", short: "00 Router", x: 250, y: 20, role: "Intent & Scope" },
  { id: "planner", short: "01 Planner", x: 250, y: 78, role: "write_todos" },
  { id: "ingestion", short: "02 Ingestion", x: 250, y: 136, role: "60d FX + Window" },
  { id: "anomaly", short: "03a Anomaly", x: 70, y: 202, role: "MAD Z + Spikes" },
  { id: "attribution", short: "03b Attribution", x: 250, y: 202, role: "MER + Lagged r" },
  { id: "forensics", short: "03c Forensics", x: 430, y: 202, role: "5-Stage Funnel" },
  { id: "critic", short: "04 Critic", x: 250, y: 268, role: "Falsification" },
  { id: "deep_dive", short: "05 Deep-Dive", x: 145, y: 334, role: "cond: reinvestigate" },
  { id: "optimizer", short: "06 Optimizer", x: 355, y: 334, role: "MMM + Prescriptions" },
  { id: "orchestrator", short: "07 Synthesizer", x: 250, y: 396, role: "Stream + Checkpoint" },
];

const EDGES: { from: string; to: string; dashed?: boolean }[] = [
  { from: "router", to: "planner" },
  { from: "planner", to: "ingestion" },
  { from: "ingestion", to: "anomaly" },
  { from: "ingestion", to: "attribution" },
  { from: "ingestion", to: "forensics" },
  { from: "anomaly", to: "critic" },
  { from: "attribution", to: "critic" },
  { from: "forensics", to: "critic" },
  { from: "critic", to: "deep_dive", dashed: true },
  { from: "critic", to: "optimizer", dashed: true },
  { from: "deep_dive", to: "optimizer" },
  { from: "optimizer", to: "orchestrator" },
];

export function LangGraphCanvas() {
  const { agents, run } = useDeepAgent();
  const [selectedNode, setSelectedNode] = useState<string>("critic");
  const checkpoints = run?.graph_meta?.checkpoints ?? [];
  const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));
  const selectedCp = checkpoints.find((cp) => cp.node === selectedNode);

  return (
    <div className="border border-slate-6 bg-white p-4" data-testid="langgraph-svg-canvas">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-6 pb-2">
        <div>
          <p className="eyebrow">Interactive StateGraph Topology Canvas</p>
          <p className="text-[11px] text-slate-11">Click any node in the DAG to inspect its checkpoint state and execution latency.</p>
        </div>
        <StatusPill tone="iris">10 nodes · 12 edges</StatusPill>
      </div>

      <div className="overflow-x-auto bg-slate-1 p-2">
        <svg viewBox="0 0 620 445" className="mx-auto h-[380px] w-full max-w-[620px]">
          {EDGES.map((e, i) => {
            const a = byId[e.from];
            const b = byId[e.to];
            return (
              <line
                key={i}
                x1={a.x + 60}
                y1={a.y + 38}
                x2={b.x + 60}
                y2={b.y}
                stroke={e.dashed ? "#4f46e5" : "#94a3b8"}
                strokeWidth={1.5}
                strokeDasharray={e.dashed ? "4 3" : undefined}
              />
            );
          })}

          {NODES.map((n) => {
            const st = agents[n.id] ?? (checkpoints.some((c) => c.node === n.id) ? "done" : "pending");
            const cp = checkpoints.find((c) => c.node === n.id);
            const active = selectedNode === n.id;
            const stroke = active ? "#4f46e5" : st === "running" ? "#4f46e5" : st === "done" ? "#047857" : "#cbd5e1";
            const bg = active ? "#eef2ff" : "#ffffff";
            return (
              <g key={n.id} className="cursor-pointer" onClick={() => setSelectedNode(n.id)} data-testid={`dag-canvas-node-${n.id}`}>
                <rect x={n.x} y={n.y} width={120} height={38} fill={bg} stroke={stroke} strokeWidth={active ? 2 : 1.25} />
                <text x={n.x + 8} y={n.y + 15} className="font-mono text-[10px] font-semibold fill-slate-12">
                  {n.short}
                </text>
                <text x={n.x + 8} y={n.y + 29} className="font-mono text-[9px] fill-slate-10">
                  {cp ? `${cp.duration_ms}ms · ${n.role}` : n.role}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-6 pt-3 font-mono text-xs" data-testid="dag-selected-node-detail">
        <span className="text-slate-12">
          Selected: <strong>{AGENT_LABEL[selectedNode] ?? selectedNode}</strong>
        </span>
        <span className="text-slate-11">
          {selectedCp ? `Step #${selectedCp.step} · ${selectedCp.duration_ms}ms · Output: ${JSON.stringify(selectedCp.summary ?? {})}` : "Awaiting execution"}
        </span>
      </div>
    </div>
  );
}
