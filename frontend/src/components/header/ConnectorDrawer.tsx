import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Database, ExternalLink, Plug, RefreshCw, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { useConnectors } from "../../hooks/queries";
import { api } from "../../lib/api";
import { PlatformLogo } from "../common/PlatformLogo";
import { StatusPill } from "../common/StatusPill";

export function ConnectorDrawer() {
  const [open, setOpen] = useState(false);
  const { data } = useConnectors();
  const qc = useQueryClient();

  const reseed = useMutation({
    mutationFn: () => api.reseedSandbox(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["connectors"] });
      qc.invalidateQueries({ queryKey: ["pulse"] });
      qc.invalidateQueries({ queryKey: ["breakdown"] });
      toast.success("Sandbox 60-day cross-channel dataset refreshed");
    },
    onError: () => toast.error("Could not refresh sandbox telemetry"),
  });

  const totalAccounts = data?.reduce((acc, c) => acc + c.sandbox_accounts.length + c.connections.reduce((s, x) => s + x.accounts.length, 0), 0) ?? 4;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="btn-ghost hidden sm:inline-flex" data-testid="connector-drawer-trigger">
          <Plug size={13} className="text-iris-11" />
          <span>Sources</span>
          <span className="num text-[11px] text-slate-10">{totalAccounts}</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-12/20" />
        <Dialog.Content
          className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-slate-6 bg-white p-6  focus:outline-none"
          data-testid="connector-drawer-content"
        >
          <div className="flex items-center justify-between border-b border-slate-6 pb-4">
            <div>
              <p className="eyebrow">Read-Only OAuth & Sandbox</p>
              <Dialog.Title className="mt-0.5 font-serif text-xl font-medium text-slate-12">Connected Ad Platforms</Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button className="btn-ghost h-7 w-7 justify-center p-0" aria-label="Close drawer" data-testid="connector-drawer-close">
                <X size={14} />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="mt-3 text-xs leading-relaxed text-slate-11">
            All connectors enforce strict read-only reporting scopes. Active sandbox streams provide 60 days of deterministic cross-channel telemetry.
          </Dialog.Description>

          <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin">
            {data?.map((c) => {
              const live = c.connections.reduce((s, x) => s + x.accounts.length, 0);
              return (
                <div key={c.provider} className="border border-slate-6 bg-slate-1 p-3.5" data-testid={`drawer-connector-${c.provider}`}>
                  <div className="flex items-center gap-2.5">
                    <PlatformLogo platform={c.provider} size={16} />
                    <span className="text-xs font-medium text-slate-12">{c.name}</span>
                    <StatusPill tone={live ? "jade" : "iris"} className="ml-auto">
                      {live ? `${live} OAuth` : "Sandbox 60d"}
                    </StatusPill>
                  </div>
                  <div className="mt-2 space-y-1">
                    {c.sandbox_accounts.map((a) => (
                      <div key={a.account_id} className="flex items-center justify-between text-[11px] text-slate-11">
                        <span className="flex items-center gap-1.5 text-slate-12">
                          <Database size={11} className="text-slate-10" /> {a.name}
                        </span>
                        <span className="num">
                          {a.account_id} · {a.currency}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-slate-6 pt-2 text-[10px] text-slate-10">
                    <span className="num">Scopes: {c.scopes.length ? c.scopes.join(", ") : "reporting.read"}</span>
                    <span className="inline-flex items-center gap-1 text-jade-11">
                      <ShieldCheck size={11} /> Verified
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 space-y-2 border-t border-slate-6 pt-4">
            <button
              className="btn-ghost w-full justify-center"
              onClick={() => reseed.mutate()}
              disabled={reseed.isPending}
              data-testid="connector-drawer-reseed"
            >
              <RefreshCw size={12} className={reseed.isPending ? "animate-spin" : undefined} />
              {reseed.isPending ? "Refreshing 60-day dataset…" : "Refresh 60-day sandbox telemetry"}
            </button>
            <Link
              to="/connections"
              onClick={() => setOpen(false)}
              className="btn-primary w-full justify-center"
              data-testid="connector-drawer-manage-link"
            >
              Manage OAuth Credentials <ExternalLink size={12} />
            </Link>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
