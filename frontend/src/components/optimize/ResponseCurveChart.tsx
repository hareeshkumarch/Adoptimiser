import { useState } from "react";
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useCurrency } from "../../hooks/queries";
import { cn } from "../../lib/cn";
import { money, PLATFORM_LABEL, ratio } from "../../lib/format";
import { useDeepAgent } from "../../state/deepAgent";
import { PlatformLogo } from "../common/PlatformLogo";
import type { Platform } from "../../types";

const PLATFORMS: Platform[] = ["meta", "google", "tiktok", "linkedin"];

export function ResponseCurveChart() {
  const { run } = useDeepAgent();
  const { currency, rate } = useCurrency();
  const [selected, setSelected] = useState<Platform | null>(null);

  const curves = run?.curves ?? {};
  const availablePlatforms = PLATFORMS.filter((platform) => curves[platform]?.grid.length);
  const activePlatform = selected && availablePlatforms.includes(selected) ? selected : availablePlatforms[0];
  if (!activePlatform) return null;
  const activeCurve = curves[activePlatform];
  if (!activeCurve?.grid.length) return null;
  const grid = activeCurve.grid;

  const chartData = grid.map((pt) => ({
    ...pt,
    spendConv: pt.spend / rate,
    revConv: pt.revenue / rate,
    pctLabel: `${Math.round(pt.multiplier * 100)}%`,
  }));

  const currentSpendConv = activeCurve.spend / rate;

  return (
    <section className="mb-8 border border-slate-6 bg-white p-5" data-testid="response-curve-chart">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-6 pb-3">
        <div>
          <p className="eyebrow">
            Log-Log Diminishing Returns Frontier · β = {activeCurve.elasticity.toFixed(2)}
          </p>
          <p className="mt-0.5 text-xs text-slate-11">
            Expected weekly revenue R(S) = α·S^β and marginal ROAS (dR/dS) from 40% to 160% of current channel spend.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Choose a platform for the response curve" data-testid="curve-platform-selector">
          {availablePlatforms.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setSelected(p)}
              aria-pressed={activePlatform === p}
              className={cn("pill", activePlatform === p && "border-jade-7 bg-jade-2 text-jade-11")}
              data-testid={`curve-platform-${p}`}
            >
              <PlatformLogo platform={p} size={12} />
              {PLATFORM_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#cbd5e1" strokeDasharray="2 2" vertical={false} />
            <XAxis dataKey="pctLabel" tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} />
            <YAxis
              yAxisId="rev"
              tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`}
              tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="mroas"
              orientation="right"
              tickFormatter={(v) => `${Number(v).toFixed(1)}x`}
              tick={{ fill: "#047857", fontSize: 10, fontFamily: "JetBrains Mono" }}
              tickLine={false}
              axisLine={false}
            />
            <ReferenceLine yAxisId="rev" x="100%" stroke="#0f172a" strokeDasharray="3 3" />
            <Line yAxisId="rev" type="monotone" dataKey="revConv" name="Expected Revenue / wk" stroke="#4f46e5" strokeWidth={2} dot={{ r: 2.5, fill: "#4f46e5" }} />
            <Line yAxisId="mroas" type="monotone" dataKey="marginal_roas" name="Marginal ROAS (dR/dS)" stroke="#047857" strokeWidth={2} strokeDasharray="4 2" dot={false} />
            <Line yAxisId="mroas" type="monotone" dataKey="avg_roas" name="Average ROAS" stroke="#64748b" strokeWidth={1.5} dot={false} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const pt = payload[0]?.payload;
                return (
                  <div className="border border-slate-12 bg-white p-2.5 font-mono text-[11px] text-slate-12">
                    <p className="mb-1 border-b border-slate-6 pb-1 text-slate-10">
                      {PLATFORM_LABEL[activePlatform]} · {label} ({money(pt.spend, currency, rate, true)}/wk)
                    </p>
                    {payload.map((entry) => {
                      const val = Number(entry.value ?? 0);
                      const isRoas = String(entry.dataKey).includes("roas");
                      return (
                        <div key={String(entry.dataKey)} className="flex justify-between gap-4 py-0.5">
                          <span style={{ color: entry.color }}>{entry.name}</span>
                          <span className="num font-medium">{isRoas ? ratio(val) : money(val * rate, currency, rate, true)}</span>
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
      <p className="num mt-2 text-[10px] text-slate-10">
        Current baseline weekly spend: {money(currentSpendConv * rate, currency, rate, true)} · Elasticity β = {activeCurve.elasticity.toFixed(2)}
      </p>
    </section>
  );
}
