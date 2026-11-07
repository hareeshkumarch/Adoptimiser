import { useState } from "react";
import { NavLink } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { Activity, Bot, Menu, Plug, Stethoscope, Table2, TrendingUp, X } from "lucide-react";
import { cn } from "../../lib/cn";
import { useDeepAgent } from "../../state/deepAgent";

const NAV = [
  { to: "/", label: "What is happening", icon: Activity, index: "01" },
  { to: "/diagnostics", label: "Where it goes wrong", icon: Stethoscope, index: "02" },
  { to: "/optimizations", label: "What to optimize", icon: TrendingUp, index: "03" },
  { to: "/drilldown", label: "Drilldown", icon: Table2, index: "04" },
];
const SYSTEM = [
  { to: "/agent", label: "Agent workspace", icon: Bot },
  { to: "/connections", label: "Connections", icon: Plug },
];

const LINK = "group flex items-center gap-3 px-3 py-2 text-[13px] transition-colors duration-150";
const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(LINK, isActive ? "bg-white text-slate-12 shadow-[inset_2px_0_0_var(--iris-9)]" : "text-slate-11 hover:bg-slate-3 hover:text-slate-12");

function AgentBadge() {
  const { status, run } = useDeepAgent();
  if (status === "running") return <span className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-iris-9" />;
  return run ? <span className="num ml-auto text-[10px] text-slate-10">{run.findings.length}</span> : null;
}

export function MobileNavDrawer() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="btn-ghost px-2 py-1.5 md:hidden"
          aria-label="Open navigation menu"
          data-testid="mobile-nav-trigger"
        >
          <Menu size={15} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-12/25 md:hidden" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 flex w-64 max-w-[82vw] flex-col border-r border-slate-6 bg-slate-2 px-3 py-5 focus:outline-none md:hidden"
          data-testid="mobile-nav-drawer"
        >
          <div className="mb-4 flex items-center justify-between px-3">
            <Dialog.Title className="font-serif text-base font-medium text-slate-12">Quorum Navigation</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="btn-ghost px-1.5 py-1" aria-label="Close navigation menu" data-testid="mobile-nav-close">
                <X size={14} />
              </button>
            </Dialog.Close>
          </div>
          <p className="eyebrow px-3 pb-2">Intelligence</p>
          {NAV.map(({ to, label, icon: Icon, index }) => (
            <NavLink key={to} to={to} end={to === "/"} onClick={() => setOpen(false)} className={linkClass} data-testid={`mobile-nav-${to === "/" ? "overview" : to.slice(1)}`}>
              <span className="num w-5 text-[10px] text-slate-10">{index}</span>
              <Icon size={14} strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
          <p className="eyebrow px-3 pb-2 pt-6">System</p>
          {SYSTEM.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)} className={linkClass} data-testid={`mobile-nav-${to.slice(1)}`}>
              <span className="w-5" />
              <Icon size={14} strokeWidth={1.75} />
              {label}
              {to === "/agent" && <AgentBadge />}
            </NavLink>
          ))}
          <p className="mt-auto px-3 font-mono text-[10px] leading-relaxed text-slate-10">
            Read-only. No campaign, budget or creative write access is ever requested.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Sidebar() {
  return (
    <nav className="hidden w-60 shrink-0 flex-col border-r border-slate-6 bg-slate-2 px-3 py-6 md:flex" data-testid="sidebar-nav">
      <p className="eyebrow px-3 pb-2">Intelligence</p>
      {NAV.map(({ to, label, icon: Icon, index }) => (
        <NavLink key={to} to={to} end={to === "/"} className={linkClass} data-testid={`nav-${to === "/" ? "overview" : to.slice(1)}`}>
          <span className="num w-5 text-[10px] text-slate-10">{index}</span>
          <Icon size={14} strokeWidth={1.75} />
          {label}
        </NavLink>
      ))}
      <p className="eyebrow px-3 pb-2 pt-8">System</p>
      {SYSTEM.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} className={linkClass} data-testid={`nav-${to.slice(1)}`}>
          <span className="w-5" />
          <Icon size={14} strokeWidth={1.75} />
          {label}
          {to === "/agent" && <AgentBadge />}
        </NavLink>
      ))}
      <p className="mt-auto px-3 font-mono text-[10px] leading-relaxed text-slate-10">Read-only. No campaign, budget or creative write access is ever requested.</p>
    </nav>
  );
}
