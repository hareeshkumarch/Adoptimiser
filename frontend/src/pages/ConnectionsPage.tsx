import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { FlowStepBar } from "../components/common/FlowStepBar";
import { SectionHeader } from "../components/common/SectionHeader";
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
  const { data, isLoading } = useConnectors();
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
    <div className="space-y-10" data-testid="page-connections">
      <SectionHeader
        index="06"
        kicker="OAuth & sandbox connectors"
        title="Data Connectors"
        aside={
          <button className="btn-ghost" onClick={() => reseed.mutate()} disabled={reseed.isPending} data-testid="connections-reseed-button">
            <RefreshCw size={12} className={reseed.isPending ? "animate-spin" : undefined} />
            {reseed.isPending ? "Refreshing…" : "Refresh 60d sandbox"}
          </button>
        }
      />
      <ol className="grid gap-px border border-slate-6 bg-slate-6 sm:grid-cols-3" data-testid="connect-flow-steps">
        {STEPS.map((s, i) => (
          <li key={s} className="bg-white p-5">
            <span className="num text-xs text-iris-11">{String(i + 1).padStart(2, "0")}</span>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-12">{s}</p>
          </li>
        ))}
      </ol>
      {isLoading && <div className="h-64 animate-pulse border border-slate-6 bg-slate-2" />}
      <div className="grid gap-6 lg:grid-cols-2">{data?.map((c) => <ConnectorCard key={c.provider} c={c} />)}</div>
      <FlowStepBar
        prev={{ to: "/agent", index: "05", label: "LangGraph Studio", hint: "Agent DAG & trace" }}
        next={{ to: "/", index: "01", label: "Executive Pulse", hint: "Return to overview" }}
      />
    </div>
  );
}
