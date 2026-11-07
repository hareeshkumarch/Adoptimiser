interface Props {
  eyebrow: string;
  title: string;
  description: string;
}

export function PageHeading({ eyebrow, title, description }: Props) {
  return (
    <header className="mb-7 border-b border-slate-4 pb-6 sm:mb-8">
      <p className="eyebrow flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-jade-9" />{eyebrow}</p>
      <h1 className="mt-2 font-serif text-[34px] font-medium leading-tight tracking-tight text-slate-12 sm:text-[38px]">{title}</h1>
      <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-slate-11">{description}</p>
    </header>
  );
}
