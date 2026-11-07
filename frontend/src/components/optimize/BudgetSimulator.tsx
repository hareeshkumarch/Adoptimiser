import { useEffect, useState } from "react";
import * as Slider from "@radix-ui/react-slider";
import { ArrowRight } from "lucide-react";
import { useCurrency } from "../../hooks/queries";
import { money, PLATFORM_LABEL, ratio } from "../../lib/format";
import { projectShift } from "../../lib/simulate";
import { PlatformLogo } from "../common/PlatformLogo";
import type { Curve, Simulator } from "../../types";

interface Props {
  sim: Simulator;
  curves: Record<string, Curve>;
  testId: string;
}

export function BudgetSimulator({ sim, curves, testId }: Props) {
  const [share, setShare] = useState(sim.default_pct);
  useEffect(() => {
    setShare(sim.default_pct);
  }, [sim.default_pct, sim.from, sim.to]);
  const { currency, rate } = useCurrency();
  const fromCurve = curves[sim.from];
  const toCurve = curves[sim.to];
  if (!fromCurve || !toCurve) return null;
  const p = projectShift(curves, sim, share);
  const lift = p.projectedRoas - p.baseRoas;
  return (
    <div className="border-t border-slate-6 bg-slate-2 px-5 py-4" data-testid={testId}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow">Impact simulator · weekly budget shift</p>
        <p className="flex items-center gap-1.5 text-xs text-slate-12">
          <PlatformLogo platform={sim.from} size={13} /> {PLATFORM_LABEL[sim.from]}
          <ArrowRight size={12} className="text-slate-10" />
          <PlatformLogo platform={sim.to} size={13} /> {PLATFORM_LABEL[sim.to]}
        </p>
      </div>
      <div className="mt-4 flex items-center gap-4">
        <Slider.Root
          value={[Math.round(share * 100)]}
          min={0}
          max={Math.round(sim.max_pct * 100)}
          step={1}
          onValueChange={([v]) => setShare(v / 100)}
          className="relative flex h-6 flex-1 touch-none select-none items-center"
          aria-label="Budget shift"
          data-testid={`${testId}-slider`}
        >
          <Slider.Track className="relative h-[3px] flex-1 bg-slate-5">
            <Slider.Range className="absolute h-full bg-iris-9" />
          </Slider.Track>
          <Slider.Thumb className="block h-4 w-4 border border-iris-9 bg-white transition-transform duration-100  focus:outline-none focus-visible:ring-2 focus-visible:ring-iris-7" />
        </Slider.Root>
        <span className="num w-12 text-right text-sm text-slate-12" data-testid={`${testId}-pct`}>
          {Math.round(share * 100)}%
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-px border border-slate-6 bg-slate-6 sm:grid-cols-3">
        <div className="bg-white px-3 py-2">
          <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-11">Shifted / wk</dt>
          <dd className="num mt-0.5 text-sm text-slate-12">{money(p.shift, currency, rate, true)}</dd>
        </div>
        <div className="bg-white px-3 py-2">
          <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-11">Blended ROAS</dt>
          <dd className="num mt-0.5 text-sm text-slate-12" data-testid={`${testId}-roas`}>
            {ratio(p.baseRoas)} → <span className={lift >= 0 ? "text-jade-11" : "text-ruby-11"}>{ratio(p.projectedRoas)}</span>
          </dd>
        </div>
        <div className="bg-white px-3 py-2">
          <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-11">Revenue / wk</dt>
          <dd className={`num mt-0.5 text-sm ${p.revenueDelta >= 0 ? "text-jade-11" : "text-ruby-11"}`} data-testid={`${testId}-revenue`}>
            {p.revenueDelta >= 0 ? "+" : ""}
            {money(p.revenueDelta, currency, rate, true)}
          </dd>
        </div>
      </dl>
      <p className="num mt-2 text-[10px] text-slate-10">
        log-log response curves · β {PLATFORM_LABEL[sim.from]} {fromCurve.elasticity.toFixed(2)} · β {PLATFORM_LABEL[sim.to]} {toCurve.elasticity.toFixed(2)}
      </p>
    </div>
  );
}
