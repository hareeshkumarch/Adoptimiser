import { useEffect, useMemo, useState } from "react";
import * as Accordion from "@radix-ui/react-accordion";
import { ChevronRight } from "lucide-react";
import { cn } from "../../lib/cn";
import { useDeepAgent } from "../../state/deepAgent";
import { StatusPill } from "../common/StatusPill";
import { AGENT_LABEL } from "./SubAgentTree";
import type { AgentEvent } from "../../types";

const HIDDEN = new Set(["narrative_delta", "todos", "run_complete", "run_failed", "agent_end", "graph_checkpoint", "agent_progress"]);

function offset(e: AgentEvent, start: string | null): string {
  if (!start || !e.ts) return "";
  const s = Math.max(0, (new Date(e.ts).getTime() - new Date(start).getTime()) / 1000);
  return `+${s.toFixed(1)}s`;
}

function EventLine({ e, start }: { e: AgentEvent; start: string | null }) {
  const body = (() => {
    switch (e.type) {
      case "tool_call":
        return (
          <>
            <span className="text-iris-11">→ {e.tool}</span>
            <span className="text-slate-10">
              (
              {Object.entries(e.args ?? {})
                .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
                .join(", ")
                .slice(0, 140)}
              )
            </span>
          </>
        );
      case "tool_result":
        return (
          <>
            <span className="text-jade-11">← {e.tool}</span> <span className="text-slate-12">{e.summary}</span> <span className="text-slate-10">{e.ms}ms</span>
          </>
        );
      case "scratchpad_write":
        return (
          <>
            <span className="text-amber-11">✎ write_file</span> <span className="text-slate-12">{e.path}</span>
          </>
        );
      case "finding_candidate":
        return (
          <>
            <span className="text-amber-11">⚑ candidate</span> <span className="text-slate-12">{e.title} — {e.headline}</span>
          </>
        );
      case "verdict":
        return (
          <>
            <StatusPill tone={e.status === "confirmed" ? "jade" : "ruby"}>{e.status}</StatusPill> <span className="text-slate-12">{e.headline}</span>{" "}
            <span className="text-slate-10">conf {Math.round((e.confidence ?? 0) * 100)}%</span>
            {e.challenge && <span className="mt-1 block font-serif text-[12px] italic leading-snug text-slate-11">“{e.challenge}”</span>}
          </>
        );
      case "graph_edge":
        return (
          <span className="text-iris-11">
            ⑂ conditional edge {e.source} → {e.target} (branch: {e.branch})
          </span>
        );
      case "fan_out":
        return <span className="text-iris-11">⇉ superstep fan-out → {(e.agents ?? []).join(" ‖ ")}</span>;
      case "fan_in":
        return <span className="text-iris-11">⇇ superstep fan-in ← {(e.agents ?? []).join(" ‖ ")}</span>;
      case "run_started":
        return <span className="text-slate-12">run started · {e.query}</span>;
      case "agent_start":
        return <span className="text-slate-11">node activated with isolated state slice</span>;
      default:
        return <span className="text-slate-11">{e.type}</span>;
    }
  })();
  return (
    <li className="grid grid-cols-[52px_1fr] gap-2 py-1 font-mono text-[11px] leading-snug" data-testid={`trace-event-${e.seq}`}>
      <span className="text-slate-10">{offset(e, start)}</span>
      <span className="break-words">{body}</span>
    </li>
  );
}

export function TraceLog() {
  const { events, agents, startedAt } = useDeepAgent();
  const groups = useMemo(() => {
    const map = new Map<string, AgentEvent[]>();
    events.filter((e) => !HIDDEN.has(e.type)).forEach((e) => map.set(e.agent, [...(map.get(e.agent) ?? []), e]));
    return Array.from(map.entries());
  }, [events]);
  const [open, setOpen] = useState<string[]>([]);
  const running = Object.entries(agents)
    .filter(([, s]) => s === "running")
    .map(([a]) => a);
  const runningKey = running.join(",");

  useEffect(() => {
    if (runningKey) setOpen((o) => Array.from(new Set([...o, ...runningKey.split(",")])));
  }, [runningKey]);

  if (!groups.length) return <p className="px-4 py-6 text-xs text-slate-11">No trace yet.</p>;
  return (
    <Accordion.Root type="multiple" value={open} onValueChange={setOpen} data-testid="trace-accordion">
      {groups.map(([agent, items]) => (
        <Accordion.Item key={agent} value={agent} className="border-b border-slate-6">
          <Accordion.Trigger className="group flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs hover:bg-slate-2" data-testid={`trace-group-${agent}`}>
            <ChevronRight size={13} className="text-slate-10 transition-transform duration-200 group-data-[state=open]:rotate-90" />
            <span className={cn("flex-1", agents[agent] === "running" ? "text-iris-11" : "text-slate-12")}>{AGENT_LABEL[agent] ?? agent}</span>
            <span className="num text-[10px] text-slate-10">{items.filter((i) => i.type === "tool_call").length} tools</span>
          </Accordion.Trigger>
          <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <ul className="border-t border-slate-4 bg-slate-2 px-4 py-2">
              {items.map((e) => (
                <EventLine key={e.seq} e={e} start={startedAt} />
              ))}
            </ul>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
