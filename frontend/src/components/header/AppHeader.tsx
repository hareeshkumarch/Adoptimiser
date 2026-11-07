import { Link } from "react-router-dom";
import { Activity, Loader2, Play } from "lucide-react";
import { DEFAULT_QUERY, useDeepAgent } from "../../state/deepAgent";
import { MobileNavDrawer } from "../layout/Sidebar";
import { AccountSwitcher } from "./AccountSwitcher";

function AgentStatusLink() {
  const { status, run } = useDeepAgent();
  if (status !== "starting" && status !== "running" && status !== "failed" && !run) return null;
  const lastRun = run
    ? `Last run ${new Date(run.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : "No recent investigation";
  const label = status === "starting" ? "Starting investigation" : status === "running" ? "Investigation running" : status === "failed" ? "Last investigation failed" : lastRun;
  return (
    <Link to="/agent" className="hidden items-center gap-2 text-xs text-slate-10 transition-colors hover:text-slate-12 lg:flex" data-testid="header-agent-status">
      <Activity size={14} className={status === "running" || status === "starting" ? "text-jade-9" : status === "failed" ? "text-ruby-9" : "text-slate-9"} />
      {label}
    </Link>
  );
}

export function AppHeader() {
  const { status, start } = useDeepAgent();
  const busy = status === "loading" || status === "starting" || status === "running";
  const actionLabel = status === "loading" ? "Preparing…" : status === "starting" ? "Starting…" : status === "running" ? "Investigating…" : "Run full audit";
  return (
    <header className="sticky top-0 z-30 flex min-h-16 flex-wrap items-center justify-between gap-1 border-b border-slate-5 bg-white/95 px-3 py-2 backdrop-blur-sm sm:gap-3 sm:px-6" data-testid="app-header">
      <div className="flex items-center gap-2.5">
        <MobileNavDrawer />
        <Link to="/" className="flex items-center gap-3" aria-label="Quorum home" data-testid="brand-home-link">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-12 font-serif text-lg font-medium text-white">Q</span>
          <span className="hidden leading-tight min-[420px]:block">
            <span className="block font-serif text-[20px] font-medium tracking-tight">Quorum</span>
            <span className="hidden font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-slate-10 sm:block">Ad intelligence</span>
          </span>
        </Link>
      </div>
      <div className="flex items-center gap-1 sm:gap-4">
        <AgentStatusLink />
        <AccountSwitcher />
        <button type="button" className="btn-primary px-2.5 sm:px-3.5" onClick={() => start(DEFAULT_QUERY)} disabled={busy} data-testid="run-deep-agent-button">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
          <span className="hidden sm:inline">{actionLabel}</span>
          <span className="sm:hidden">{busy ? "Working…" : "Run"}</span>
        </button>
      </div>
    </header>
  );
}
