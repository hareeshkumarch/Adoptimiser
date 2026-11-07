import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AppHeader } from "../header/AppHeader";
import { FilterBar } from "../header/FilterBar";
import { LiveProgressBanner } from "./LiveProgressBanner";
import { Sidebar } from "./Sidebar";

const FILTERED = new Set(["/", "/diagnostics", "/optimizations", "/drilldown"]);

const PageFallback = () => <div className="h-64 animate-pulse border border-slate-6 bg-slate-2" data-testid="page-loading" />;

export function AppLayout() {
  const { pathname } = useLocation();
  return (
    <div className="flex min-h-screen flex-col bg-slate-1">
      <AppHeader />
      <div className="flex flex-1">
        <Sidebar />
        <div className="min-w-0 flex-1">
          {FILTERED.has(pathname) && <FilterBar />}
          <LiveProgressBanner />
          <main className="mx-auto w-full max-w-[1240px] px-6 py-10 lg:px-10">
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  );
}
