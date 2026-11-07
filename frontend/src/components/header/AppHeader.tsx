import { Link } from "react-router-dom";
import { Loader2, Play } from "lucide-react";
import { DEFAULT_QUERY, useDeepAgent } from "../../state/deepAgent";
import { StatusPill } from "../common/StatusPill";
import { MobileNavDrawer } from "../layout/Sidebar";
import { AccountSwitcher } from "./AccountSwitcher";

function AgentStatusLink() {
  const { status, run } = useDeepAgent();
  const label = status === "running" ? "Agent investigating" : run ? `Last run ${new Date(run.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "No runs";
  return (
    <Link to="/agent" className="hidden items-center gap-2 text-xs text-slate-11 transition-colors hover:text-slate-12 lg:flex" data-testid="header-agent-status">
      <StatusPill tone={status === "running" ? "iris" : status === "failed" ? "ruby" : "jade"}>{status === "running" ? "live" : status === "failed" ? "failed" : "ready"}</StatusPill>
      {label}
    </Link>
  );
}

export function AppHeader() {
  const { status, start } = useDeepAgent();
  const running = status === "running";
  return (
    <header className="sticky top-0 z-30 flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-slate-6 bg-slate-1 px-3 py-1.5 sm:px-6" data-testid="app-header">
      <div className="flex items-center gap-2.5">
        <MobileNavDrawer />
        <Link to="/" className="flex items-center gap-3" data-testid="brand-home-link">
          <span className="flex h-7 w-7 items-center justify-center bg-slate-12 font-mono text-xs font-semibold text-slate-1">Q</span>
          <span className="leading-tight">
            <span className="block font-serif text-lg font-medium tracking-tight">Quorum</span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-slate-11 sm:block">Ad intelligence</span>
          </span>
        </Link>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <AgentStatusLink />
        <AccountSwitcher />
        <button className="btn-primary px-2.5 sm:px-3.5" onClick={() => start(DEFAULT_QUERY)} disabled={running} data-testid="run-deep-agent-button">
          {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
          <span className="hidden sm:inline">{running ? "Investigating…" : "Run deep agent"}</span>
          <span className="sm:hidden">{running ? "Run…" : "Run"}</span>
        </button>
      </div>
    </header>
  );
}
