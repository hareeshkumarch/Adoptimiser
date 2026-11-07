import type { WeekdayRow } from "../../lib/insights";

export function WeekdayBars({ rows }: { rows: WeekdayRow[] }) {
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => r.roas || 0));
  const min = Math.min(...rows.map((r) => r.roas || 0));
  return (
    <section className="border border-slate-6 bg-white p-5" data-testid="weekday-bars">
      <p className="eyebrow">Best days to spend · ROAS by weekday (28d)</p>
      <div className="mt-4 grid grid-cols-7 items-end gap-2" style={{ height: 120 }}>
        {rows.map((r) => {
          const h = max ? 30 + ((r.roas - min) / (max - min || 1)) * 70 : 30;
          const best = r.roas === max;
          const worst = r.roas === min;
          return (
            <div key={r.day} className="group flex h-full flex-col justify-end" data-testid={`weekday-${r.day}`}>
              <span className="num mb-1 text-center text-[10px] text-slate-11 opacity-0 transition-opacity group-hover:opacity-100">{r.roas.toFixed(2)}x</span>
              <div className={`w-full border border-slate-12 transition-all duration-200 group-hover:-translate-y-1 ${best ? "bg-jade-9" : worst ? "bg-ruby-8" : "bg-slate-4"}`} style={{ height: `${h}%` }} />
            </div>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2">
        {rows.map((r) => <span key={r.day} className="text-center font-mono text-[10px] uppercase text-slate-10">{r.day}</span>)}
      </div>
    </section>
  );
}
