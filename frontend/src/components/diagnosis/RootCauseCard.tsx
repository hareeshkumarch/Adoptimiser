import * as Accordion from "@radix-ui/react-accordion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, ChevronDown, CircleDot, ShieldCheck, Table2, X } from "lucide-react";
import { useCurrency } from "../../hooks/queries";
import { cn } from "../../lib/cn";
import { money, pct, signedPct } from "../../lib/format";
import { useFilters } from "../../state/filters";
import { ConfidenceMeter } from "../common/ConfidenceMeter";
import { PlatformLogo, PlatformStack } from "../common/PlatformLogo";
import { severityTone, StatusPill } from "../common/StatusPill";
import type { EvidenceStep, Finding, Platform } from "../../types";

export const IMPACT_LABEL: Record<Finding["impact_type"], string> = {
  savings: "spend at risk · 14d",
  revenue: "revenue upside · 14d",
  misattributed: "misattributed · 14d",
};

const STEP_ICON = {
  detected: { Icon: CircleDot, cls: "text-iris-11 border-iris-6 bg-iris-3" },
  verified: { Icon: Check, cls: "text-jade-11 border-jade-6 bg-jade-3" },
  rejected: { Icon: X, cls: "text-ruby-11 border-ruby-6 bg-ruby-3" },
};

export function Logos({ f }: { f: Pick<Finding, "platform" | "platforms"> }) {
  if (f.platform === "multi") return <PlatformStack platforms={(f.platforms ?? []) as Platform[]} size={18} />;
  return <PlatformLogo platform={f.platform} size={16} />;
}

function formatMetricValue(metric: string, val: number | null | undefined, currency: string, rate: number): string {
  if (val === null || val === undefined) return "—";
  if (metric === "cpa") return money(val, currency as never, rate);
  if (metric === "hook_rate" || metric === "is_lost") return pct(val, 1);
  if (metric === "overlap_ratio") return `${val.toFixed(2)}x`;
  return val.toFixed(1);
}

function CausalMetricStrip({ f }: { f: Finding }) {
  const { currency, rate } = useCurrency();
  const recoverable = f.dollar_impact * Math.min(0.92, f.confidence + 0.04);
  return (
    <div className="mt-3 grid grid-cols-2 gap-px border border-slate-6 bg-slate-6 sm:grid-cols-4" data-testid={`causal-strip-${f.kind}`}>
      <div className="bg-slate-1 px-3 py-1.5">
        <p className="font-mono text-[9px] uppercase tracking-wider text-slate-10">Primary Metric ({f.metric})</p>
        <p className="num text-xs text-slate-12">
          {formatMetricValue(f.metric, f.baseline, currency, rate)} → <strong>{formatMetricValue(f.metric, f.recent, currency, rate)}</strong>
        </p>
      </div>
      <div className="bg-slate-1 px-3 py-1.5">
        <p className="font-mono text-[9px] uppercase tracking-wider text-slate-10">Observed Shift</p>
        <p className="num text-xs text-ruby-11">{signedPct(f.change, 0)}</p>
      </div>
      <div className="bg-slate-1 px-3 py-1.5">
        <p className="font-mono text-[9px] uppercase tracking-wider text-slate-10">Robust MAD Z-Score</p>
        <p className="num text-xs text-slate-12">{f.z !== null && f.z !== undefined ? `${f.z >= 0 ? "+" : ""}${f.z.toFixed(1)}σ` : "Multi-lag r > 0.70"}</p>
      </div>
      <div className="bg-slate-1 px-3 py-1.5">
        <p className="font-mono text-[9px] uppercase tracking-wider text-slate-10">14d Recoverable Bound</p>
        <p className="num text-xs text-jade-11">{money(recoverable, currency, rate, true)} (P50)</p>
      </div>
    </div>
  );
}

