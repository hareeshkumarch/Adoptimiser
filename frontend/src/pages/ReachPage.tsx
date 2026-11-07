import { Bar, CartesianGrid, ComposedChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useCurrency } from "../hooks/queries";
import { useReach } from "../hooks/insights";
import { money, num, pct, PLATFORM_LABEL, shortDate, signedPct } from "../lib/format";
import { PlatformLogo } from "../components/common/PlatformLogo";
import type { ReachResponse } from "../lib/insights";

const PLAT_COLOR: Record<string, string> = { meta: "#1877F2", tiktok: "#141a15", linkedin: "#d97706", google: "#34A853" };
const STATUS_STYLE: Record<string, string> = { Saturated: "bg-ruby-9 text-white", Tiring: "bg-amber-9 text-slate-12", "Room to grow": "bg-jade-9 text-white" };
const compact = (v: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);
const TOOLTIP = { contentStyle: { borderRadius: 0, border: "1px solid #141a15", fontSize: 11, fontFamily: "JetBrains Mono" } };

function Totals({ d }: { d: ReachResponse }) {
  const { currency, rate } = useCurrency();
  const t = d.totals;
  const cells = [
    { k: "People reached (7d, est.)", v: compact(t.reach), delta: t.reach_base ? t.reach / t.reach_base - 1 : null, good: true },
    { k: "Avg frequency", v: `${num(t.frequency, 2)}x`, delta: t.frequency_base ? t.frequency / t.frequency_base - 1 : null, good: false },
    { k: "Cost per 1k people", v: money(t.cost_per_1k_reach, currency, rate), delta: t.cost_per_1k_reach_base ? t.cost_per_1k_reach / t.cost_per_1k_reach_base - 1 : null, good: false },
    { k: "Spend on saturated audiences", v: money(t.saturated_spend, currency, rate, true), delta: null, good: false, sub: `${t.saturated_count} ad set${t.saturated_count === 1 ? "" : "s"}` },
  ];
  return (
    <div className="grid grid-cols-2 border border-slate-12 bg-white lg:grid-cols-4" data-testid="reach-totals">
      {cells.map((c, i) => (
        <div key={c.k} className={`px-5 py-4 ${i > 0 ? "border-l border-slate-6" : ""}`} data-testid={`reach-total-${i}`}>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-10">{c.k}</p>
          <p className="num mt-2 text-[26px] font-medium leading-none">{c.v}</p>
          {c.delta !== null && <p className={`num mt-1.5 text-[11px] ${(c.delta > 0) === c.good ? "text-jade-11" : "text-ruby-11"}`}>{signedPct(c.delta)} vs prev 7d</p>}
          {c.sub && <p className="mt-1.5 text-[11px] text-slate-10">{c.sub}</p>}
        </div>
      ))}
    </div>
  );
}

