import { lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AppLayout } from "./components/layout/AppLayout";
import { DeepAgentProvider } from "./state/deepAgent";
import { FiltersProvider } from "./state/filters";

const OverviewPage = lazy(() => import("./pages/OverviewPage"));
const DiagnosticsPage = lazy(() => import("./pages/DiagnosticsPage"));
const OptimizationsPage = lazy(() => import("./pages/OptimizationsPage"));
const DrilldownPage = lazy(() => import("./pages/DrilldownPage"));
const AgentPage = lazy(() => import("./pages/AgentPage"));
const ConnectionsPage = lazy(() => import("./pages/ConnectionsPage"));

export default function App() {
  return (
    <BrowserRouter>
      <FiltersProvider>
        <DeepAgentProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<OverviewPage />} />
              <Route path="diagnostics" element={<DiagnosticsPage />} />
              <Route path="optimizations" element={<OptimizationsPage />} />
              <Route path="drilldown" element={<DrilldownPage />} />
              <Route path="agent" element={<AgentPage />} />
              <Route path="connections" element={<ConnectionsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
          <Toaster position="bottom-right" toastOptions={{ className: "!rounded-none !border !border-slate-6 !font-sans !text-xs" }} />
        </DeepAgentProvider>
      </FiltersProvider>
    </BrowserRouter>
  );
}
