import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { Check, ChevronsUpDown, Layers } from "lucide-react";
import { useAccounts } from "../../hooks/queries";
import { PLATFORM_LABEL } from "../../lib/format";
import { useFilters } from "../../state/filters";
import { PlatformLogo } from "../common/PlatformLogo";
import type { Currency, Platform } from "../../types";

const PLATFORMS: Platform[] = ["meta", "google", "tiktok", "linkedin"];
const CURRENCIES: Currency[] = ["USD", "EUR", "GBP"];

const ITEM = "flex cursor-pointer items-center gap-2.5 px-2.5 py-2 text-sm text-slate-12 data-[selected=true]:bg-slate-3";
const GROUP = "[&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3";

const Tick = ({ on }: { on: boolean }) => <Check size={14} className={on ? "ml-auto text-iris-11" : "ml-auto opacity-0"} />;

export function AccountSwitcher() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { platform, accountId, currency, update } = useFilters();
  const { data } = useAccounts();
  const accounts = data?.accounts ?? [];
  const current = accounts.find((a) => a.account_id === accountId);
  const label = current ? current.name : platform ? `All ${PLATFORM_LABEL[platform]} accounts` : "All platforms";

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
        <button className="btn-ghost w-[152px] justify-between sm:w-[220px] md:min-w-[260px]" data-testid="account-switcher-trigger">
          <span className="flex min-w-0 items-center gap-2">
            {platform ? <PlatformLogo platform={platform} size={14} /> : <Layers size={14} className="shrink-0 text-slate-11" />}
            <span className="truncate">{label}</span>
            <span className="num hidden text-[11px] text-slate-11 sm:inline">{currency}</span>
          </span>
          <ChevronsUpDown size={14} className="shrink-0 text-slate-11" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className="z-50 w-[min(340px,calc(100vw-1.5rem))] animate-fade-up border border-slate-6 bg-white">
          <Command loop>
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Filter platform, account, currency…"
              className="h-10 w-full border-b border-slate-6 bg-transparent px-3 text-sm outline-none placeholder:text-slate-10"
              data-testid="account-switcher-search"
            />
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
                {accounts.map((a) => (
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
                      <span className="num text-[11px] text-slate-11">
                        {a.account_id} · {a.currency ?? "—"} · {a.source === "oauth" ? "live oauth synced" : "sandbox"}
                      </span>
                    </span>
                    <Tick on={accountId === a.account_id} />
                  </Command.Item>
                ))}
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