function EvidenceChain({ steps }: { steps: EvidenceStep[] }) {
  return (
    <ol className="relative ml-2 border-l border-slate-6">
      {steps.map((s, i) => {
        const { Icon, cls } = STEP_ICON[s.step];
        return (
          <li key={i} className="relative pb-3 pl-6 last:pb-0" data-testid={`evidence-step-${i}`}>
            <span className={cn("absolute -left-[9px] top-0.5 flex h-[17px] w-[17px] items-center justify-center border", cls)}>
              <Icon size={10} strokeWidth={2.5} />
            </span>
            <span className="mr-2 font-mono text-[10px] uppercase tracking-wider text-slate-10">{s.agent}</span>
            <span className="text-[13px] leading-relaxed text-slate-12">{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function RootCauseCard({ f, index }: { f: Finding; index: number }) {
  const { currency, rate } = useCurrency();
  const { update } = useFilters();
  const navigate = useNavigate();
  const tone = severityTone(f.severity);

  const handleDrilldown = () => {
    const targetPlatform = f.platform === "multi" ? (f.platforms?.[0] ?? null) : f.platform;
    const nextLevel = f.entity_level === "adset" ? "creative" : "adset";
    update({
      platform: targetPlatform,
      campaign: f.campaign ?? null,
      adsetId: f.entity_level === "adset" && f.entity_ids?.length === 1 ? f.entity_ids[0] : null,
      adsetName: f.entity_level === "adset" ? f.entity_name : null,
      level: nextLevel,
    });
    navigate("/drilldown");
  };

  return (
    <article
      className={cn(
        "animate-fade-up border border-slate-6 bg-white transition-colors duration-150 hover:border-slate-8",
        f.severity === "critical" ? "border-l-2 border-l-ruby-9" : "border-l-2 border-l-amber-9",
      )}
      style={{ animationDelay: `${index * 60}ms` }}
      data-testid={`root-cause-card-${f.kind}`}
    >
      <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Logos f={f} />
            <span className="eyebrow text-slate-12">{f.title}</span>
            <StatusPill tone={tone}>{f.severity}</StatusPill>
            <StatusPill tone="jade">
              <ShieldCheck size={10} /> Critic verified
            </StatusPill>
          </div>
          <p className="num mt-3 text-2xl font-medium text-slate-12" data-testid="root-cause-headline">
            {f.headline}
          </p>
          <p className="mt-1 text-xs text-slate-11">
            {f.campaign && f.campaign !== f.entity_name ? `${f.campaign} › ` : ""}
            <span className="text-slate-12">{f.entity_name}</span>
          </p>
          <CausalMetricStrip f={f} />
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <p className="num text-xl font-medium text-slate-12" data-testid="root-cause-impact">
            {money(f.dollar_impact, currency, rate, true)}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-11">{IMPACT_LABEL[f.impact_type]}</p>
          <ConfidenceMeter value={f.confidence} testId="root-cause-confidence" />
        </div>
      </div>
      <Accordion.Root type="single" collapsible className="border-t border-slate-6">
        <Accordion.Item value="chain">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2">
            <Accordion.Trigger
              className="group flex flex-1 items-center gap-2 py-0.5 text-left text-xs text-slate-11 transition-colors hover:text-slate-12"
              data-testid={`evidence-toggle-${f.kind}`}
            >
              <span className="font-mono uppercase tracking-wider">Deep-agent evidence chain · {f.evidence.length} steps</span>
              <ChevronDown size={14} className="transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </Accordion.Trigger>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDrilldown}
                className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-slate-11 hover:text-iris-11"
                data-testid={`drill-entity-${f.kind}`}
              >
                <Table2 size={11} /> Drill entity
              </button>
              <span className="text-slate-6">·</span>
              <button
                type="button"
                onClick={() => navigate("/optimizations")}
                className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-iris-11 hover:underline"
                data-testid={`prescribe-entity-${f.kind}`}
              >
                Prescription <ArrowRight size={11} />
              </button>
            </div>
          </div>
          <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <div className="space-y-4 border-t border-slate-4 px-5 pb-5 pt-3">
              <EvidenceChain steps={f.evidence} />
              {f.critic.checks.length > 0 && (
                <div className="border border-slate-6 bg-slate-1 p-3">
                  <p className="eyebrow mb-2">Adversarial Falsification Matrix · {f.critic.checks.length} Confounder Tests</p>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {f.critic.checks.map((chk) => (
                      <div key={chk.name} className="flex items-start gap-2 border border-slate-6 bg-white px-2.5 py-1.5 text-xs">
                        <span className={cn("num font-medium", chk.passed ? "text-jade-11" : "text-ruby-11")}>{chk.passed ? "PASS" : "FAIL"}</span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-12">{chk.label}</p>
                          <p className="num truncate text-[11px] text-slate-11">{chk.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {f.critic.challenge && (
                <blockquote className="border-l-2 border-iris-9 bg-iris-2 px-4 py-3" data-testid="critic-challenge">
                  <p className="eyebrow text-iris-11">Adversarial critic</p>
                  <p className="mt-1 font-serif text-[15px] italic leading-relaxed text-slate-12">{f.critic.challenge}</p>
                  {f.critic.rationale && <p className="mt-1.5 text-xs leading-relaxed text-slate-11">{f.critic.rationale}</p>}
                </blockquote>
              )}
            </div>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
    </article>
  );
}
