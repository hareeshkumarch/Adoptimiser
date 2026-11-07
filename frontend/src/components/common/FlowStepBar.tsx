import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, GitBranch } from "lucide-react";

interface StepLink {
  to: string;
  index: string;
  label: string;
  hint: string;
}

interface Props {
  prev?: StepLink;
  next?: StepLink;
  summary?: string;
}

export function FlowStepBar({ prev, next, summary }: Props) {
  return (
    <nav className="mt-10 flex flex-wrap items-center justify-between gap-4 border border-slate-6 bg-white px-5 py-3.5" data-testid="flow-step-bar">
      <div className="flex items-center gap-3">
        {prev ? (
          <Link to={prev.to} className="btn-ghost" data-testid={`flow-prev-${prev.index}`}>
            <ArrowLeft size={12} />
            <span className="num text-[10px] text-slate-10">{prev.index}</span>
            <span>{prev.label}</span>
          </Link>
        ) : (
          <span className="eyebrow">Step 01 · Workflow Entry</span>
        )}
        {summary && <span className="hidden text-xs text-slate-11 md:inline">{summary}</span>}
      </div>
      <div className="flex items-center gap-2.5">
        <Link to="/agent" className="btn-ghost" data-testid="flow-inspect-graph">
          <GitBranch size={12} className="text-iris-11" /> Inspect LangGraph Trace
        </Link>
        {next && (
          <Link to={next.to} className="btn-primary" data-testid={`flow-next-${next.index}`}>
            <span className="num text-[10px] opacity-80">{next.index}</span>
            <span>{next.label}</span>
            <span className="hidden font-mono text-[10px] opacity-75 sm:inline">· {next.hint}</span>
            <ArrowRight size={12} />
          </Link>
        )}
      </div>
    </nav>
  );
}
