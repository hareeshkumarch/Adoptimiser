import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Copy, Database, ExternalLink, Lock, Plug, Plus, RefreshCw, ShieldCheck, Unplug, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { PlatformLogo } from "../common/PlatformLogo";
import { StatusPill } from "../common/StatusPill";
import type { Connection, Connector } from "../../types";

function ConnectionRow({ c }: { c: Connection }) {
  const qc = useQueryClient();
  const disconnect = useMutation({
    mutationFn: () => api.disconnect(c.connection_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["connectors"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Connection removed");
    },
  });
  const sync = useMutation({
    mutationFn: () => api.syncConnection(c.connection_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["connectors"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["pulse"] });
      qc.invalidateQueries({ queryKey: ["breakdown"] });
      toast.success("60-day account telemetry synced and reconciled");
    },
  });

  return (
    <li className="border-t border-slate-6 py-3" data-testid={`connection-${c.connection_id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="num text-[11px] text-slate-11">
          connection {c.connection_id} · {new Date(c.connected_at).toLocaleDateString()} · <span className="text-jade-11">60d synced</span>
        </span>
        <div className="flex items-center gap-1.5">
          <button
            className="btn-ghost h-7 px-2"
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            data-testid={`connection-sync-${c.connection_id}`}
          >
            <RefreshCw size={11} className={sync.isPending ? "animate-spin" : undefined} /> Sync 60d
          </button>
          <button
            className="btn-ghost h-7 px-2"
            onClick={() => disconnect.mutate()}
            disabled={disconnect.isPending}
            data-testid={`connection-disconnect-${c.connection_id}`}
          >
            <Unplug size={12} /> Disconnect
          </button>
        </div>
      </div>
      <ul className="mt-2 space-y-1">
        {c.accounts.map((a) => (
          <li key={a.account_id} className="flex justify-between text-xs">
            <span className="text-slate-12">{a.name}</span>
            <span className="num text-slate-11">
              {a.account_id} · {a.currency ?? "—"} · active in switcher
            </span>
          </li>
        ))}
      </ul>
      {c.skipped_accounts.length > 0 && (
        <p className="mt-2 text-[11px] text-amber-11">
          {c.skipped_accounts.length} account(s) already linked through another connection were skipped to prevent double counting.
        </p>
      )}
      {c.discovery_error && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ruby-11">
          <AlertTriangle size={12} /> {c.discovery_error}
        </p>
      )}
    </li>
  );
}

function ConnectionWizardModal({ c }: { c: Connector }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const qc = useQueryClient();

  const { data: discovery } = useQuery({
    queryKey: ["connector-candidates", c.provider],
    queryFn: () => api.connectorCandidates(c.provider),
    enabled: open,
  });

  const wizardConnect = useMutation({
    mutationFn: () => api.wizardConnect(c.provider, selectedIds),
    onSuccess: (res) => {
      setStep(3);
      qc.invalidateQueries({ queryKey: ["connectors"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["pulse"] });
      qc.invalidateQueries({ queryKey: ["breakdown"] });
      toast.success(`${c.name} linked · ${res.backfilled_rows} creative-day rows backfilled`);
    },
    onError: () => toast.error("Failed to link ad account"),
  });

  const toggleId = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setStep(1);
      }}
    >
      <Dialog.Trigger asChild>
        <button className="btn-primary" data-testid={`connector-wizard-${c.provider}`}>
          {c.connections.length ? <Plus size={13} /> : <Plug size={13} />}
          {c.connections.length ? "Add account (3-step)" : "Connect Ad Account"}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-12/20" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 border border-slate-6 bg-white p-6 focus:outline-none"
          data-testid={`connector-wizard-modal-${c.provider}`}
        >
          <div className="flex items-center justify-between border-b border-slate-6 pb-3">
            <div className="flex items-center gap-2.5">
              <PlatformLogo platform={c.provider} size={18} />
              <div>
                <p className="eyebrow">Step 0{step} of 03 · Read-Only Connection Wizard</p>
                <Dialog.Title className="font-serif text-lg font-medium text-slate-12">{c.name} Account Link</Dialog.Title>
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="btn-ghost h-7 w-7 justify-center p-0" aria-label="Close">
                <X size={13} />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="sr-only">
            Three-step read-only connection wizard for {c.name}.
          </Dialog.Description>

          <div className="my-4 grid grid-cols-3 gap-px border border-slate-6 bg-slate-6 font-mono text-[10px] uppercase">
            {[
              [1, "01 · Scope Guard"],
              [2, "02 · Deduplicate"],
              [3, "03 · 60d Backfill"],
            ].map(([idx, label]) => (
              <div key={idx} className={`px-3 py-1.5 ${step === idx ? "bg-iris-2 text-iris-11 font-medium" : "bg-white text-slate-10"}`}>
                {label}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div className="border border-slate-6 bg-slate-1 p-3.5 text-xs">
                <p className="eyebrow flex items-center gap-1.5 text-jade-11">
                  <ShieldCheck size={13} /> Allowed Read-Only Reporting Scopes
                </p>
                <p className="num mt-1.5 text-slate-12">{(discovery?.scopes ?? c.scopes).join(" · ") || "reporting.read"}</p>
              </div>
              <div className="border border-slate-6 bg-slate-1 p-3.5 text-xs">
                <p className="eyebrow flex items-center gap-1.5 text-ruby-11">
                  <Lock size={13} /> Blocked Mutating Scopes (Never Requested)
                </p>
                <p className="num mt-1.5 text-slate-11 line-through">{(discovery?.forbidden_scopes ?? ["ads_management", "rw_ads"]).join(" · ")}</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                {c.oauth_configured && (
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => api.oauthStart(c.provider).then((u) => window.location.assign(u))}
                  >
                    Live OAuth Redirect <ExternalLink size={12} />
                  </button>
                )}
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    const available = (discovery?.candidates ?? []).filter((x) => !x.already_linked).map((x) => x.account_id);
                    setSelectedIds(available);
                    setStep(2);
                  }}
                  data-testid={`wizard-next-step1-${c.provider}`}
                >
                  Verify Scopes & Discover Accounts →
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-xs text-slate-11">
                Select accessible ad accounts to link. Accounts already linked under another login are automatically flagged to prevent double-counting spend.
              </p>
              <div className="space-y-2">
                {(discovery?.candidates ?? []).map((cand) => {
                  const checked = selectedIds.includes(cand.account_id);
                  return (
                    <label
                      key={cand.account_id}
                      className="flex cursor-pointer items-center justify-between border border-slate-6 bg-slate-1 px-3.5 py-2.5 text-xs hover:bg-slate-2"
                    >
                      <span className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleId(cand.account_id)}
                          className="h-3.5 w-3.5 accent-indigo-600"
                        />
                        <span>
                          <span className="block font-medium text-slate-12">{cand.name}</span>
                          <span className="num text-[11px] text-slate-10">
                            {cand.account_id} · {cand.currency}
                          </span>
                        </span>
                      </span>
                      <StatusPill tone={cand.already_linked ? "amber" : "jade"}>
                        {cand.already_linked ? "Already linked (dedupe)" : "Ready to backfill"}
                      </StatusPill>
                    </label>
                  );
                })}
              </div>
              <div className="flex justify-between pt-2">
                <button type="button" className="btn-ghost" onClick={() => setStep(1)}>
                  ← Back
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={wizardConnect.isPending}
                  onClick={() => wizardConnect.mutate()}
                  data-testid={`wizard-confirm-connect-${c.provider}`}
                >
                  {wizardConnect.isPending ? "Encrypting & Backfilling 60d…" : "Link & Run 60-Day Backfill →"}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="border border-jade-6 bg-jade-3 p-4 text-xs text-jade-11">
                <p className="font-mono uppercase tracking-wider">✓ 6/6 Historical 10-Day Partitions Reconciled</p>
                <p className="mt-1 text-slate-12">
                  Fernet-encrypted credentials stored, duplicate accounts skipped, and 60 days of creative-level metrics promoted to <strong>SYNCED_ACTIVE</strong> in the global Account Switcher.
                </p>
              </div>
              <div className="flex justify-end">
                <button type="button" className="btn-primary" onClick={() => setOpen(false)} data-testid={`wizard-finish-${c.provider}`}>
                  <Check size={13} /> Done
                </button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ConnectorCard({ c }: { c: Connector }) {
  const copy = () => navigator.clipboard.writeText(c.redirect_uri).then(() => toast.success("Redirect URI copied"));
  const live = c.connections.reduce((s, x) => s + x.accounts.length, 0);

  return (
    <article className="border border-slate-6 bg-white p-6" data-testid={`connector-card-${c.provider}`}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center border border-slate-6">
          <PlatformLogo platform={c.provider} size={22} />
        </span>
        <div className="flex-1">
          <h3 className="text-[15px] font-medium text-slate-12">{c.name}</h3>
          <p className="num text-[11px] text-slate-11">{c.scopes.length ? c.scopes.join(" · ") : "reporting · read"}</p>
        </div>
        <StatusPill tone={live ? "jade" : "iris"} testId={`connector-status-${c.provider}`}>
          {live ? `${live} live` : "sandbox"}
        </StatusPill>
      </div>

      <div className="mt-5">
        <p className="eyebrow mb-1.5">Sandbox · 60 days</p>
        {c.sandbox_accounts.map((a) => (
          <p key={a.account_id} className="flex justify-between text-xs">
            <span className="flex items-center gap-1.5 text-slate-12">
              <Database size={12} className="text-slate-10" /> {a.name}
            </span>
            <span className="num text-slate-11">
              {a.account_id} · {a.currency}
            </span>
          </p>
        ))}
      </div>

      {c.connections.length > 0 && (
        <div className="mt-5">
          <p className="eyebrow mb-1">Connected Accounts (Fernet Encrypted · Read-Only)</p>
          <ul>
            {c.connections.map((x) => (
              <ConnectionRow key={x.connection_id} c={x} />
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-6 pt-4">
        <ConnectionWizardModal c={c} />
        <button className="btn-ghost" onClick={copy} data-testid={`connector-copy-redirect-${c.provider}`}>
          <Copy size={12} /> Redirect URI
        </button>
        <a className="btn-ghost" href={c.console_url} target="_blank" rel="noreferrer" data-testid={`connector-console-${c.provider}`}>
          Developer console <ExternalLink size={12} />
        </a>
      </div>
    </article>
  );
}
