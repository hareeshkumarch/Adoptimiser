import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AppLayout } from "./components/layout/AppLayout";
import { useWorkspace } from "./hooks/insights";
import { DeepAgentProvider } from "./state/deepAgent";
import { FiltersProvider } from "./state/filters";

const OverviewPage = lazy(() => import("./pages/OverviewPage"));
const DiagnosticsPage = lazy(() => import("./pages/DiagnosticsPage"));
const OptimizationsPage = lazy(() => import("./pages/OptimizationsPage"));
const DrilldownPage = lazy(() => import("./pages/DrilldownPage"));
const AgentPage = lazy(() => import("./pages/AgentPage"));
const ConnectionsPage = lazy(() => import("./pages/ConnectionsPage"));
const InsightsPage = lazy(() => import("./pages/InsightsPage"));
const ReachPage = lazy(() => import("./pages/ReachPage"));
const WelcomePage = lazy(() => import("./pages/WelcomePage"));

function OnboardingGate({ children }: { children: ReactNode }) {
  const { data, isLoading } = useWorkspace();
  const { pathname } = useLocation();
  if (isLoading) return <div className="min-h-screen bg-slate-2" data-testid="app-booting" />;
  if (data && !data.onboarded && !pathname.startsWith("/connections")) return <Navigate to="/welcome" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <FiltersProvider>
        <DeepAgentProvider>
          <Routes>
            <Route path="welcome" element={<Suspense fallback={null}><WelcomePage /></Suspense>} />
            <Route element={<OnboardingGate><AppLayout /></OnboardingGate>}>
              <Route index element={<Navigate to="/insights" replace />} />
              <Route path="insights" element={<InsightsPage />} />
              <Route path="overview" element={<OverviewPage />} />
              <Route path="reach" element={<ReachPage />} />
              <Route path="diagnostics" element={<DiagnosticsPage />} />
              <Route path="optimizations" element={<OptimizationsPage />} />
              <Route path="drilldown" element={<DrilldownPage />} />
              <Route path="agent" element={<AgentPage />} />
              <Route path="connections" element={<ConnectionsPage />} />
              <Route path="*" element={<Navigate to="/insights" replace />} />
            </Route>
          </Routes>
          <Toaster position="bottom-right" toastOptions={{ className: "!rounded-none !border !border-slate-12 !font-sans !text-xs" }} />
        </DeepAgentProvider>
      </FiltersProvider>
    </BrowserRouter>
  );
}
