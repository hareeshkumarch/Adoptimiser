import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, FlaskConical, X } from "lucide-react";
import { api } from "../../lib/api";
import { pct } from "../../lib/format";
import { useDeepAgent } from "../../state/deepAgent";
import { useFilters } from "../../state/filters";

const Metric = ({ label, value, testId }: { label: string; value: string; testId: string }) => (
  <div className="bg-white px-4 py-3">
    <p className="font-mono text-[10px] uppercase tracking-wider text-slate-11">{label}</p>
    <p className="num mt-1 text-lg text-slate-12" data-testid={testId}>
      {value}
    </p>
  </div>
);

function Benchmark() {
  const { window } = useFilters();
  const [enabled, setEnabled] = useState(false);
  const { data, isFetching } = useQuery({ queryKey: ["benchmark", window], queryFn: () => api.benchmark(10, window), enabled, staleTime: Infinity });
  if (!enabled)
    return (
      <button className="btn-ghost" onClick={() => setEnabled(true)} data-testid="run-benchmark-button">
        <FlaskConical size={13} /> Stress-test detectors on 10 unseen sandbox seeds
      </button>
    );
  if (isFetching || !data) return <p className="num text-xs text-slate-11">Generating 10 independent 60-day datasets…</p>;
  return (
    <div data-testid="benchmark-result">
      <p className="eyebrow mb-2">Robustness · {data.seeds} unseen seeds · deterministic pipeline</p>
      <div className="grid grid-cols-4 gap-px border border-slate-6 bg-slate-6">
        <Metric label="Precision" value={pct(data.precision, 0)} testId="benchmark-precision" />
        <Metric label="Recall" value={pct(data.recall, 0)} testId="benchmark-recall" />
        <Metric label="F1" value={pct(data.f1, 0)} testId="benchmark-f1" />
        <Metric label="Traps filtered" value={pct(data.trap_filter_rate, 0)} testId="benchmark-traps" />
      </div>
      <p className="num mt-2 text-[11px] text-slate-11">
        Misses: {data.runs.flatMap((r) => r.missed).join(", ") || "none"}
      </p>
    </div>
  );
}

export function EvaluationPanel() {
  const { run } = useDeepAgent();
  const { data } = useQuery({ queryKey: ["evaluation", run?.run_id], queryFn: () => api.evaluation(run!.run_id), enabled: !!run });
  if (!data) return null;
  return (
    <section className="space-y-5 border border-slate-6 bg-slate-2 p-6" data-testid="evaluation-panel">
      <div>
        <p className="eyebrow">Detector evaluation · sandbox ground truth</p>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-11">Confirmed findings scored against the issues planted in the sandbox, including a pixel-outage trap the critic must reject.</p>
      </div>
      <div className="grid grid-cols-4 gap-px border border-slate-6 bg-slate-6">
        <Metric label="Precision" value={pct(data.precision, 0)} testId="evaluation-precision" />
        <Metric label="Recall" value={pct(data.recall, 0)} testId="evaluation-recall" />
        <Metric label="F1" value={pct(data.f1, 0)} testId="evaluation-f1" />
        <Metric label="Traps filtered" value={`${data.traps.filtered}/${data.traps.raised}`} testId="evaluation-traps" />
      </div>
      <ul className="space-y-1.5">
        {data.issues.map((i) => (
          <li key={i.kind} className="flex items-center gap-2 text-xs" data-testid={`evaluation-issue-${i.kind}`}>
            {i.detected_by ? <Check size={13} className="text-jade-11" /> : <X size={13} className="text-ruby-11" />}
            <span className="num w-44 text-slate-11">{i.kind}</span>
            <span className="text-slate-12">{i.label}</span>
          </li>
        ))}
      </ul>
      <Benchmark />
    </section>
  );
}
