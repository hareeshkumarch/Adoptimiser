import { useEffect, useRef } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { useDeepAgent } from "../../state/deepAgent";

const STAGES: { node: string; label: string }[] = [
  { node: "router", label: "Understanding your goal" },
  { node: "planner", label: "Planning the investigation" },
  { node: "ingestion", label: "Reading 60 days of ad data" },
  { node: "anomaly", label: "Scanning for spend leaks & spikes" },
  { node: "attribution", label: "Checking claimed vs real sales" },
  { node: "forensics", label: "Inspecting creatives & funnel" },
  { node: "critic", label: "Challenging every finding" },
  { node: "deep_dive", label: "Digging into the biggest issues" },
  { node: "optimizer", label: "Ranking actions by dollar impact" },
  { node: "orchestrator", label: "Writing your briefing" },
];

export function AuditStep({ query, onFinish }: { query: string; onFinish: () => void }) {
  const { start, status, agents, progress, narrative, run, todos } = useDeepAgent();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    start(query);
  }, [start, query]);
  const done = status === "completed" && started.current;
  const running = status === "running" || status === "starting";
  return (
    <div className="space-y-6" data-testid="audit-step">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-[30px] font-medium leading-tight">{done ? "Your first audit is ready" : "AI agents are auditing your accounts"}</h2>
          <p className="mt-1.5 text-[14px] text-slate-11">{done ? `${run?.findings.length ?? 0} verified issues and ${run?.prescriptions.length ?? 0} ranked actions found.` : "Ten specialist agents work in sequence and check each other. This takes a few seconds."}</p>
        </div>
        <p className="num text-[32px] font-medium leading-none text-jade-11" data-testid="audit-progress-pct">{Math.round(done ? 100 : progress.percentage)}%</p>
      </div>
      <div className="h-1.5 w-full bg-slate-4"><div className="h-full bg-jade-9 transition-all duration-500" style={{ width: `${done ? 100 : progress.percentage}%` }} /></div>
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <ol className="border border-slate-12 bg-white" data-testid="audit-stages">
          {STAGES.map((s, i) => {
            const st = done ? "done" : agents[s.node] ?? "pending";
            return (
              <li key={s.node} className={`flex items-center gap-3 px-4 py-2.5 text-[13px] ${i > 0 ? "border-t border-slate-5" : ""} ${st === "running" ? "bg-slate-12 text-white" : ""}`} data-testid={`audit-stage-${s.node}`}>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center border ${st === "done" ? "border-jade-9 bg-jade-9 text-white" : st === "running" ? "border-jade-8 text-jade-8" : "border-slate-7 text-slate-9"}`}>
                  {st === "done" ? <Check size={11} /> : st === "running" ? <Loader2 size={11} className="animate-spin" /> : <span className="num text-[9px]">{i + 1}</span>}
                </span>
                <span className={st === "pending" ? "text-slate-10" : ""}>{s.label}</span>
              </li>
            );
          })}
        </ol>
        <div className="space-y-4">
          <section className="min-h-[180px] border border-slate-6 bg-white p-5" data-testid="audit-narrative">
            <p className="eyebrow">Live briefing</p>
            <p className={`mt-3 whitespace-pre-line font-serif text-[17px] leading-relaxed text-slate-12 ${running && narrative ? "caret" : ""}`}>
              {narrative || (running ? "Waiting for the agents to finish their checks…" : "")}
            </p>
          </section>
          {todos.length > 0 && (
            <section className="border border-slate-6 bg-white p-5" data-testid="audit-plan">
              <p className="eyebrow">The agent's plan</p>
              <ul className="mt-3 space-y-1.5">
                {todos.slice(0, 9).map((t) => (
                  <li key={t.id} className="flex gap-2 text-[12.5px] text-slate-11"><span className={`mt-1.5 h-[6px] w-[6px] shrink-0 ${t.status === "done" ? "bg-jade-9" : t.status === "in_progress" ? "bg-amber-9" : "bg-slate-6"}`} />{t.title}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
      <div className="flex justify-end">
        <button type="button" className="btn-accent h-12 px-7 text-[13px]" disabled={!done} onClick={onFinish} data-testid="audit-finish-button">
          {done ? <>See my suggestions <ArrowRight size={15} /></> : <><Loader2 size={14} className="animate-spin" /> Working…</>}
        </button>
      </div>
    </div>
  );
}
