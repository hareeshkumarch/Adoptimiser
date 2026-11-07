import type { ReactNode } from "react";

interface Props {
  index: string;
  title: string;
  kicker: string;
  aside?: ReactNode;
}

export const SectionHeader = ({ index, title, kicker, aside }: Props) => (
  <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-slate-6 pb-3.5">
    <div className="min-w-0">
      <p className="eyebrow flex items-center gap-2">
        <span className="num text-[10px] text-slate-9">{index}</span>
        <span className="h-px w-4 bg-slate-6" />
        <span className="truncate">{kicker}</span>
      </p>
      <h2 className="mt-1.5 font-serif text-[24px] font-medium leading-tight tracking-tight text-slate-12 sm:text-[27px]">{title}</h2>
    </div>
    {aside && <div className="shrink-0">{aside}</div>}
  </header>
);
