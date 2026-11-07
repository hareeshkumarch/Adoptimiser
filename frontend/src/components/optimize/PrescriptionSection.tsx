import { useState } from "react";
import { Check, ClipboardCopy, Download, Lock } from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "../../hooks/queries";
import { money, PLATFORM_LABEL } from "../../lib/format";
import { useDeepAgent } from "../../state/deepAgent";
import { useFilters } from "../../state/filters";
import { ConfidenceMeter } from "../common/ConfidenceMeter";
import { SectionHeader } from "../common/SectionHeader";
import { severityTone, StatusPill } from "../common/StatusPill";
import { IMPACT_LABEL, Logos } from "../diagnosis/RootCauseCard";
import { BudgetSimulator } from "./BudgetSimulator";
import { PortfolioOptimizer } from "./PortfolioOptimizer";
import { ResponseCurveChart } from "./ResponseCurveChart";
import type { Curve, Prescription } from "../../types";

function matchesPlatform(rx: Prescription, platform: string | null): boolean {
  if (!platform) return true;
  if (rx.platform === platform) return true;
  if (rx.platform === "multi" && rx.platforms?.includes(platform as never)) return true;
  return false;
}

function PrescriptionCard({
  rx,
  rank,
  curves,
  staged,
  onToggleStaged,
}: {
  rx: Prescription;
  rank: number;
  curves: Record<string, Curve>;
  staged: boolean;
  onToggleStaged: () => void;
}) {
  const { currency, rate } = useCurrency();
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({ 0: true, 1: true, 2: true });

  return (
    <article className="animate-fade-up border border-slate-6 bg-white" style={{ animationDelay: `${rank * 60}ms` }} data-testid={`prescription-card-${rank}`}>
      <div className="grid gap-4 p-5 sm:grid-cols-[48px_1fr_auto]">
        <span className="num text-3xl font-light leading-none text-slate-9">{String(rank).padStart(2, "0")}</span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Logos f={rx} />
            <StatusPill tone={severityTone(rx.severity)}>{rx.severity}</StatusPill>
            <button
              type="button"
              onClick={onToggleStaged}
              className={`inline-flex h-5 items-center gap-1 border px-1.5 font-mono text-[10px] uppercase tracking-wider ${
                staged ? "border-jade-6 bg-jade-3 text-jade-11" : "border-slate-6 bg-slate-2 text-slate-10"
              }`}
              data-testid={`stage-rx-toggle-${rank}`}
            >
              <Check size={10} /> {staged ? "Staged in runbook" : "Excluded"}
            </button>
          </div>
          <h3 className="mt-2 text-[15px] font-medium leading-snug text-slate-12" data-testid={`prescription-title-${rank}`}>
            {rx.title}
          </h3>
          <ul className="mt-2 space-y-1.5">
            {rx.steps.map((s, idx) => {
              const isChecked = checkedSteps[idx] ?? true;
              return (
                <li key={s} className="flex items-start gap-2 text-[13px] leading-relaxed text-slate-11">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => setCheckedSteps((prev) => ({ ...prev, [idx]: !isChecked }))}
                    className="mt-1 h-3.5 w-3.5 shrink-0 accent-indigo-600"
                  />
                  <span className={isChecked ? "text-slate-12" : "line-through text-slate-10"}>{s}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <p className="num text-xl font-medium text-jade-11" data-testid={`prescription-impact-${rank}`}>
            {money(rx.dollar_impact, currency, rate, true)}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-11">{IMPACT_LABEL[rx.impact_type].replace("at risk", "saved")}</p>
          <ConfidenceMeter value={rx.confidence} testId={`prescription-confidence-${rank}`} />
        </div>
      </div>
      {rx.simulator && <BudgetSimulator sim={rx.simulator} curves={curves} testId={`simulator-${rank}`} />}
    </article>
  );
}

function ExecutionRunbook({ items }: { items: Prescription[] }) {
  const { currency, rate } = useCurrency();
  if (!items.length) return null;

  const copyMarkdown = () => {
    const lines = [
      "# QUORUM READ-ONLY EXECUTION RUNBOOK",
      `| Seq | Platform | Prescription | 14d Impact | Confidence |`,
      `| --- | --- | --- | --- | --- |`,
      ...items.map(
        (rx, i) =>
          `| 0${i + 1} | ${PLATFORM_LABEL[rx.platform]} | ${rx.title} | ${money(rx.dollar_impact, currency, rate, true)} | ${Math.round(rx.confidence * 100)}% |`,
      ),
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(() => toast.success("Execution runbook copied as Markdown"));
  };

  const exportCsv = () => {
    const rows = [
      ["seq", "platform", "kind", "title", "dollar_impact_14d", "confidence", "lead_step"],
      ...items.map((rx, i) => [
        String(i + 1),
        rx.platform,
        rx.kind,
        `"${rx.title.replace(/"/g, '""')}"`,
        String(Math.round(rx.dollar_impact)),
        String(rx.confidence),
        `"${(rx.steps[0] ?? "").replace(/"/g, '""')}"`,
      ]),
    ];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "quorum-execution-runbook.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Execution runbook exported as CSV");
  };

  return (
    <section className="mt-10 border border-slate-12 bg-white p-6" data-testid="execution-runbook">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-6 pb-4">
        <div>
          <p className="eyebrow flex items-center gap-1.5 text-slate-12">
            <Lock size={11} /> Step 03 · Locked Read-Only Media Buyer Execution Runbook
          </p>
          <p className="mt-0.5 text-xs text-slate-11">
            Operator specification for manual or bulk-sheet execution in ad platform consoles ({items.length} staged prescriptions).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={copyMarkdown} className="btn-ghost" data-testid="runbook-copy-md">
            <ClipboardCopy size={12} /> Copy Markdown Brief
          </button>
          <button type="button" onClick={exportCsv} className="btn-primary" data-testid="runbook-export-csv">
            <Download size={12} /> Export Bulk CSV
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[740px] border-collapse font-mono text-xs">
          <thead>
            <tr className="border-b border-slate-6 bg-slate-2">
              <th className="px-3 py-2 text-left font-normal text-slate-11">SEQ</th>
              <th className="px-3 py-2 text-left font-normal text-slate-11">PLATFORM</th>
              <th className="px-3 py-2 text-left font-normal text-slate-11">STAGED ACTION SPECIFICATION</th>
              <th className="px-3 py-2 text-right font-normal text-slate-11">SHIFT</th>
              <th className="px-3 py-2 text-right font-normal text-slate-11">14D IMPACT</th>
              <th className="px-3 py-2 text-right font-normal text-slate-11">48H GUARDRAIL</th>
            </tr>
          </thead>
          <tbody>
            {items.map((rx, i) => (
              <tr key={rx.id} className="border-t border-slate-6 hover:bg-slate-2" data-testid={`runbook-row-${i + 1}`}>
                <td className="num px-3 py-2.5 text-slate-10">0{i + 1}</td>
                <td className="px-3 py-2.5 text-slate-12">{PLATFORM_LABEL[rx.platform]}</td>
                <td className="px-3 py-2.5 font-sans text-xs text-slate-12">{rx.title}</td>
                <td className="num px-3 py-2.5 text-right text-slate-11">
                  {rx.simulator ? `${Math.round(rx.simulator.default_pct * 100)}% (${rx.simulator.from}→${rx.simulator.to})` : "Creative/Bid"}
                </td>
                <td className="num px-3 py-2.5 text-right text-jade-11">{money(rx.dollar_impact, currency, rate, true)}</td>
                <td className="num px-3 py-2.5 text-right text-[11px] text-slate-10">Revert if CPA &gt; +15%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function PrescriptionSection() {
  const { run } = useDeepAgent();
  const { platform, update } = useFilters();
  const allItems = run?.prescriptions ?? [];
  const items = allItems.filter((rx) => matchesPlatform(rx, platform));
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const { currency, rate } = useCurrency();

  const stagedItems = items.filter((rx) => !excludedIds.includes(rx.id));
  const total = stagedItems.reduce((s, r) => s + r.dollar_impact, 0);

  const toggleStaged = (id: string) => {
    setExcludedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <section data-testid="section-optimizations">
      <SectionHeader
        index="03"
        kicker="Prescriptions & impact simulator"
        title="Action & Allocation"
        aside={
          <span className="num text-xs text-slate-11" data-testid="prescriptions-total">
            {money(total, currency, rate, true)} addressable · ranked by $ × confidence
          </span>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-px border border-slate-6 bg-slate-6 sm:grid-cols-3" data-testid="optimization-step-ledger">
        <div className="bg-white px-4 py-3">
          <p className="eyebrow text-iris-11">Step 01 · Portfolio MMM Equilibrium</p>
          <p className="mt-0.5 text-xs text-slate-12">
            Log-log response curves &amp; marginal ROAS frontier (+{money(run?.portfolio?.revenue_lift ?? 0, currency, rate, true)}/wk)
          </p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className="eyebrow text-jade-11">Step 02 · Interactive Simulator &amp; Staging</p>
          <p className="mt-0.5 text-xs text-slate-12">
            {stagedItems.length} of {items.length} prescriptions staged ({money(total, currency, rate, true)} 14d impact)
          </p>
        </div>
        <div className="bg-white px-4 py-3">
          <p className="eyebrow text-slate-12">Step 03 · Read-Only Execution Runbook</p>
          <p className="mt-0.5 text-xs text-slate-12">Exportable Markdown &amp; bulk CSV specification with 48h guardrails</p>
        </div>
      </div>

      {platform && (
        <div className="mb-4 flex items-center justify-between border border-iris-6 bg-iris-2 px-4 py-2 text-xs text-iris-11">
          <span>
            Scoped to <strong>{PLATFORM_LABEL[platform]} Ads</strong> ({items.length} of {allItems.length} prescriptions)
          </span>
          <button type="button" onClick={() => update({ platform: null, accountId: null })} className="font-mono text-[10px] uppercase hover:underline">
            Show all platforms
          </button>
        </div>
      )}
      <PortfolioOptimizer />
      <ResponseCurveChart />
      {!run && <div className="h-40 animate-pulse border border-slate-6 bg-slate-2" />}
      <div className="space-y-4">
        {items.map((rx, i) => (
          <PrescriptionCard
            key={rx.id}
            rx={rx}
            rank={i + 1}
            curves={run?.curves ?? {}}
            staged={!excludedIds.includes(rx.id)}
            onToggleStaged={() => toggleStaged(rx.id)}
          />
        ))}
      </div>
      <ExecutionRunbook items={stagedItems} />
    </section>
  );
}
