import * as Select from "@radix-ui/react-select";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { Check, ChevronDown, Lock } from "lucide-react";
import { useFilters } from "../../state/filters";
import type { AttributionWindow, Compare, Level } from "../../types";

const WINDOWS: { value: AttributionWindow; label: string }[] = [
  { value: "1d_click", label: "1d click" },
  { value: "7d_click", label: "7d click" },
  { value: "data_driven", label: "Data-Driven" },
];
const COMPARES: { value: Compare; label: string }[] = [
  { value: "previous_period", label: "vs. Previous Period" },
  { value: "rolling_30d", label: "vs. 30d Rolling" },
];
const LEVELS: { value: Level; label: string }[] = [
  { value: "platform", label: "Platform" },
  { value: "campaign", label: "Campaign" },
  { value: "adset", label: "Ad Set" },
  { value: "creative", label: "Creative" },
];

function Toggle<T extends string>({ label, value, options, onChange, testId }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; testId: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="eyebrow">{label}</span>
      <ToggleGroup.Root type="single" value={value} onValueChange={(v) => v && onChange(v as T)} className="flex -space-x-px" data-testid={testId}>
        {options.map((o) => (
          <ToggleGroup.Item key={o.value} value={o.value} className="pill" data-testid={`${testId}-${o.value}`}>
            {o.label}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </div>
  );
}

function LevelSelect() {
  const { level, update } = useFilters();
  return (
    <div className="flex items-center gap-2">
      <span className="eyebrow">Drilldown</span>
      <Select.Root value={level} onValueChange={(v) => update({ level: v as Level })}>
        <Select.Trigger className="pill min-w-[150px] justify-between text-slate-12" data-testid="filter-pill-drilldown">
          <Select.Value />
          <ChevronDown size={13} className="text-slate-11" />
        </Select.Trigger>
        <Select.Portal>
          <Select.Content position="popper" sideOffset={4} className="z-50 min-w-[var(--radix-select-trigger-width)] border border-slate-6 bg-white">
            <Select.Viewport className="p-1">
              {LEVELS.map((l, i) => (
                <Select.Item key={l.value} value={l.value} className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-xs text-slate-12 outline-none data-[highlighted]:bg-slate-3" data-testid={`drilldown-option-${l.value}`}>
                  <span className="num w-4 text-[10px] text-slate-10">{i + 1}</span>
                  <Select.ItemText>{l.label}</Select.ItemText>
                  <Select.ItemIndicator className="ml-auto text-iris-11">
                    <Check size={12} />
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

export function FilterBar() {
  const { window, compare, update } = useFilters();
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-slate-6 bg-slate-2 px-6 py-2.5" data-testid="filter-bar">
      <Toggle label="Attribution" value={window} options={WINDOWS} onChange={(v) => update({ window: v })} testId="filter-pill-attribution" />
      <LevelSelect />
      <Toggle label="Compare" value={compare} options={COMPARES} onChange={(v) => update({ compare: v })} testId="filter-pill-compare" />
      <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-slate-11" data-testid="read-only-badge">
        <Lock size={12} /> Read-only · no write scopes
      </span>
    </div>
  );
}
