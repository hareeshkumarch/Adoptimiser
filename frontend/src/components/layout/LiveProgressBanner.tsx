import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { useDeepAgent } from "../../state/deepAgent";

export function LiveProgressBanner() {
  const { status, progress } = useDeepAgent();
  if (status !== "starting" && status !== "running" && status !== "failed") return null;

  const isStarting = status === "starting";
  const isRunning = status === "running";
  const isFailed = status === "failed";
  return (
    <div className={`border-b px-4 py-2.5 sm:px-6 ${isFailed ? "border-ruby-6 bg-ruby-2" : "border-iris-6 bg-iris-2"}`} role={isFailed ? "alert" : "status"} aria-live="polite" data-testid="live-progress-banner">
      <div className="mx-auto flex max-w-[1480px] flex-wrap items-center gap-x-3 gap-y-2">
        {isFailed ? <AlertCircle size={15} className="text-ruby-11" /> : <Loader2 size={15} className="animate-spin text-iris-11" />}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-12" data-testid="live-progress-stage">
            {isStarting ? "Preparing your investigation…" : isRunning ? progress.stageLabel : "The investigation could not be completed."}
          </p>
          {isRunning && progress.activeTool && <p className="mt-0.5 truncate text-[11px] text-slate-10">Working on {progress.activeTool}</p>}
        </div>
        {isRunning && <span className="num text-xs text-slate-11" data-testid="live-progress-pct">{progress.percentage}%</span>}
        <Link to="/agent" className="inline-flex items-center gap-1 text-xs font-medium text-slate-12 hover:text-iris-11" data-testid="live-progress-details">
          View investigation <ArrowRight size={13} />
        </Link>
      </div>
      {isRunning && (
        <div
          className="mx-auto mt-2 h-0.5 max-w-[1480px] bg-iris-4"
          role="progressbar"
          aria-label="Investigation progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.percentage}
        >
          <div className="h-full bg-iris-9 transition-all duration-300" style={{ width: `${progress.percentage}%` }} />
        </div>
      )}
    </div>
  );
}
