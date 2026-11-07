import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { CopilotPanel } from "../components/insights/CopilotPanel";
import { OpportunityCard } from "../components/insights/OpportunityCard";
import { WeekdayBars } from "../components/insights/WeekdayBars";
import { useCurrency } from "../hooks/queries";
import { useOpportunities } from "../hooks/insights";
import { money, ratio } from "../lib/format";
import { useDeepAgent } from "../state/deepAgent";

const ORDER = ["All", "Scale", "Save", "Creative", "Reach", "Timing", "Tracking", "Budget"];

function Headline() {
  const { data } = useOpportunities();
  const { currency, rate } = useCurrency();
  if (!data) return null;
  const s = data.summary;
  const cells = [
    { k: "Weekly upside found", v: `+${money(s.weekly_upside, currency, rate, true)}`, accent: true, id: "upside" },
    { k: "Suggestions", v: String(s.count), id: "count" },
    { k: "Weekly spend analysed", v: money(s.weekly_spend, currency, rate, true), id: "spend" },
    { k: "Average ROAS", v: ratio(s.avg_roas), id: "roas" },
  ];
  return (
    <div className="grid grid-cols-2 border border-slate-12 bg-white lg:grid-cols-4" data-testid="insights-headline">
      {cells.map((c, i) => (
        <div key={c.k} className={`px-5 py-4 ${i > 0 ? "border-l border-slate-6" : ""} ${c.accent ? "bg-slate-12 text-white" : ""}`} data-testid={`insights-stat-${c.id}`}>
          <p className={`font-mono text-[10px] uppercase tracking-[0.14em] ${c.accent ? "text-jade-8" : "text-slate-10"}`}>{c.k}</p>
          <p className="num mt-2 text-[26px] font-medium leading-none">{c.v}</p>
        </div>
      ))}
    </div>
  );
}

export default function InsightsPage() {
  const { data, isLoading, isError, refetch, isFetching } = useOpportunities();
  const [cat, setCat] = useState("All");
  const [seed, setSeed] = useState<string | null>(null);
  const { start } = useDeepAgent();
  const navigate = useNavigate();
  const list = useMemo(() => (data?.opportunities ?? []).filter((o) => cat === "All" || o.category === cat), [data, cat]);
  const cats = ORDER.filter((c) => c === "All" || data?.summary.categories[c]);

  const investigate = (q: string) => {
    start(q);
    navigate("/agent");
  };

  return (
    <div className="space-y-6" data-testid="page-insights">
      <Headline />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5" role="tablist" data-testid="insights-category-tabs">
              {cats.map((c) => (
                <button key={c} type="button" role="tab" aria-selected={cat === c} data-state={cat === c ? "on" : "off"} className="pill h-8" onClick={() => setCat(c)} data-testid={`insights-tab-${c.toLowerCase()}`}>
                  {c}
                  {c !== "All" && <span className="num text-[10px] opacity-70">{data?.summary.categories[c]}</span>}
                </button>
              ))}
            </div>
            <button type="button" className="btn-ghost h-8 px-3 text-[11px]" onClick={() => refetch()} disabled={isFetching} data-testid="insights-refresh-button">
              <RefreshCw size={12} className={isFetching ? "animate-spin" : undefined} /> Refresh
            </button>
          </div>
          {isLoading && <div className="h-64 animate-pulse border border-slate-6 bg-white" data-testid="insights-loading" />}
          {isError && <p className="border border-ruby-7 bg-ruby-2 p-4 text-sm text-ruby-11" data-testid="insights-error">Suggestions could not be loaded.</p>}
          {!isLoading && list.length === 0 && <p className="border border-slate-6 bg-white p-6 text-sm text-slate-11" data-testid="insights-empty">Nothing urgent here. Your accounts look healthy for this view.</p>}
          <div className="grid gap-4 lg:grid-cols-2">
            {list.map((o, i) => <OpportunityCard key={o.id} o={o} index={i} onAsk={setSeed} onInvestigate={investigate} />)}
          </div>
          {data && <WeekdayBars rows={data.weekday} />}
        </div>
        <div className="xl:sticky xl:top-24 xl:h-[calc(100vh-8rem)]">
          <CopilotPanel seed={seed} onSeedUsed={() => setSeed(null)} />
        </div>
      </div>
    </div>
  );
}
