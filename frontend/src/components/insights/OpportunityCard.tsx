import { ArrowUpRight, Bot, MessageSquareText } from "lucide-react";
import { useCurrency } from "../../hooks/queries";
import { money } from "../../lib/format";
import type { Category, Opportunity } from "../../lib/insights";
import { PlatformLogo } from "../common/PlatformLogo";

export const CATEGORY_STYLE: Record<Category, string> = {
  Scale: "bg-jade-9 text-white",
  Save: "bg-ruby-9 text-white",
  Creative: "bg-iris-9 text-white",
  Reach: "bg-amber-9 text-slate-12",
  Timing: "bg-slate-12 text-white",
  Tracking: "bg-slate-11 text-white",
  Budget: "bg-amber-10 text-white",
};

interface Props { o: Opportunity; index: number; onAsk: (prompt: string) => void; onInvestigate: (query: string) => void }

export function OpportunityCard({ o, index, onAsk, onInvestigate }: Props) {
  const { currency, rate } = useCurrency();
  return (
    <article className="card-x group animate-fade-up p-5" style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }} data-testid={`opportunity-${o.id}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="num text-[11px] text-slate-9">#{String(o.rank).padStart(2, "0")}</span>
          <span className={`px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] ${CATEGORY_STYLE[o.category]}`}>{o.category}</span>
          {o.platform !== "multi" && <PlatformLogo platform={o.platform} size={14} />}
        </div>
        <div className="text-right">
          <p className="num text-lg font-semibold leading-none text-jade-11" data-testid={`opportunity-${o.id}-impact`}>+{money(o.impact_usd, currency, rate, o.impact_usd / rate >= 10000)}</p>
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-10">est. / week</p>
        </div>
      </div>
      <h3 className="mt-3 text-[15px] font-semibold leading-snug text-slate-12">{o.title}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-slate-11">{o.why}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {o.evidence.map((e) => <span key={e} className="num border border-slate-5 bg-slate-2 px-2 py-0.5 text-[10.5px] text-slate-11">{e}</span>)}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-slate-6 pt-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-10">Effort {o.effort} · {Math.round(o.confidence * 100)}% sure</p>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost h-8 px-3 text-[11px]" onClick={() => onAsk(o.ask_prompt)} data-testid={`opportunity-${o.id}-ask`}>
            <MessageSquareText size={12} /> Ask how
          </button>
          <button type="button" className="btn-primary h-8 px-3 text-[11px]" onClick={() => onInvestigate(o.agent_query)} data-testid={`opportunity-${o.id}-investigate`}>
            <Bot size={12} /> Deep dive <ArrowUpRight size={11} />
          </button>
        </div>
      </div>
    </article>
  );
}
