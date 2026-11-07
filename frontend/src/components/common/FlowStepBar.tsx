import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

interface StepLink {
  to: string;
  index: string;
  label: string;
  hint: string;
}

interface Props {
  next?: StepLink;
  summary?: string;
}

export function FlowStepBar({ next, summary }: Props) {
  if (!next && !summary) return null;
  return (
    <nav className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-6 pt-5" aria-label="Continue workflow" data-testid="flow-step-bar">
      {summary ? <p className="max-w-2xl text-xs leading-relaxed text-slate-10">{summary}</p> : <span />}
      {next && (
        <Link to={next.to} className="group inline-flex items-center gap-3 text-left" data-testid={`flow-next-${next.index}`}>
          <span>
            <span className="eyebrow block">Continue to</span>
            <span className="mt-0.5 block text-sm font-medium text-slate-12 group-hover:text-iris-11">{next.label}</span>
            <span className="mt-0.5 block text-xs text-slate-10">{next.hint}</span>
          </span>
          <ArrowRight size={16} className="text-slate-9 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </nav>
  );
}
