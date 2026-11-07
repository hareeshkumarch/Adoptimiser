import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "../../lib/cn";
import { signedPct } from "../../lib/format";

interface Props {
  value: number | null | undefined;
  inverse?: boolean;
  className?: string;
  testId?: string;
}

export const Delta = ({ value, inverse = false, className, testId }: Props) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return <span className={cn("num text-xs text-slate-11", className)}>—</span>;
  const good = inverse ? value < 0 : value > 0;
  const flat = Math.abs(value) < 0.005;
  const Icon = value >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span data-testid={testId} className={cn("num inline-flex items-center gap-0.5 text-xs", flat ? "text-slate-11" : good ? "text-jade-11" : "text-ruby-11", className)}>
      <Icon size={12} strokeWidth={2} />
      {signedPct(value)}
    </span>
  );
};
