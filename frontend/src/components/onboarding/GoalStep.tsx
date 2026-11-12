import { useState } from "react";
import { ArrowRight, BadgeDollarSign, Clapperboard, Scissors, Users } from "lucide-react";
import { GOALS, type Goal, type Workspace } from "../../lib/insights";

const ICONS: Record<Goal, typeof Users> = { grow_revenue: BadgeDollarSign, cut_waste: Scissors, fix_creative: Clapperboard, scale_reach: Users };

interface Props { initial?: Workspace; onNext: (v: { goal: Goal; business_name: string; target_roas: number | null; monthly_budget: number | null }) => void; saving: boolean }

export function GoalStep({ initial, onNext, saving }: Props) {
  const [goal, setGoal] = useState<Goal | null>(initial?.goal ?? null);
  const [name, setName] = useState(initial?.business_name ?? "");
  const [roas, setRoas] = useState(initial?.target_roas != null ? String(initial.target_roas) : "");
  const [budget, setBudget] = useState(initial?.monthly_budget != null ? String(initial.monthly_budget) : "");
  return (
    <div className="space-y-7" data-testid="goal-step">
      <div>
        <h2 className="font-serif text-[30px] font-medium leading-tight">What matters most right now?</h2>
        <p className="mt-1.5 text-[14px] text-slate-11">Pick one. We tailor every suggestion and the first AI audit to it. You can change it later.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {GOALS.map((g) => {
          const Icon = ICONS[g.key];
          return (
            <button key={g.key} type="button" data-selected={goal === g.key} onClick={() => setGoal(g.key)} className="tile-select flex gap-4 p-5" data-testid={`goal-option-${g.key}`}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center border border-slate-12 ${goal === g.key ? "bg-slate-12 text-white" : "bg-white"}`}><Icon size={18} strokeWidth={1.75} /></span>
              <span>
                <span className="block text-[15px] font-semibold text-slate-12">{g.title}</span>
                <span className="mt-1 block text-[13px] leading-snug text-slate-11">{g.blurb}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block"><span className="eyebrow">Business name (optional)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Northwind Outdoor" className="mt-1.5 h-11 w-full border border-slate-7 bg-white px-3 text-sm outline-none transition-colors focus:border-slate-12" data-testid="goal-business-name-input" />
        </label>
        <label className="block"><span className="eyebrow">Target ROAS (optional)</span>
          <input value={roas} onChange={(e) => setRoas(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="4.0" inputMode="decimal" className="mt-1.5 h-11 w-full border border-slate-7 bg-white px-3 font-mono text-sm outline-none transition-colors focus:border-slate-12" data-testid="goal-target-roas-input" />
        </label>
        <label className="block"><span className="eyebrow">Monthly ad budget, USD (optional)</span>
          <input value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^0-9]/g, ""))} placeholder="250000" inputMode="numeric" className="mt-1.5 h-11 w-full border border-slate-7 bg-white px-3 font-mono text-sm outline-none transition-colors focus:border-slate-12" data-testid="goal-budget-input" />
        </label>
      </div>
      <div className="flex justify-end">
        <button type="button" className="btn-primary h-11 px-6" disabled={!goal || saving} onClick={() => goal && onNext({ goal, business_name: name, target_roas: roas ? Number(roas) : null, monthly_budget: budget ? Number(budget) : null })} data-testid="goal-continue-button">
          Continue <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
