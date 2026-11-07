import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAccounts, useConnectors } from "../../hooks/queries";
import { api } from "../../lib/api";
import { PLATFORM_LABEL } from "../../lib/format";
import type { Platform } from "../../types";
import { PlatformLogo } from "../common/PlatformLogo";
import { ReadOnlyBadge } from "./WelcomeSteps";

function Candidates({ provider, onDone }: { provider: Platform; onDone: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ["candidates", provider], queryFn: () => api.connectorCandidates(provider) });
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const connect = async () => {
    setBusy(true);
    try {
      const r = await api.wizardConnect(provider, picked);
      toast.success(`${PLATFORM_LABEL[provider]} linked read-only · ${r.backfilled_rows} rows synced`);
      ["connectors", "accounts", "pulse", "breakdown", "opportunities", "reach", "candidates"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onDone();
    } catch {
      toast.error("Could not link that account");
    } finally {
      setBusy(false);
    }
  };
  if (isLoading || !data) return <div className="h-20 animate-pulse bg-slate-3" />;
  return (
    <div className="space-y-2 border-t border-slate-6 pt-3" data-testid={`candidates-${provider}`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-10">Permissions asked: {data.scopes.join(" · ")}</p>
      {data.candidates.map((c) => {
        const on = picked.includes(c.account_id) || c.already_linked;
        return (
          <button key={c.account_id} type="button" disabled={c.already_linked} onClick={() => setPicked((p) => (p.includes(c.account_id) ? p.filter((x) => x !== c.account_id) : [...p, c.account_id]))}
            className="flex w-full items-center justify-between border border-slate-6 bg-white px-3 py-2 text-left text-[13px] transition-colors hover:border-slate-12 disabled:cursor-default disabled:bg-slate-2" data-testid={`candidate-${c.account_id}`}>
            <span><span className="block font-medium">{c.name}</span><span className="num block text-[11px] text-slate-10">{c.account_id} · {c.currency}</span></span>
            <span className={`flex h-5 w-5 items-center justify-center border ${on ? "border-jade-9 bg-jade-9 text-white" : "border-slate-8"}`}>{on && <Check size={12} />}</span>
          </button>
        );
      })}
      <button type="button" className="btn-accent mt-1 h-9 w-full" disabled={!picked.length || busy} onClick={connect} data-testid={`connect-${provider}-button`}>
        {busy ? <Loader2 size={13} className="animate-spin" /> : null} Link {picked.length || ""} account{picked.length === 1 ? "" : "s"} read-only
      </button>
    </div>
  );
}

export function ConnectStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { data: connectors } = useConnectors();
  const { data: accounts } = useAccounts();
  const [open, setOpen] = useState<Platform | null>(null);
  const linked = (p: Platform) => accounts?.accounts.filter((a) => a.platform === p) ?? [];
  const startOAuth = async (p: Platform) => {
    try {
      window.location.href = await api.oauthStart(p);
    } catch {
      toast.error("Live sign-in is not available yet");
    }
  };
  return (
    <div className="space-y-6" data-testid="connect-step">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-[30px] font-medium leading-tight">Connect your ad accounts</h2>
          <p className="mt-1.5 max-w-xl text-[14px] text-slate-11">We only read reports. A sample workspace is already loaded, so you can continue now and link more accounts any time.</p>
        </div>
        <ReadOnlyBadge />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(connectors ?? []).map((c) => {
          const acc = linked(c.provider);
          return (
            <div key={c.provider} className="tile-select p-4" data-selected={open === c.provider} data-testid={`connect-tile-${c.provider}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center border border-slate-6 bg-white"><PlatformLogo platform={c.provider} size={20} /></span>
                  <span>
                    <span className="block text-[15px] font-semibold">{c.name}</span>
                    <span className="block text-[12px] text-slate-10">{acc.length ? `${acc.length} account${acc.length > 1 ? "s" : ""} ready` : "Not linked"}</span>
                  </span>
                </span>
                {c.oauth_configured ? (
                  <button type="button" className="btn-primary h-8 px-3 text-[11px]" onClick={() => startOAuth(c.provider)} data-testid={`oauth-${c.provider}-button`}>Sign in</button>
                ) : (
                  <button type="button" className="btn-ghost h-8 px-3 text-[11px]" onClick={() => setOpen(open === c.provider ? null : c.provider)} data-testid={`expand-${c.provider}-button`}>{open === c.provider ? "Close" : "Add account"}</button>
                )}
              </div>
              {acc.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">{acc.map((a) => <span key={a.account_id} className="inline-flex items-center gap-1 border border-jade-7 bg-white px-2 py-0.5 text-[11px] text-jade-11"><Check size={10} />{a.name}</span>)}</div>
              )}
              {open === c.provider && <div className="mt-3"><Candidates provider={c.provider} onDone={() => setOpen(null)} /></div>}
            </div>
          );
        })}
      </div>
      <p className="text-[12px] text-slate-10" data-testid="connect-demo-note">Live sign-in turns on per platform once its developer app keys are added. Until then, “Add account” links demo accounts filled with realistic sample data.</p>
      <div className="flex justify-between">
        <button type="button" className="btn-ghost h-11 px-5" onClick={onBack} data-testid="connect-back-button">Back</button>
        <button type="button" className="btn-primary h-11 px-6" onClick={onNext} data-testid="connect-continue-button">Run my first audit <ArrowRight size={14} /></button>
      </div>
    </div>
  );
}
