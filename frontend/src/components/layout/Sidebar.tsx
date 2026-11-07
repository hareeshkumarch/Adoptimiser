import { useState } from "react";
import { NavLink } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { Activity, Bot, Compass, Lightbulb, Menu, Plug, Radar, Stethoscope, Table2, TrendingUp, X } from "lucide-react";
import { cn } from "../../lib/cn";

const START = [
  { to: "/insights", label: "Smart suggestions", icon: Lightbulb },
  { to: "/reach", label: "Reach & frequency", icon: Radar },
];
const NAV = [
  { to: "/overview", label: "Overview", icon: Activity },
  { to: "/diagnostics", label: "Diagnostics", icon: Stethoscope },
  { to: "/optimizations", label: "Optimizations", icon: TrendingUp },
  { to: "/drilldown", label: "Campaign explorer", icon: Table2 },
];
const WORKSPACE = [
  { to: "/agent", label: "Agent workspace", icon: Bot },
  { to: "/connections", label: "Connections", icon: Plug },
];

const LINK = "sidebar-link relative flex items-center gap-3.5 py-3 pl-4 pr-3 text-[13px] transition-colors duration-150 focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4";
const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(LINK, isActive ? "font-medium text-slate-12" : "text-slate-10 hover:text-slate-12");

function NavigationLinks({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  return (
    <>
      <p className="eyebrow px-4 pb-2.5">Start here</p>
      {START.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} onClick={onNavigate} className={linkClass} data-testid={`${mobile ? "mobile-" : ""}nav-${to.slice(1)}`}>
          <Icon size={16} strokeWidth={1.75} />
          {label}
        </NavLink>
      ))}
      <p className="eyebrow px-4 pb-2.5 pt-7">Analyze</p>
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={linkClass}
          data-testid={`${mobile ? "mobile-" : ""}nav-${to.slice(1)}`}
        >
          <Icon size={16} strokeWidth={1.75} />
          {label}
        </NavLink>
      ))}
      <p className="eyebrow px-4 pb-2.5 pt-7">Workspace</p>
      <NavLink to="/welcome" onClick={onNavigate} className={linkClass} data-testid={`${mobile ? "mobile-" : ""}nav-welcome`}>
        <Compass size={16} strokeWidth={1.75} />
        Change goal
      </NavLink>
      {WORKSPACE.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={linkClass}
          data-testid={`${mobile ? "mobile-" : ""}nav-${to.slice(1)}`}
        >
          <Icon size={16} strokeWidth={1.75} />
          {label}
        </NavLink>
      ))}
    </>
  );
}

export function MobileNavDrawer() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className="btn-ghost px-2 py-1.5 md:hidden" aria-label="Open navigation menu" data-testid="mobile-nav-trigger">
          <Menu size={15} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-12/25 md:hidden" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 flex w-64 max-w-[82vw] flex-col overflow-y-auto border-r border-slate-5 bg-white px-4 py-6 focus:outline-none md:hidden"
          data-testid="mobile-nav-drawer"
        >
          <div className="mb-5 flex items-center justify-between px-2">
            <Dialog.Title className="font-serif text-base font-medium text-slate-12">Navigation</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="btn-ghost px-1.5 py-1" aria-label="Close navigation menu" data-testid="mobile-nav-close">
                <X size={14} />
              </button>
            </Dialog.Close>
          </div>
          <NavigationLinks mobile onNavigate={() => setOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Sidebar() {
  return (
    <nav className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 flex-col overflow-y-auto border-r border-slate-4 bg-white px-4 py-7 scrollbar-thin md:flex" aria-label="Primary navigation" data-testid="sidebar-nav">
      <NavigationLinks />
    </nav>
  );
}
