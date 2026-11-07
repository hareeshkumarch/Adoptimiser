import type { ReactNode } from "react";

interface Props {
  index: string;
  title: string;
  kicker: string;
  aside?: ReactNode;
}

export const SectionHeader = ({ index, title, kicker, aside }: Props) => (
  <header className="mb-5 flex items-end justify-between gap-4 border-b border-slate-6 pb-3">
    <div>
      <p className="eyebrow">
        {index} · {kicker}
      </p>
      <h2 className="mt-1 font-serif text-2xl font-medium tracking-tight text-slate-12 sm:text-[28px]">{title}</h2>
    </div>
    {aside}
  </header>
);
