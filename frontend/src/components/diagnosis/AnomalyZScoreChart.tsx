import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useCurrency, usePulse } from "../../hooks/queries";
import { money, shortDate } from "../../lib/format";
import { StatusPill } from "../common/StatusPill";

export function AnomalyZScoreChart() {
  const { data } = usePulse();
  const { currency, rate } = useCurrency();
  const series = data?.series ?? [];
  if (!series.length) return null;

  const chartData = series.map((pt) => ({
    date: pt.date,
    label: shortDate(pt.date),
    cpa: pt.cpa ? pt.cpa / rate : null,
    median: pt.cpa_median ? pt.cpa_median / rate : null,
    upper: pt.cpa_upper ? pt.cpa_upper / rate : null,
    z: pt.cpa_z ?? 0,
  }));

  const outliers = chartData.filter((d) => Math.abs(d.z) >= 2.2).length;

  return (
    <section className="border border-slate-6 bg-white p-5" data-testid="anomaly-zscore-chart">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-6 pb-3">
        <div>
          <p className="eyebrow">Robust Median / MAD Z-Score Detector · 30d CPA Trajectory</p>
          <p className="mt-0.5 text-xs text-slate-11">
            Observed daily CPA vs. 14-day rolling median and +2.5σ MAD tolerance band (includes critic-filtered pixel-outage spike).
          </p>
        </div>
        <StatusPill tone={outliers > 0 ? "ruby" : "jade"}>{outliers} outlier days |z| ≥ 2.2σ</StatusPill>
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#cbd5e1" strokeDasharray="2 2" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} />
            <YAxis
              yAxisId="cpa"
              tickFormatter={(v) => `${Number(v).toFixed(0)}`}
              tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="z"
              orientation="right"
              domain={[-3, 6]}
              tickFormatter={(v) => `${Number(v).toFixed(1)}σ`}
              tick={{ fill: "#be123c", fontSize: 10, fontFamily: "JetBrains Mono" }}
              tickLine={false}
              axisLine={false}
            />
            <Area yAxisId="cpa" type="monotone" dataKey="upper" name="+2.5σ Tolerance Band" stroke="none" fill="#f1f5f9" fillOpacity={0.9} />
            <Line yAxisId="cpa" type="monotone" dataKey="median" name="14d Rolling Median CPA" stroke="#64748b" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
            <Line yAxisId="cpa" type="monotone" dataKey="cpa" name="Observed CPA" stroke="#4f46e5" strokeWidth={2} dot={false} />
            <ReferenceLine yAxisId="z" y={2.5} stroke="#be123c" strokeDasharray="3 3" />
            <Line yAxisId="z" type="monotone" dataKey="z" name="Robust Z-Score" stroke="#be123c" strokeWidth={1.5} dot={false} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="border border-slate-12 bg-white p-2.5 font-mono text-[11px] text-slate-12">
                    <p className="mb-1 border-b border-slate-6 pb-1 text-slate-10">{label}</p>
                    {payload.map((entry) => {
                      const val = Number(entry.value ?? 0);
                      const isZ = entry.dataKey === "z";
                      return (
                        <div key={String(entry.dataKey)} className="flex justify-between gap-4 py-0.5">
                          <span style={{ color: entry.color }}>{entry.name}</span>
                          <span className="num font-medium">{isZ ? `${val >= 0 ? "+" : ""}${val.toFixed(2)}σ` : money(val * rate, currency, rate)}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
