import { useState } from "react";
import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown, Filter, X } from "lucide-react";
import { useCurrency } from "../../hooks/queries";
import { cn } from "../../lib/cn";
import { money, PLATFORM_LABEL } from "../../lib/format";
import { runMatchesScope } from "../../lib/runScope";
import { useDeepAgent } from "../../state/deepAgent";
import { useFilters } from "../../state/filters";
import { RunEmptyState } from "../common/RunEmptyState";
import { SectionHeader } from "../common/SectionHeader";
import { StatusPill } from "../common/StatusPill";
import { Logos, RootCauseCard } from "./RootCauseCard";
import type { Finding } from "../../types";

type DiagFilter = "all" | "critical" | "warning" | "savings" | "revenue";

function matchesPlatform(f: Finding, platform: string | null): boolean {
  if (!platform) return true;
  if (f.platform === platform) return true;
  if (f.platform === "multi" && f.platforms?.includes(platform as never)) return true;
  return false;
}

function matchesDiagFilter(f: Finding, filter: DiagFilter): boolean {
  if (filter === "all") return true;
  if (filter === "critical") return f.severity === "critical";
  if (filter === "warning") return f.severity === "warning";
  if (filter === "savings") return f.impact_type === "savings";
  if (filter === "revenue") return f.impact_type === "revenue" || f.impact_type === "misattributed";
  return true;
}