function SweetSpot({ d }: { d: ReachResponse }) {
  const { currency, rate } = useCurrency();
  const s = d.sweet_spot;
  return (
    <section className="border border-slate-6 bg-white p-5" data-testid="reach-frequency-curve">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Frequency vs cost per sale (30d)</p>
          <h3 className="mt-1 text-[15px] font-semibold">Your sweet spot is {s.bucket ?? "—"} views per person</h3>
        </div>
        {s.penalty != null && <p className="max-w-xs text-right text-[12px] text-slate-11" data-testid="reach-sweet-spot-note">At {s.worst_bucket} views, each sale costs <span className="num font-semibold text-ruby-11">{money(s.worst_cpa, currency, rate)}</span> vs <span className="num font-semibold text-jade-11">{money(s.cpa, currency, rate)}</span>. Cap frequency near {s.bucket}.</p>}
      </div>
      <div className="mt-3 flex gap-4 text-[11px] text-slate-11"><span className="flex items-center gap-1.5"><span className="h-2 w-3 bg-slate-12" />Cost per sale (bars)</span><span className="flex items-center gap-1.5"><span className="h-[2px] w-3 bg-jade-9" />Click rate (line)</span></div>
      <div className="mt-2 h-60">
        <ResponsiveContainer>
          <ComposedChart data={d.curve} margin={{ left: 0, right: 8, top: 8 }}>
            <CartesianGrid stroke="#e6e9e2" vertical={false} />
            <XAxis dataKey="bucket" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
            <YAxis yAxisId="cpa" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} width={44} />
            <YAxis yAxisId="ctr" orientation="right" tickFormatter={(v) => pct(v, 1)} tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} width={44} />
            <Tooltip {...TOOLTIP} formatter={(v: number, n: string) => (n === "CTR" ? pct(v, 2) : money(v, currency, rate))} />
            <Bar yAxisId="cpa" dataKey="cpa" name="CPA" fill="#141a15" barSize={28} />
            <Line yAxisId="ctr" dataKey="ctr" name="CTR" stroke="#29a383" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function Trend({ d }: { d: ReachResponse }) {
  const plats = Object.keys(PLAT_COLOR).filter((p) => d.trend.some((r) => (r as Record<string, unknown>)[p]));
  return (
    <section className="border border-slate-6 bg-white p-5" data-testid="reach-trend">
      <p className="eyebrow">Frequency trend by platform (30d)</p>
      <div className="mt-4 h-60">
        <ResponsiveContainer>
          <LineChart data={d.trend} margin={{ left: 0, right: 28, top: 8 }}>
            <CartesianGrid stroke="#e6e9e2" vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} minTickGap={24} />
            <YAxis tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} width={32} />
            <Tooltip {...TOOLTIP} formatter={(v: number) => `${num(v, 2)}x`} labelFormatter={shortDate} />
            {plats.map((p) => <Line key={p} dataKey={p} name={PLATFORM_LABEL[p]} stroke={PLAT_COLOR[p]} strokeWidth={2} dot={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex gap-4">{plats.map((p) => <span key={p} className="flex items-center gap-1.5 text-[11px] text-slate-11"><span className="h-2 w-3" style={{ background: PLAT_COLOR[p] }} />{PLATFORM_LABEL[p]}</span>)}</div>
    </section>
  );
}

function AdsetTable({ d }: { d: ReachResponse }) {
  const { currency, rate } = useCurrency();
  return (
    <section className="overflow-x-auto border border-slate-6 bg-white" data-testid="reach-adset-table">
      <p className="eyebrow border-b border-slate-6 px-5 py-3">Audience headroom by ad set</p>
      <table className="w-full min-w-[760px] text-[12.5px]">
        <thead>
          <tr className="border-b border-slate-6 text-left font-mono text-[10px] uppercase tracking-[0.1em] text-slate-10">
            <th className="px-5 py-2.5 font-medium">Ad set</th><th className="px-3 font-medium">Status</th><th className="px-3 text-right font-medium">Reach</th><th className="px-3 text-right font-medium">Δ reach</th><th className="px-3 text-right font-medium">Frequency</th><th className="px-3 text-right font-medium">Cost / 1k</th><th className="px-5 text-right font-medium">CPA</th>
          </tr>
        </thead>
        <tbody>
          {d.adsets.map((a) => (
            <tr key={a.adset_id} className="border-b border-slate-4 transition-colors hover:bg-slate-2" data-testid={`reach-row-${a.adset_id}`}>
              <td className="px-5 py-3"><span className="flex items-center gap-2"><PlatformLogo platform={a.platform} size={14} /><span><span className="block font-medium text-slate-12">{a.adset}</span><span className="block text-[11px] text-slate-10">{a.campaign}</span></span></span></td>
              <td className="px-3"><span className={`px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${STATUS_STYLE[a.status]}`}>{a.status}</span></td>
              <td className="num px-3 text-right">{compact(a.reach)}</td>
              <td className={`num px-3 text-right ${(a.reach_delta ?? 0) < 0 ? "text-ruby-11" : "text-jade-11"}`}>{signedPct(a.reach_delta)}</td>
              <td className="num px-3 text-right">{num(a.frequency_base, 1)} → <span className="font-semibold">{num(a.frequency, 1)}</span></td>
              <td className="num px-3 text-right">{money(a.cost_per_1k_reach, currency, rate)}</td>
              <td className="num px-5 text-right">{money(a.cpa, currency, rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default function ReachPage() {
  const { data, isLoading, isError } = useReach();
  if (isLoading) return <div className="h-64 animate-pulse border border-slate-6 bg-white" data-testid="reach-loading" />;
  if (isError || !data) return <p className="border border-ruby-7 bg-ruby-2 p-4 text-sm text-ruby-11" data-testid="reach-error">Reach data could not be loaded.</p>;
  if (!data.available) return <p className="border border-slate-6 bg-white p-6 text-sm text-slate-11" data-testid="reach-unavailable">This platform does not report reach. Pick Meta, TikTok or LinkedIn in the account switcher.</p>;
  return (
    <div className="space-y-6" data-testid="page-reach">
      <Totals d={data} />
      <div className="grid gap-6 lg:grid-cols-2">
        <SweetSpot d={data} />
        <Trend d={data} />
      </div>
      <AdsetTable d={data} />
      <p className="text-[11px] text-slate-10" data-testid="reach-note">{data.note}</p>
    </div>
  );
}
