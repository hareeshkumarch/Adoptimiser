import { Link } from "react-router-dom";
import { ArrowUpRight, Loader2, ShieldAlert, Sparkles, TrendingUp } from "lucide-react";
import { useCurrency } from "../../hooks/queries";
import { money } from "../../lib/format";
import { useDeepAgent } from "../../state/deepAgent";
import { SectionHeader } from "../common/SectionHeader";
import { CrossChannelTrendChart } from "./CrossChannelTrendChart";
import { PlatformMixBar } from "./PlatformMixBar";

function ExecutiveImpactStrip() {
  const { run } = useDeepAgent();
  const { currency, rate } = useCurrency();
  if (!run) return null;

  const bleed = run.findings.filter((f) => f.impact_type === "savings").reduce((s, f) => s + f.dollar_impact, 0);
  const upside = run.findings.filter((f) => f.impact_type === "revenue").reduce((s, f) => s + f.dollar_impact, 0);
  const portfolioLift = (run.portfolio?.revenue_lift ?? 0) * 2;

  return (
    <div className="grid grid-cols-1 gap-px border border-slate-6 bg-slate-6 sm:grid-cols-3" data-testid="executive-impact-strip">
      <Link to="/diagnostics" className="group bg-white p-4 transition-colors ">
        <div className="flex items-center justify-between text-xs text-slate-11">
          <span className="eyebrow flex items-center gap-1.5 text-ruby-11">
            <ShieldAlert size={12} /> Verified 14d Spend Bleed
          </span>
          <ArrowUpRight size={13} className="text-slate-10 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
        <p className="num mt-1.5 text-xl font-medium text-slate-12">{money(bleed, currency, rate, true)}</p>
        <p className="mt-0.5 text-[11px] text-slate-11">
          {run.findings.length} root causes verified · {run.rejected.length} false-positive trap filtered
        </p>
      </Link>

      <Link to="/optimizations" className="group bg-white p-4 transition-colors ">
        <div className="flex items-center justify-between text-xs text-slate-11">
          <span className="eyebrow flex items-center gap-1.5 text-jade-11">
            <TrendingUp size={12} /> Addressable 14d Upside
          </span>
          <ArrowUpRight size={13} className="text-slate-10 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
        <p className="num mt-1.5 text-xl font-medium text-slate-12">{money(upside + bleed, currency, rate, true)}</p>
        <p className="mt-0.5 text-[11px] text-slate-11">{run.prescriptions.length} ranked prescriptions ready to simulate</p>
      </Link>

      <Link to="/optimizations" className="group bg-white p-4 transition-colors ">
        <div className="flex items-center justify-between text-xs text-slate-11">
          <span className="eyebrow flex items-center gap-1.5 text-iris-11">
            <Sparkles size={12} /> Portfolio MMM Equilibrium
          </span>
          <ArrowUpRight size={13} className="text-slate-10 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
        <p className="num mt-1.5 text-xl font-medium text-jade-11">+{money(portfolioLift, currency, rate, true)}</p>
        <p className="mt-0.5 text-[11px] text-slate-11">
          14d projected lift via marginal ROAS reallocation ({run.portfolio?.base_roas?.toFixed(2) ?? "—"}x → {run.portfolio?.optimal_roas?.toFixed(2) ?? "—"}x)
        </p>
      </Link>
    </div>
  );
}

function NarrativeBody() {
  const { status, narrative, run } = useDeepAgent();
  const busy = status === "starting" || status === "running";
  const text = narrative || (busy ? "" : run?.narrative ?? "");
  if (!text && busy)
    return (
      <p className="font-serif text-lg italic text-slate-11">
        {status === "starting" ? "Starting the investigation and preparing its data scope…" : "Gathering evidence across your ad accounts. The narrative will appear here as findings are verified…"}
      </p>
    );
  if (!text) return <p className="text-sm text-slate-11">Run the deep agent to synthesize the cross-channel narrative.</p>;
  return (
    <div className="space-y-4 font-serif text-[17px] leading-[1.65] text-slate-12 sm:text-lg" data-testid="pacing-narrative">
      {text.split(/\n\s*\n/).map((para, i, all) => (
        <p key={i} className={i === 0 ? "first-letter:float-left first-letter:mr-2 first-letter:font-serif first-letter:text-5xl first-letter:leading-[0.9]" : undefined}>
          {para}
          {status === "running" && i === all.length - 1 && <span className="ml-0.5 inline-block h-4 w-[7px] translate-y-0.5 animate-blink bg-iris-9" />}
        </p>
      ))}
    </div>
  );
}

export function NarrativeSection() {
  const { status } = useDeepAgent();
  const busy = status === "starting" || status === "running";
  return (
    <section data-testid="section-what-is-happening">
      <SectionHeader
        index="01"
        kicker="Unified pulse & live narrative"
        title="Executive Pulse"
        aside={busy ? <span className="inline-flex items-center gap-1.5 text-xs text-iris-11"><Loader2 size={13} className="animate-spin" /> {status === "starting" ? "Starting" : "Updating now"}</span> : undefined}
      />
      <div className="grid gap-6">
        <ExecutiveImpactStrip />
        <NarrativeBody />
        <CrossChannelTrendChart />
        <PlatformMixBar />
      </div>
    </section>
  );
}