function RejectedRow({ f }: { f: Finding }) {
  return (
    <div className="grid gap-2 border-t border-slate-6 px-5 py-4 first:border-t-0" data-testid={`rejected-finding-${f.kind}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Logos f={f} />
        <span className="num text-sm text-slate-12 line-through decoration-ruby-9">{f.headline}</span>
        <StatusPill tone="ruby">False positive</StatusPill>
        <span className="text-xs text-slate-11">{f.entity_name}</span>
      </div>
      <p className="text-xs leading-relaxed text-slate-12">{f.critic.rejection_reason}</p>
      <ul className="space-y-0.5">
        {f.critic.checks.map((c) => (
          <li key={c.name + c.label} className="num text-[11px] text-slate-11">
            <span className={c.passed ? "text-jade-11" : "text-ruby-11"}>{c.passed ? "PASS" : "FAIL"}</span> · {c.label}: {c.detail}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RejectedPanel({ items }: { items: Finding[] }) {
  if (!items.length) return null;
  return (
    <Accordion.Root type="single" collapsible className="border border-dashed border-slate-7 bg-slate-2">
      <Accordion.Item value="rejected">
        <Accordion.Trigger className="group flex w-full items-center gap-2 px-5 py-3 text-xs text-slate-11 hover:text-slate-12" data-testid="rejected-findings-toggle">
          <Filter size={13} />
          <span className="font-mono uppercase tracking-wider">Filtered out by critic · {items.length}</span>
          <ChevronDown size={14} className="ml-auto transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </Accordion.Trigger>
        <Accordion.Content className="overflow-hidden border-t border-slate-6 bg-white data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          {items.map((f) => (
            <RejectedRow key={f.id} f={f} />
          ))}
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}

export function RootCauseSection() {
  const { run, status } = useDeepAgent();
  const { platform, accountId, campaign, adsetId, window, update } = useFilters();
  const { currency, rate } = useCurrency();
  const [diagFilter, setDiagFilter] = useState<DiagFilter>("all");

  const scopedRun = run && runMatchesScope(run, platform, accountId, campaign, adsetId, window) ? run : null;
  const allFindings = scopedRun?.findings ?? [];
  const allRejected = scopedRun?.rejected ?? [];
  const platformFindings = allFindings.filter((f) => matchesPlatform(f, platform));
  const findings = platformFindings.filter((f) => matchesDiagFilter(f, diagFilter));
  const rejected = allRejected.filter((f) => matchesPlatform(f, platform));

  const filterCards: { id: DiagFilter; label: string; count: number; impact: number }[] = [
    { id: "all", label: "All Verified", count: platformFindings.length, impact: platformFindings.reduce((s, f) => s + f.dollar_impact, 0) },
    {
      id: "critical",
      label: "Critical Bleed",
      count: platformFindings.filter((f) => f.severity === "critical").length,
      impact: platformFindings.filter((f) => f.severity === "critical").reduce((s, f) => s + f.dollar_impact, 0),
    },
    {
      id: "warning",
      label: "Warning & Saturation",
      count: platformFindings.filter((f) => f.severity === "warning").length,
      impact: platformFindings.filter((f) => f.severity === "warning").reduce((s, f) => s + f.dollar_impact, 0),
    },
    {
      id: "savings",
      label: "Direct Cost Savings",
      count: platformFindings.filter((f) => f.impact_type === "savings").length,
      impact: platformFindings.filter((f) => f.impact_type === "savings").reduce((s, f) => s + f.dollar_impact, 0),
    },
    {
      id: "revenue",
      label: "Demand & Attribution",
      count: platformFindings.filter((f) => f.impact_type !== "savings").length,
      impact: platformFindings.filter((f) => f.impact_type !== "savings").reduce((s, f) => s + f.dollar_impact, 0),
    },
  ];

  return (
    <section data-testid="section-where-it-goes-wrong">
      <SectionHeader
        index="02"
        kicker="Verified root-cause tree"
        title="Root-Cause Audit"
        aside={scopedRun ? (
          <span className="num text-xs text-slate-11" data-testid="root-cause-count">
            {platformFindings.length} verified · {rejected.length} filtered
          </span>
        ) : undefined}
      />
      {platform && scopedRun && (
        <div className="mb-4 flex items-center justify-between border border-iris-6 bg-iris-2 px-4 py-2 text-xs text-iris-11" data-testid="diagnostics-scope-banner">
          <span>
            Scoped to <strong>{PLATFORM_LABEL[platform]} Ads</strong> ({platformFindings.length} of {allFindings.length} verified findings)
          </span>
          <button type="button" onClick={() => update({ platform: null, accountId: null })} className="inline-flex items-center gap-1 font-mono text-[10px] uppercase hover:underline">
            <X size={11} /> Show all platforms
          </button>
        </div>
      )}
      {platformFindings.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-px border border-slate-6 bg-slate-6 sm:grid-cols-5" role="group" aria-label="Filter verified findings" data-testid="diagnostics-filter-cards">
          {filterCards.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setDiagFilter(c.id)}
              aria-pressed={diagFilter === c.id}
              className={cn(
                "bg-white p-3 text-left transition-colors ",
                diagFilter === c.id && "bg-iris-2",
              )}
              data-testid={`diag-filter-card-${c.id}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-11">{c.label}</span>
                <span className="num text-xs font-medium text-iris-11">{c.count}</span>
              </div>
              <p className="num mt-1 text-sm font-medium text-slate-12">{money(c.impact, currency, rate, true)}</p>
            </button>
          ))}
        </div>
      )}
      {!run && (status === "loading" || status === "starting" || status === "running") && <div className="h-40 animate-pulse border border-slate-6 bg-slate-2" />}
      {!run && status !== "loading" && status !== "starting" && status !== "running" && <RunEmptyState failed={status === "failed"} item="verified root causes" />}
      {run && !scopedRun && <p className="mb-4 border border-amber-6 bg-amber-2 px-4 py-3 text-xs leading-relaxed text-amber-11" role="status">The selected account, platform, campaign, or attribution window was not included in this investigation. Run it again for the current selection to see relevant findings.</p>}
      {(status === "starting" || status === "running") && scopedRun && <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-iris-11">Showing previous run · new investigation in progress</p>}
      {scopedRun && platformFindings.length === 0 && <p className="mb-4 border border-slate-6 bg-white px-4 py-3 text-xs text-slate-11">No verified root causes were found for this analysis scope.</p>}
      {platformFindings.length > 0 && findings.length === 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-slate-6 bg-white px-4 py-3 text-xs text-slate-11">
          <span>No verified findings match this filter.</span>
          <button type="button" onClick={() => setDiagFilter("all")} className="font-medium text-iris-11 hover:text-iris-12">Show all findings</button>
        </div>
      )}
      <div className="space-y-4">
        {findings.map((f, i) => (
          <RootCauseCard key={f.id} f={f} index={i} />
        ))}
        <RejectedPanel items={rejected} />
      </div>
    </section>
  );
}
