import { cn } from "../../lib/cn";

export const ConfidenceMeter = ({ value, testId }: { value: number; testId?: string }) => {
  const tone = value >= 0.85 ? "bg-jade-9" : value >= 0.7 ? "bg-amber-9" : "bg-ruby-9";
  return (
    <div className="flex items-center gap-2" data-testid={testId}>
      <div className="flex h-1.5 w-20 gap-px">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={cn("h-full flex-1", i < Math.round(value * 10) ? tone : "bg-slate-4")} />
        ))}
      </div>
      <span className="num text-xs text-slate-12">{Math.round(value * 100)}%</span>
    </div>
  );
};
