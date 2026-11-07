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
    <div className="animate-fade-up bg-white px-5 py-5" style={{ animationDelay: `${index * 40}ms` }} data-testid={`kpi-${kpi.key}`}>
      <p className="eyebrow">{kpi.label}</p>
      <p className="num mt-2 text-[22px] font-medium leading-none text-slate-12" data-testid={`kpi-${kpi.key}-value`}>
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
  const { data, isLoading } = usePulse();
  if (isLoading || !data) return <div className="h-[300px] animate-pulse border border-slate-6 bg-slate-2" data-testid="pulse-loading" />;
  return (
    <section className="border border-slate-6 bg-white" data-testid="pulse-strip">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-6 px-5 py-2.5">
        <p className="eyebrow">Unified pulse · last 7 days</p>
        <p className="num text-[11px] text-slate-11" data-testid="pulse-period">
          {shortDate(data.period.start)} – {shortDate(data.period.end)} · normalized to USD · {data.period.window.replace("_", " ")}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-px bg-slate-6 sm:grid-cols-4">
        {data.kpis.map((k, i) => (
          <KpiCell key={k.key} kpi={k} index={i} />
        ))}
      </div>
    </section>
  );
}
