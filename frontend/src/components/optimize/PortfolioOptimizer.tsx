import { useCurrency } from "../../hooks/queries";
import { money, PLATFORM_LABEL, ratio, signedPct } from "../../lib/format";
import { useDeepAgent } from "../../state/deepAgent";
import { PlatformLogo } from "../common/PlatformLogo";
import { StatusPill } from "../common/StatusPill";

export function PortfolioOptimizer() {
  const { run } = useDeepAgent();
  const { currency, rate } = useCurrency();
  const portfolio = run?.portfolio;
  const allocations = portfolio?.allocations ?? [];
  if (!allocations.length) return null;

  return (
    <section className="mb-8 border border-slate-6 bg-white" data-testid="portfolio-optimizer">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-6 bg-slate-2 px-5 py-3.5">
        <div>
          <p className="eyebrow">Multi-Channel Response Curve Solver · Weekly Portfolio Equilibrium</p>
          <p className="mt-0.5 text-xs text-slate-11">
            Constrained log-log diminishing-returns reallocation equating marginal ROAS across Meta, Google, TikTok and LinkedIn at zero net budget increase.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill tone="jade" testId="portfolio-weekly-lift">
            +{money(portfolio?.revenue_lift ?? 0, currency, rate, true)} / wk
          </StatusPill>
          <span className="num text-xs text-slate-12">
            Blended ROAS {ratio(portfolio?.base_roas)} → <strong className="text-jade-11">{ratio(portfolio?.optimal_roas)}</strong>
          </span>
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[740px] border-collapse">
          <thead>
            <tr className="border-b border-slate-6 bg-slate-1">
              <th className="eyebrow px-4 py-2 text-left font-normal">Platform</th>
              <th className="eyebrow px-3 py-2 text-right font-normal">Current / wk</th>
              <th className="eyebrow px-3 py-2 text-right font-normal">Optimal / wk</th>
              <th className="eyebrow px-3 py-2 text-right font-normal">Reallocation</th>
              <th className="eyebrow px-3 py-2 text-right font-normal">Elasticity β</th>
              <th className="eyebrow px-3 py-2 text-right font-normal">Marginal ROAS</th>
              <th className="eyebrow px-4 py-2 text-right font-normal">Projected Rev / wk</th>
            </tr>
          </thead>
          <tbody>
            {allocations.map((row) => {
              const positive = row.delta_spend > 10;
              const negative = row.delta_spend < -10;
              return (
                <tr key={row.platform} className="border-t border-slate-6 hover:bg-slate-2" data-testid={`portfolio-row-${row.platform}`}>
                  <td className="px-4 py-2.5 text-xs text-slate-12">
                    <span className="flex items-center gap-2">
                      <PlatformLogo platform={row.platform} size={14} />
                      {PLATFORM_LABEL[row.platform]}
                    </span>
                  </td>
                  <td className="num px-3 py-2.5 text-right text-xs text-slate-11">{money(row.base_spend, currency, rate, true)}</td>
                  <td className="num px-3 py-2.5 text-right text-xs font-medium text-slate-12">{money(row.optimal_spend, currency, rate, true)}</td>
                  <td className={`num px-3 py-2.5 text-right text-xs ${positive ? "text-jade-11" : negative ? "text-amber-11" : "text-slate-11"}`}>
                    {row.delta_spend >= 0 ? "+" : ""}
                    {money(row.delta_spend, currency, rate, true)} ({signedPct(row.delta_pct, 0)})
                  </td>
                  <td className="num px-3 py-2.5 text-right text-xs text-slate-11">{row.elasticity.toFixed(2)}</td>
                  <td className="num px-3 py-2.5 text-right text-xs text-slate-12">
                    {ratio(row.marginal_roas_base)} → {ratio(row.marginal_roas_optimal)}
                  </td>
                  <td className="num px-4 py-2.5 text-right text-xs text-slate-12">{money(row.optimal_revenue, currency, rate, true)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
