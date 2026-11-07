import { useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useCurrency, usePulse } from "../../hooks/queries";
import { cn } from "../../lib/cn";
import { money, ratio, shortDate } from "../../lib/format";

type ChartMode = "spend_roas" | "roas_mer" | "cpa_trend";

const MODES: { id: ChartMode; label: string }[] = [
  { id: "spend_roas", label: "Channel Spend & ROAS" },
  { id: "roas_mer", label: "Platform ROAS vs. Store MER" },
  { id: "cpa_trend", label: "CPA vs. Rolling Median" },
];

export function CrossChannelTrendChart() {
  const { data } = usePulse();
  const { currency, rate } = useCurrency();
  const [mode, setMode] = useState<ChartMode>("spend_roas");
  const series = data?.series ?? [];
  if (!series.length) return null;

  const chartData = series.map((pt) => ({
    ...pt,
    label: shortDate(pt.date),
    meta: pt.meta_spend / rate,
    google: pt.google_spend / rate,
    tiktok: pt.tiktok_spend / rate,
    linkedin: pt.linkedin_spend / rate,
    cpaConv: pt.cpa ? pt.cpa / rate : null,
    cpaMedConv: pt.cpa_median ? pt.cpa_median / rate : null,
  }));

  return (
    <section className="border border-slate-6 bg-white p-5" data-testid="cross-channel-trend-chart">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-6 pb-3">
        <div>
          <p className="eyebrow">30-Day Velocity & Efficiency Trajectory</p>
          <p className="mt-0.5 text-xs text-slate-11">
            Daily normalized spend stack and efficiency ratios across active attribution window.
          </p>
        </div>
        <div className="flex -space-x-px" data-testid="trend-chart-mode-toggle">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={cn("pill", mode === m.id && "border-iris-8 bg-iris-3 text-iris-11")}
              data-testid={`trend-mode-${m.id}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#cbd5e1" strokeDasharray="2 2" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} />
            {mode === "spend_roas" && (
              <>
                <YAxis
                  yAxisId="spend"
                  tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`}
                  tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="roas"
                  orientation="right"
                  tickFormatter={(v) => `${Number(v).toFixed(1)}x`}
                  tick={{ fill: "#4f46e5", fontSize: 10, fontFamily: "JetBrains Mono" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Bar yAxisId="spend" dataKey="meta" name="Meta" stackId="a" fill="#4f46e5" barSize={12} />
                <Bar yAxisId="spend" dataKey="google" name="Google" stackId="a" fill="#047857" barSize={12} />
                <Bar yAxisId="spend" dataKey="tiktok" name="TikTok" stackId="a" fill="#0f172a" barSize={12} />
                <Bar yAxisId="spend" dataKey="linkedin" name="LinkedIn" stackId="a" fill="#b45309" barSize={12} />
                <Line yAxisId="roas" type="monotone" dataKey="roas" name="Blended ROAS" stroke="#be123c" strokeWidth={2} dot={false} />
              </>
            )}
            {mode === "roas_mer" && (
              <>
                <YAxis
                  yAxisId="ratio"
                  tickFormatter={(v) => `${Number(v).toFixed(1)}x`}
                  tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Line yAxisId="ratio" type="monotone" dataKey="roas" name="Platform Claimed ROAS" stroke="#4f46e5" strokeWidth={2} dot={false} />
                <Line yAxisId="ratio" type="monotone" dataKey="mer" name="First-Party Store MER" stroke="#047857" strokeWidth={2} strokeDasharray="4 2" dot={false} />
              </>
            )}
            {mode === "cpa_trend" && (
              <>
                <YAxis
                  yAxisId="cpa"
                  tickFormatter={(v) => `${Number(v).toFixed(0)}`}
                  tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Line yAxisId="cpa" type="monotone" dataKey="cpaMedConv" name="14d Rolling Median CPA" stroke="#64748b" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
                <Line yAxisId="cpa" type="monotone" dataKey="cpaConv" name="Observed Daily CPA" stroke="#be123c" strokeWidth={2} dot={false} />
              </>
            )}
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="border border-slate-12 bg-white p-2.5 font-mono text-[11px] text-slate-12">
                    <p className="mb-1 border-b border-slate-6 pb-1 text-slate-10">{label}</p>
                    {payload.map((entry) => {
                      const val = Number(entry.value ?? 0);
                      const isRatio = String(entry.dataKey).includes("roas") || String(entry.dataKey) === "mer";
                      return (
                        <div key={String(entry.dataKey)} className="flex justify-between gap-4 py-0.5">
                          <span style={{ color: entry.color }}>{entry.name}</span>
                          <span className="num font-medium">{isRatio ? ratio(val) : money(val * rate, currency, rate, true)}</span>
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
