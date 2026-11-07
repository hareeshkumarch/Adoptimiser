import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type Tone = "ruby" | "amber" | "jade" | "iris" | "slate";

const TONES: Record<Tone, string> = {
  ruby: "bg-ruby-3 text-ruby-11 border-ruby-6",
  amber: "bg-amber-3 text-amber-11 border-amber-6",
  jade: "bg-jade-3 text-jade-11 border-jade-6",
  iris: "bg-iris-3 text-iris-11 border-iris-6",
  slate: "bg-slate-3 text-slate-11 border-slate-6",
};

interface Props {
  tone: Tone;
  children: ReactNode;
  className?: string;
  testId?: string;
}

export const StatusPill = ({ tone, children, className, testId }: Props) => (
  <span data-testid={testId} className={cn("inline-flex h-5 items-center gap-1 border px-1.5 font-mono text-[10px] font-medium uppercase tracking-wider", TONES[tone], className)}>
    {children}
  </span>
);

export const severityTone = (severity: string): Tone => (severity === "critical" ? "ruby" : "amber");
