import { useMemo, useState, type ReactNode } from "react";
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, RefreshCw, RotateCcw, Search } from "lucide-react";
import { useBreakdown, useCurrency } from "../../hooks/queries";
import { cn } from "../../lib/cn";
import { money, num, pct, PLATFORM_LABEL, ratio } from "../../lib/format";
import { useFilters } from "../../state/filters";
import { Delta } from "../common/Delta";
import { PlatformLogo } from "../common/PlatformLogo";
import { SectionHeader } from "../common/SectionHeader";
import type { BreakdownRow, Level } from "../../types";

const LEVEL_LABEL: Record<Level, string> = { platform: "Platform", campaign: "Campaign", adset: "Ad Set", creative: "Creative" };

type SortKey = "spend" | "roas" | "cpa" | "cpm" | "ctr" | "hook_rate" | "hold_rate" | "frequency" | "is_lost";
type QuickFilter = "all" | "fatigued" | "is_lost" | "high_roas";

const HEAD: { key: SortKey; label: string }[] = [
  { key: "spend", label: "Spend" },
  { key: "roas", label: "ROAS" },
  { key: "cpa", label: "CPA" },
  { key: "cpm", label: "CPM" },
  { key: "ctr", label: "CTR" },
  { key: "hook_rate", label: "Hook" },
  { key: "hold_rate", label: "Hold" },
  { key: "frequency", label: "Freq" },
  { key: "is_lost", label: "IS lost" },
];

const Cell = ({ children, className }: { children: ReactNode; className?: string }) => (
  <td className={cn("num whitespace-nowrap px-3 py-2.5 text-right text-xs text-slate-12", className)}>{children}</td>
);

function Row({ r, level, onDrill }: { r: BreakdownRow; level: Level; onDrill: (row: BreakdownRow) => void }) {
  const { currency, rate } = useCurrency();
  const parent = level === "adset" ? r.campaign : level === "creative" ? r.adset : null;
  const canDrill = level !== "creative";
  return (
    <tr
      tabIndex={canDrill ? 0 : undefined}
      onKeyDown={(e) => {
        if (canDrill && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onDrill(r);
        }
      }}
      onClick={() => canDrill && onDrill(r)}
      className={cn(
        "group border-t border-slate-6 transition-colors duration-100 ",
        canDrill && "cursor-pointer focus:bg-slate-2 focus:outline-none",
      )}
      data-testid={`drilldown-row-${r.id}`}
    >
      <td className="sticky left-0 z-10 max-w-[260px] bg-white px-3 py-2.5 ">
        <div className="flex items-center gap-2">
          <PlatformLogo platform={r.platform} size={14} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 truncate text-xs font-medium text-slate-12">
              <span className="truncate">{level === "platform" ? PLATFORM_LABEL[r.platform] : r.name}</span>
              {canDrill && <ChevronRight size={12} className="shrink-0 text-slate-9" />}
            </p>
            {parent && <p className="truncate text-[10px] text-slate-11">{parent}</p>}
          </div>
        </div>
      </td>
      <Cell>
        {money(r.spend, currency, rate, true)} <Delta value={r.delta.spend} className="ml-1 text-[10px]" />
      </Cell>
      <Cell>
        {ratio(r.roas)} <Delta value={r.delta.roas} className="ml-1 text-[10px]" />
      </Cell>
      <Cell>
        {money(r.cpa, currency, rate)} <Delta value={r.delta.cpa} inverse className="ml-1 text-[10px]" />
      </Cell>
      <Cell>{money(r.cpm, currency, rate)}</Cell>
      <Cell>{pct(r.ctr, 2)}</Cell>
      <Cell>{pct(r.hook_rate)}</Cell>
      <Cell>{pct(r.hold_rate)}</Cell>
      <Cell className={r.frequency && r.frequency >= 3.8 ? "text-amber-11 font-medium" : undefined}>{num(r.frequency)}</Cell>
      <Cell className={r.is_lost && r.is_lost >= 0.2 ? "text-ruby-11 font-medium" : undefined}>{pct(r.is_lost, 0)}</Cell>
    </tr>
  );
}

