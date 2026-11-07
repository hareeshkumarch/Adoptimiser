import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, ChevronsUpDown, Layers, Plug, Search } from "lucide-react";
import { useAccounts } from "../../hooks/queries";
import { PLATFORM_LABEL } from "../../lib/format";
import { useFilters } from "../../state/filters";
import { PlatformLogo } from "../common/PlatformLogo";
import type { Currency, Platform } from "../../types";

const PLATFORMS: Platform[] = ["meta", "google", "tiktok", "linkedin"];
const CURRENCIES: Currency[] = ["USD", "EUR", "GBP"];

const ITEM = "flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm text-slate-12 data-[selected=true]:font-medium data-[selected=true]:text-jade-11";
const GROUP = "[&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3";

const Tick = ({ on }: { on: boolean }) => <Check size={14} className={on ? "ml-auto text-jade-11" : "ml-auto opacity-0"} />;

export function AccountSwitcher() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { platform, accountId, currency, update } = useFilters();
  const { data, isLoading, isError, refetch } = useAccounts();
  const accounts = data?.accounts ?? [];
  const current = accounts.find((a) => a.account_id === accountId);
  const label = current ? current.name : platform ? `All ${PLATFORM_LABEL[platform]} accounts` : "All platforms";
  const source = current ? (current.source === "oauth" ? "Live account" : "Sandbox account") : platform ? "Platform view" : "Combined view";

  const pick = (patch: Parameters<typeof update>[0]) => {
    update(patch);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          className="flex h-11 w-[150px] items-center gap-2.5 rounded-xl border border-slate-5 bg-white px-2.5 text-left transition-colors hover:border-slate-7 data-[state=open]:border-jade-8 sm:w-[220px] sm:px-3 md:min-w-[260px]"
          aria-label={`Data scope: ${label}, display currency ${currency}`}
          data-testid="account-switcher-trigger"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-2">
            {platform ? <PlatformLogo platform={platform} size={15} /> : <Layers size={15} className="text-slate-10" />}
          </span>
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="flex items-center justify-between gap-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-10">
              <span className="truncate">{source}</span>
              <span className="shrink-0">{currency}</span>
            </span>
            <span className="mt-0.5 truncate text-xs font-medium text-slate-12">{label}</span>
          </span>
          <ChevronsUpDown size={13} className="shrink-0 text-slate-10" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={7} className="z-50 w-[min(360px,calc(100vw-1.5rem))] animate-fade-up rounded-2xl border border-slate-5 bg-white p-1">
          <Command loop>
            <div className="relative border-b border-slate-6">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-9" />
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder="Search accounts, platforms, or currency"
                aria-label="Search accounts, platforms, or currency"
                className="h-11 w-full bg-transparent pl-9 pr-3 text-sm outline-none placeholder:text-slate-10"
                data-testid="account-switcher-search"
              />
            </div>
            <Command.List className="max-h-[360px] overflow-y-auto pb-1 scrollbar-thin">
              <Command.Empty className="px-3 py-4 text-sm text-slate-11">No matches.</Command.Empty>
              <Command.Group heading="Scope" className={GROUP}>
                <Command.Item value="all platforms" onSelect={() => pick({ platform: null, accountId: null, campaign: null, adsetId: null, adsetName: null })} className={ITEM} data-testid="switcher-all">
                  <Layers size={14} className="text-slate-11" /> All platforms <Tick on={!platform} />
                </Command.Item>
              </Command.Group>
              <Command.Group heading="Platforms" className={GROUP}>
                {PLATFORMS.map((p) => (
                  <Command.Item key={p} value={`platform ${PLATFORM_LABEL[p]}`} onSelect={() => pick({ platform: p, accountId: null, campaign: null, adsetId: null, adsetName: null })} className={ITEM} data-testid={`switcher-platform-${p}`}>
                    <PlatformLogo platform={p} size={14} /> {PLATFORM_LABEL[p]} Ads <Tick on={platform === p && !accountId} />
                  </Command.Item>
                ))}
              </Command.Group>
              <Command.Group heading="Accounts" className={GROUP}>
                {accounts.length > 0 ? (
                  accounts.map((a) => (
                    <Command.Item
                      key={a.account_id}
                      value={`account ${a.name} ${a.account_id} ${a.currency} ${a.source}`}
                      onSelect={() => pick({ platform: a.platform, accountId: a.account_id, campaign: null, adsetId: null, adsetName: null })}
                      className={ITEM}
                      data-testid={`switcher-account-${a.account_id}`}
                    >
                      <PlatformLogo platform={a.platform} size={14} />
                      <span className="flex flex-col">
                        <span>{a.name}</span>
                        <span className="flex items-center gap-2 font-mono text-[10px] text-slate-10">
                          <span>{a.account_id} · {a.currency ?? "—"}</span>
                          <span className={a.source === "oauth" ? "text-jade-11" : "text-slate-9"}>{a.source === "oauth" ? "Live" : "Sandbox"}</span>
                        </span>
                      </span>
                      <Tick on={accountId === a.account_id} />
                    </Command.Item>
                  ))
                ) : !search.trim() ? (
                    <>
                      <p className="px-2.5 py-2 text-xs leading-relaxed text-slate-10">
                        {isLoading ? "Loading linked accounts…" : isError ? "The account list could not be loaded." : "No linked accounts yet."}
                      </p>
                      {!isLoading && (isError ? (
                        <Command.Item value="retry account list" onSelect={() => refetch()} className={ITEM}>
                          <ArrowRight size={14} /> Try loading accounts again
                        </Command.Item>
                      ) : (
                        <Command.Item
                          value="connect an ad platform"
                          onSelect={() => {
                            setOpen(false);
                            navigate("/connections");
                          }}
                          className={ITEM}
                        >
                          <Plug size={14} /> Connect an ad platform <ArrowRight size={13} className="ml-auto" />
                        </Command.Item>
                      ))}
                    </>
                  ) : null}
              </Command.Group>
              <Command.Group heading="Display currency" className={GROUP}>
                {CURRENCIES.map((c) => (
                  <Command.Item key={c} value={`currency ${c}`} onSelect={() => pick({ currency: c })} className={ITEM} data-testid={`switcher-currency-${c}`}>
                    <span className="num w-8 text-xs text-slate-11">{c}</span> Show values in {c} <Tick on={currency === c} />
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
