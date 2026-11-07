import * as Select from "@radix-ui/react-select";
import { ArrowLeftRight, Check, ChevronDown, Clock3, Lock, Layers } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useFilters } from "../../state/filters";
import type { AttributionWindow, Compare, Level } from "../../types";

type Option<T extends string> = { value: T; label: string; description: string };

const WINDOWS: Option<AttributionWindow>[] = [
  { value: "1d_click", label: "1-day click", description: "Credit conversions within one day of a click." },
  { value: "7d_click", label: "7-day click", description: "Credit conversions within seven days of a click." },
  { value: "data_driven", label: "Data-driven", description: "Use the platform's modeled attribution." },
];
const COMPARES: Option<Compare>[] = [
  { value: "previous_period", label: "Previous period", description: "Compare with the prior period of equal length." },
  { value: "rolling_30d", label: "30-day average", description: "Compare with the rolling 30-day benchmark." },
];
const LEVELS: Option<Level>[] = [
  { value: "platform", label: "Platform", description: "Compare results across ad platforms." },
  { value: "campaign", label: "Campaign", description: "See performance by campaign." },
  { value: "adset", label: "Ad set", description: "Inspect targeting groups and budgets." },
  { value: "creative", label: "Creative", description: "Find the ads behind each result." },
];

function FilterSelect<T extends string>({
  label,
  value,
  options,
  icon: Icon,
  onChange,
  testId,
  optionTestIdPrefix,
  width,
}: {
  label: string;
  value: T;
  options: Option<T>[];
  icon: LucideIcon;
  onChange: (value: T) => void;
  testId: string;
  optionTestIdPrefix?: string;
  width: string;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${width}`}>
      <span className="eyebrow">{label}</span>
      <Select.Root value={value} onValueChange={(next) => onChange(next as T)}>
        <Select.Trigger
          aria-label={label}
          className="flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-slate-6 bg-white px-3 text-left text-[13px] text-slate-12 transition-colors  focus:border-iris-8 data-[state=open]:border-iris-8"
          data-testid={testId}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <Icon size={15} strokeWidth={1.75} className="shrink-0 text-slate-10" />
            <Select.Value />
          </span>
          <ChevronDown size={14} className="shrink-0 text-slate-10" />
        </Select.Trigger>
        <Select.Portal>
          <Select.Content position="popper" sideOffset={5} className="z-50 w-[var(--radix-select-trigger-width)] min-w-[220px] rounded-xl border border-slate-6 bg-white p-1 ">
            <Select.Viewport className="p-1">
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  className="flex cursor-pointer items-start gap-3 rounded-lg px-2.5 py-2.5 text-slate-12 outline-none data-[highlighted]:bg-slate-2"
                  data-testid={`${optionTestIdPrefix ?? testId}-${option.value}`}
                >
                  <span className="min-w-0 flex-1">
                    <Select.ItemText>
                      <span className="block text-[13px] font-medium">{option.label}</span>
                    </Select.ItemText>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-10">{option.description}</span>
                  </span>
                  <Select.ItemIndicator className="mt-0.5 text-iris-11">
                    <Check size={14} />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}

export function FilterBar({ showBreakdown = false }: { showBreakdown?: boolean }) {
  const { window, compare, level, update } = useFilters();
  return (
    <section className="sticky top-16 z-20 mb-7 rounded-xl border border-slate-6 bg-slate-2 p-3 sm:p-4" aria-label="Analysis filters" data-testid="filter-bar">
      <div className="flex flex-wrap items-end gap-3 sm:gap-4">
        {showBreakdown && (
          <FilterSelect
            label="Break down by"
            value={level}
            options={LEVELS}
            icon={Layers}
            onChange={(value) => update({ level: value })}
            testId="filter-pill-drilldown"
            optionTestIdPrefix="drilldown-option"
            width="w-full sm:w-[176px]"
          />
        )}
        <FilterSelect
          label="Attribution window"
          value={window}
          options={WINDOWS}
          icon={Clock3}
          onChange={(value) => update({ window: value })}
          testId="filter-pill-attribution"
          width="w-full sm:w-[204px]"
        />
        <FilterSelect
          label="Compare with"
          value={compare}
          options={COMPARES}
          icon={ArrowLeftRight}
          onChange={(value) => update({ compare: value })}
          testId="filter-pill-compare"
          width="w-full sm:w-[196px]"
        />
        <p className="ml-auto hidden items-center gap-1.5 pb-2 text-[11px] text-slate-10 lg:flex" data-testid="read-only-badge">
          <Lock size={12} /> Read-only reporting
        </p>
      </div>
    </section>
  );
}
