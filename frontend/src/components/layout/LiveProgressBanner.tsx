import { Link } from "react-router-dom";
import { CheckCircle2, GitBranch, Loader2, Shield } from "lucide-react";
import { useDeepAgent } from "../../state/deepAgent";
import { StatusPill } from "../common/StatusPill";

export function LiveProgressBanner() {
  const { status, progress, run } = useDeepAgent();
  if (status === "idle" || status === "loading") return null;

  const isRunning = status === "running";
  const guard = progress.recursionGuard;

  return (
    <div className="border-b border-slate-6 bg-white px-6 py-2" data-testid="live-progress-banner">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-xs">
          {isRunning ? (
            <Loader2 size={13} className="animate-spin text-iris-11" />
          ) : (
            <CheckCircle2 size={13} className="text-jade-11" />
          )}
          <span className="font-mono text-[11px] font-medium text-slate-12" data-testid="live-progress-stage">
            {progress.stageLabel}
          </span>
          {isRunning && progress.activeTool && (
            <span className="num text-[11px] text-iris-11">→ {progress.activeTool}()</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {guard && (
            <span className="num inline-flex items-center gap-1.5 border border-slate-6 bg-slate-2 px-2 py-0.5 text-[10px] text-slate-11" data-testid="recursion-guard-badge">
              <Shield size={10} className="text-iris-11" />
              {guard.pass_label} · {guard.superstep_label} · Visits {guard.node_visits}/{guard.node_budget}
            </span>
          )}
          <StatusPill tone={isRunning ? "iris" : "jade"} testId="live-progress-pct">
            {progress.percentage}%
          </StatusPill>
          <span className="num hidden text-[11px] text-slate-11 sm:inline">
            {run?.findings.length ?? progress.findingsCount} verified · conf {Math.round(progress.confidence * 100)}%
          </span>
          <Link to="/agent" className="font-mono text-[10px] uppercase tracking-wider text-iris-11 hover:underline">
            <GitBranch size={11} className="mr-0.5 inline" /> Studio
          </Link>
        </div>
      </div>
      <div className="mx-auto mt-1.5 h-[3px] max-w-[1240px] bg-slate-4">
        <div
          className={`h-full transition-all duration-300 ${isRunning ? "bg-iris-9" : "bg-jade-9"}`}
          style={{ width: `${progress.percentage}%` }}
        />
      </div>
    </div>
  );
}
