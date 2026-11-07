import { RefreshCw } from "lucide-react";
import { useCurrency, usePulse } from "../../hooks/queries";
import { formatKpi, LOWER_IS_BETTER, shortDate } from "../../lib/format";
import { useFilters } from "../../state/filters";
import { Delta } from "../common/Delta";
import { Sparkline } from "../common/Sparkline";
import type { Kpi } from "../../types";

function KpiCell({ kpi, index }: { kpi: Kpi; index: number }) {
  const { currency, rate } = useCurrency();
  const { compare } = useFilters();
  return (
    <div className="animate-fade-up min-h-[148px] bg-white px-4 py-4 sm:px-5 sm:py-5" style={{ animationDelay: `${index * 40}ms` }} data-testid={`kpi-${kpi.key}`}>
      <p className="eyebrow">{kpi.label}</p>
      <p className="num mt-2.5 text-[24px] font-medium leading-none text-slate-12 sm:text-[26px]" data-testid={`kpi-${kpi.key}-value`}>
        {formatKpi(kpi, kpi.value, currency, rate)}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <Delta value={kpi.delta_pct} inverse={LOWER_IS_BETTER.has(kpi.key)} testId={`kpi-${kpi.key}-delta`} />
        <span className="num truncate text-[10px] text-slate-10">{compare === "previous_period" ? "prev 7d" : "30d avg"} {formatKpi(kpi, kpi.baseline, currency, rate)}</span>
      </div>
      <div className="mt-2">
        <Sparkline values={kpi.spark} />
      </div>
    </div>
  );
}

export function PulseStrip() {
  const { data, isLoading, isError, refetch, isFetching } = usePulse();
  if (!data && isLoading) return <div className="h-[300px] animate-pulse border border-slate-6 bg-slate-2" role="status" aria-label="Loading performance data" data-testid="pulse-loading" />;
  if (!data) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border border-ruby-6 bg-ruby-2 px-4 py-4" role="alert" data-testid="pulse-error">
        <p className="text-sm text-ruby-11">Performance data could not be loaded.</p>
        <button type="button" className="btn-ghost" onClick={() => refetch()} disabled={isFetching} data-testid="pulse-retry-button">
          <RefreshCw size={13} className={isFetching ? "animate-spin" : undefined} /> Try again
        </button>
      </div>
    );
  }
  return (
    <section className="border border-slate-6 bg-white" data-testid="pulse-strip">
      {isError && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-6 bg-amber-2 px-4 py-2 text-xs text-amber-11" role="status">
          <span>Refresh failed. Showing the last available performance data.</span>
          <button type="button" onClick={() => refetch()} disabled={isFetching} className="font-medium hover:underline">Try again</button>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-6 px-4 py-3 sm:px-5">
        <p className="eyebrow flex items-center gap-2"><span className="h-1.5 w-1.5 bg-jade-9" /> Unified pulse · last 7 days</p>
        <p className="num text-[11px] text-slate-11" data-testid="pulse-period">
          {shortDate(data.period.start)} – {shortDate(data.period.end)} · normalized to USD · {data.period.window.replace("_", " ")}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-px bg-slate-6 sm:grid-cols-2 xl:grid-cols-4">
        {data.kpis.map((k, i) => (
          <KpiCell key={k.key} kpi={k} index={i} />
        ))}
      </div>
    </section>
  );
}
