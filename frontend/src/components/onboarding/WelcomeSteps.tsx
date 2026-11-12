import { Check, Lock } from "lucide-react";

const STEPS = ["Your goal", "Connect accounts", "First AI audit"];

export function WelcomeSteps({ step }: { step: number }) {
  return (
    <ol className="grid grid-cols-3 border border-slate-12 bg-white" data-testid="welcome-steps">
      {STEPS.map((s, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <li key={s} className={`flex items-center gap-2 px-2.5 py-3 sm:gap-3 sm:px-4 ${i > 0 ? "border-l border-slate-12" : ""} ${active ? "bg-slate-12 text-white" : done ? "bg-jade-2" : ""}`} data-testid={`welcome-step-${i + 1}`}>
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center border font-mono text-[11px] ${active ? "border-jade-8 text-jade-8" : done ? "border-jade-9 bg-jade-9 text-white" : "border-slate-8 text-slate-10"}`}>
              {done ? <Check size={12} /> : i + 1}
            </span>
            <span className={`text-[11px] font-medium sm:text-[13px] ${active ? "" : done ? "text-jade-11" : "text-slate-10"}`}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function ReadOnlyBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 border border-jade-9 bg-jade-2 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-jade-11" data-testid="read-only-badge">
      <Lock size={11} /> Read-only · we never change your ads
    </span>
  );
}