export function DrilldownTable() {
  const { level, platform, campaign, adsetId, adsetName, update, resetDrilldown } = useFilters();
  const { data, isFetching, isError, isLoading, refetch } = useBreakdown();
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const [quick, setQuick] = useState<QuickFilter>("all");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const handleDrill = (r: BreakdownRow) => {
    setSearch("");
    setQuick("all");
    if (level === "platform") {
      update({ platform: r.platform, level: "campaign", campaign: null, adsetId: null, adsetName: null });
    } else if (level === "campaign") {
      update({ platform: r.platform, campaign: r.name, level: "adset", adsetId: null, adsetName: null });
    } else if (level === "adset") {
      update({ platform: r.platform, campaign: r.campaign ?? campaign, adsetId: r.id, adsetName: r.name, level: "creative" });
    }
  };

  const filtered = useMemo(() => {
    const rows = data ?? [];
    return rows
      .filter((r) => {
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchName = r.name.toLowerCase().includes(q);
          const matchCamp = (r.campaign ?? "").toLowerCase().includes(q);
          const matchPlat = PLATFORM_LABEL[r.platform].toLowerCase().includes(q);
          if (!matchName && !matchCamp && !matchPlat) return false;
        }
        if (quick === "fatigued") return (r.frequency ?? 0) >= 3.5;
        if (quick === "is_lost") return (r.is_lost ?? 0) >= 0.15;
        if (quick === "high_roas") return (r.roas ?? 0) >= 3.5;
        return true;
      })
      .sort((a, b) => {
        const av = a[sortKey] ?? -Infinity;
        const bv = b[sortKey] ?? -Infinity;
        return sortDir === "desc" ? Number(bv) - Number(av) : Number(av) - Number(bv);
      });
  }, [data, search, quick, sortKey, sortDir]);

  return (
    <section data-testid="section-drilldown">
      <SectionHeader
        index="04"
        kicker="Platform → Campaign → Ad Set → Creative"
        title={`Drilldown by ${LEVEL_LABEL[level]}`}
        aside={<span className="num text-xs text-slate-11">{isError && !data ? "Load failed" : isFetching ? data ? "Refreshing…" : "Loading…" : `${filtered.length} of ${data?.length ?? 0} rows · last 7d`}</span>}
      />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-4 py-3" data-testid="drilldown-breadcrumbs">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setQuick("all");
              update({ platform: null, campaign: null, adsetId: null, adsetName: null, level: "platform" });
            }}
            className={cn("font-mono text-[11px] uppercase tracking-wider", level === "platform" ? "font-semibold text-slate-12" : "text-slate-11 hover:text-slate-12")}
            data-testid="breadcrumb-all-platforms"
          >
            All Platforms
          </button>
          {platform && (
            <>
              <ChevronRight size={12} className="text-slate-9" />
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setQuick("all");
                  update({ campaign: null, adsetId: null, adsetName: null, level: "campaign" });
                }}
                className={cn("font-mono text-[11px] uppercase tracking-wider", level === "campaign" && !campaign ? "font-semibold text-slate-12" : "text-slate-11 hover:text-slate-12")}
                data-testid="breadcrumb-platform"
              >
                {PLATFORM_LABEL[platform]}
              </button>
            </>
          )}
          {campaign && (
            <>
              <ChevronRight size={12} className="text-slate-9" />
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setQuick("all");
                  update({ adsetId: null, adsetName: null, level: "adset" });
                }}
                className={cn("text-xs", level === "adset" && !adsetId ? "font-semibold text-slate-12" : "text-slate-11 hover:text-slate-12")}
                data-testid="breadcrumb-campaign"
              >
                {campaign}
              </button>
            </>
          )}
          {adsetId && (
            <>
              <ChevronRight size={12} className="text-slate-9" />
              <span className="text-xs font-semibold text-slate-12" data-testid="breadcrumb-adset">
                {adsetName ?? adsetId}
              </span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex items-center">
            <Search size={12} className="pointer-events-none absolute left-2.5 text-slate-10" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search entities…"
              aria-label="Search campaigns, ad sets, and creatives"
              className="h-9 w-[min(220px,45vw)] rounded-full border border-slate-5 bg-white pl-8 pr-3 text-xs text-slate-12 outline-none placeholder:text-slate-10 focus:border-jade-8"
              data-testid="drilldown-search-input"
            />
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick filters">
            {(
              [
                { id: "all", label: "All" },
                { id: "fatigued", label: "Freq ≥ 3.5" },
                { id: "is_lost", label: "IS Lost ≥ 15%" },
                { id: "high_roas", label: "ROAS ≥ 3.5x" },
              ] as { id: QuickFilter; label: string }[]
            ).map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => setQuick(q.id)}
                aria-pressed={quick === q.id}
                data-state={quick === q.id ? "on" : "off"}
                className="pill h-7 px-2 text-[11px]"
                data-testid={`drilldown-quick-${q.id}`}
              >
                {q.label}
              </button>
            ))}
          </div>
          {(campaign || adsetId) && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setQuick("all");
                resetDrilldown();
              }}
              className="btn-ghost h-7 px-2 py-1 text-[11px]"
              data-testid="drilldown-reset-button"
            >
              <RotateCcw size={11} /> Reset
            </button>
          )}
        </div>
      </div>

      {isError && data && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border border-amber-6 bg-amber-2 px-4 py-2.5 text-xs text-amber-11" role="status" data-testid="drilldown-stale-data">
          <span>Refresh failed. Showing the last available results.</span>
          <button type="button" onClick={() => refetch()} disabled={isFetching} className="inline-flex items-center gap-1.5 font-medium hover:underline">
            <RefreshCw size={12} className={isFetching ? "animate-spin" : undefined} /> Try again
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-5 bg-white scrollbar-thin">
        <table className="w-full min-w-[880px] border-collapse" data-testid="drilldown-table">
          <thead>
            <tr className="bg-slate-2">
              <th className="sticky left-0 z-10 bg-slate-2 eyebrow px-3 py-2 text-left font-normal">{LEVEL_LABEL[level]}</th>
              {HEAD.map((h) => {
                const active = sortKey === h.key;
                return (
                  <th key={h.key} className="eyebrow px-3 py-2 text-right font-normal">
                    <button
                      type="button"
                      onClick={() => handleSort(h.key)}
                      className={cn("inline-flex items-center gap-1 uppercase tracking-wider hover:text-slate-12", active ? "text-slate-12 font-semibold" : "text-slate-11")}
                      data-testid={`drilldown-sort-${h.key}`}
                    >
                      {h.label}
                      {active ? sortDir === "desc" ? <ArrowDown size={11} /> : <ArrowUp size={11} /> : <ArrowUpDown size={11} className="opacity-40" />}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isError && !data ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center" data-testid="drilldown-error-row">
                  <div className="flex flex-col items-center gap-2 text-xs text-ruby-11" role="alert">
                    <span className="inline-flex items-center gap-1.5"><AlertCircle size={13} /> Campaign data could not be loaded.</span>
                    <button type="button" onClick={() => refetch()} disabled={isFetching} className="btn-ghost h-7 px-2">Try again</button>
                  </div>
                </td>
              </tr>
            ) : isLoading && !data ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center font-mono text-xs text-slate-10" role="status">Loading entities…</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center font-mono text-xs text-slate-10" data-testid="drilldown-empty-row">
                  {data?.length === 0 ? "No entities are available for this scope." : "No entities match the current filter criteria."}
                </td>
              </tr>
            ) : (
              filtered.map((r) => <Row key={r.id} r={r} level={level} onDrill={handleDrill} />)
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
