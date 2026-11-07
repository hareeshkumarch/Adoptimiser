import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { FlowStepBar } from "../components/common/FlowStepBar";
import { ConnectorCard } from "../components/connections/ConnectorCard";
import { useConnectors } from "../hooks/queries";
import { api } from "../lib/api";

const STEPS = [
  "Click Connect — you are redirected to the platform's own consent screen.",
  "Approve read-only reporting scopes. No write permission is ever requested.",
  "Every ad account you can access is discovered and linked once — an account already linked through another login is skipped, so spend is never double counted.",
];

function useOAuthReturnToast() {
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const connector = params.get("connector");
    if (!connector) return;
    if (params.get("status") === "connected") toast.success(`${connector} connected with read-only scopes`);
    else toast.error(`${connector} authorization failed`);
    setParams({}, { replace: true });
  }, [params, setParams]);
}

export default function ConnectionsPage() {
  useOAuthReturnToast();
  const { data, isLoading, isError, refetch } = useConnectors();
  const qc = useQueryClient();
  const reseed = useMutation({
    mutationFn: () => api.reseedSandbox(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["connectors"] });
      qc.invalidateQueries({ queryKey: ["pulse"] });
      qc.invalidateQueries({ queryKey: ["breakdown"] });
      toast.success("Sandbox 60-day cross-channel dataset refreshed");
    },
    onError: () => toast.error("Failed to refresh sandbox dataset"),
  });

  return (
    <div className="space-y-8" data-testid="page-connections">
      <ol className="grid gap-px border border-slate-6 bg-slate-6 sm:grid-cols-3" data-testid="connect-flow-steps">
        {STEPS.map((s, i) => (
          <li key={s} className="bg-white p-5">
            <span className="num text-xs text-iris-11">{String(i + 1).padStart(2, "0")}</span>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-12">{s}</p>
          </li>
        ))}
      </ol>
      {isLoading && (
        <div className="grid gap-6 lg:grid-cols-2" role="status" aria-label="Loading ad platform connections" data-testid="connections-loading">
          {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-48 animate-pulse border border-slate-6 bg-slate-2" />)}
        </div>
      )}
      {isError && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-ruby-6 bg-ruby-2 p-4" role="alert" data-testid="connections-error">
          <p className="flex items-center gap-2 text-sm text-ruby-11"><AlertCircle size={15} /> Connection status couldn't be loaded.</p>
          <button type="button" className="btn-ghost" onClick={() => refetch()} data-testid="connections-retry-button">Try again</button>
        </div>
      )}
      {!isLoading && !isError && data?.length === 0 && (
        <div className="border border-slate-6 bg-white p-6 text-center" data-testid="connections-empty">
          <p className="text-sm font-medium text-slate-12">No platform connectors are available.</p>
          <p className="mt-1 text-xs text-slate-11">Refresh the page or check the connector service configuration.</p>
        </div>
      )}
      {!isLoading && !isError && data && data.length > 0 && <div className="grid gap-6 lg:grid-cols-2">{data.map((c) => <ConnectorCard key={c.provider} c={c} />)}</div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-6 pt-4">
        <div>
          <p className="text-sm font-medium text-slate-12">Sandbox data</p>
          <p className="mt-0.5 text-xs text-slate-11">Refresh the 60-day sample dataset used across the dashboard.</p>
        </div>
        <button type="button" className="btn-ghost" onClick={() => reseed.mutate()} disabled={reseed.isPending} data-testid="connections-reseed-button">
          <RefreshCw size={13} className={reseed.isPending ? "animate-spin" : undefined} />
          {reseed.isPending ? "Refreshing…" : "Refresh sandbox data"}
        </button>
      </div>
      <FlowStepBar
        next={{ to: "/", index: "01", label: "Executive Pulse", hint: "Return to overview" }}
      />
    </div>
  );
}
