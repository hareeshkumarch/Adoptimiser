import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AppHeader } from "../header/AppHeader";
import { FilterBar } from "../header/FilterBar";
import { PageHeading } from "../common/PageHeading";
import { LiveProgressBanner } from "./LiveProgressBanner";
import { RunScopeNotice } from "./RunScopeNotice";
import { Sidebar } from "./Sidebar";

const FILTERED = new Set(["/overview", "/diagnostics", "/drilldown"]);
const PAGE_COPY: Record<string, { eyebrow: string; title: string; description: string }> = {
  "/insights": {
    eyebrow: "Start here",
    title: "Smart suggestions",
    description: "Ranked, money-first actions found in your accounts. Ask Copilot how to do any of them, or send the agent for a deep dive.",
  },
  "/reach": {
    eyebrow: "Audience health",
    title: "Reach & frequency",
    description: "How many people you reach, how often they see you, and where audiences are getting tired.",
  },
  "/overview": {
    eyebrow: "Cross-channel performance",
    title: "Overview",
    description: "Spend, returns, and the changes shaping performance across your ad accounts.",
  },
  "/diagnostics": {
    eyebrow: "Root-cause review",
    title: "Diagnostics",
    description: "Verified findings with evidence behind the changes in your results.",
  },
  "/optimizations": {
    eyebrow: "Action planning",
    title: "Optimizations",
    description: "Compare high-impact opportunities and shape a plan before acting in an ad platform.",
  },
  "/drilldown": {
    eyebrow: "Campaign analysis",
    title: "Campaign explorer",
    description: "Move from platform totals to campaigns, ad sets, and individual creatives.",
  },
  "/agent": {
    eyebrow: "Investigation workspace",
    title: "Deep agent",
    description: "Run a focused investigation and review its findings, evidence, and reasoning trace.",
  },
  "/connections": {
    eyebrow: "Data sources",
    title: "Connections",
    description: "Manage read-only access to ad platforms and explore the included sandbox data.",
  },
};

const PageFallback = () => <div className="h-64 animate-pulse border border-slate-6 bg-white" data-testid="page-loading" />;

export function AppLayout() {
  const { pathname } = useLocation();
  const page = PAGE_COPY[pathname] ?? PAGE_COPY["/insights"];
  return (
    <div className="flex min-h-screen flex-col bg-slate-2">
      <a href="#main-content" className="sr-only fixed left-3 top-3 z-50 bg-white px-3 py-2 text-sm text-slate-12 focus:not-sr-only focus:outline focus:outline-2 focus:outline-jade-8">
        Skip to content
      </a>
      <AppHeader />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <div className="min-w-0 flex-1 bg-slate-1">
          <LiveProgressBanner />
          <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1480px] px-4 py-7 outline-none sm:px-6 sm:py-8 xl:px-10">
            <PageHeading {...page} />
            {FILTERED.has(pathname) && <FilterBar showBreakdown={pathname === "/drilldown"} />}
            {!["/connections", "/insights", "/reach"].includes(pathname) && <RunScopeNotice />}
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  );
}
