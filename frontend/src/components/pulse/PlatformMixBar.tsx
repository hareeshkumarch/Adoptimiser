import { useCurrency, usePulse } from "../../hooks/queries";
import { money, pct, PLATFORM_LABEL, ratio } from "../../lib/format";
import { PlatformLogo } from "../common/PlatformLogo";

const BAR: Record<string, string> = { meta: "bg-iris-9", google: "bg-jade-9", tiktok: "bg-slate-12", linkedin: "bg-amber-9" };

export function PlatformMixBar() {
  const { data } = usePulse();
  const { currency, rate } = useCurrency();
  if (!data) return null;
  const { pacing } = data;
  return (
    <div className="border border-slate-6 bg-white" data-testid="platform-mix">
      <div className="flex h-2">
        {data.platforms.map((p) => (
          <span key={p.platform} className={BAR[p.platform]} style={{ width: `${p.share * 100}%` }} />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4">
        {data.platforms.map((p) => (
          <div key={p.platform} className="border-slate-6 px-4 py-3 [&:not(:last-child)]:border-r" data-testid={`platform-mix-${p.platform}`}>
            <div className="flex items-center gap-1.5 text-xs text-slate-11">
              <PlatformLogo platform={p.platform} size={13} /> {PLATFORM_LABEL[p.platform]}
              <span className="num ml-auto text-slate-10">{pct(p.share, 0)}</span>
            </div>
            <p className="num mt-1.5 text-sm text-slate-12">{money(p.spend, currency, rate, true)}</p>
            <p className="num text-[11px] text-slate-11">ROAS {ratio(p.roas)}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-slate-6 px-4 py-2.5 text-[11px] text-slate-11" data-testid="pacing-summary">
        <span className="eyebrow">Month pacing</span>
        <span className="num">MTD {money(pacing.mtd_spend, currency, rate, true)}</span>
        <span className="num">Projected {money(pacing.projected_spend, currency, rate, true)} / {money(pacing.month_budget, currency, rate, true)}</span>
        <span className={`num ${pacing.pace && pacing.pace > 1.05 ? "text-amber-11" : "text-jade-11"}`}>Pace {pct(pacing.pace, 0)}</span>
        <span className="num ml-auto">
          Day {pacing.day}/{pacing.days_in_month}
        </span>
      </div>
    </div>
  );
}
